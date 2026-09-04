// Netlify Function - Health Check
// Endpoint: GET /.netlify/functions/health

const https = require('https');
const crypto = require('crypto');

// GA Configuration from env
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;

// Rate limiting for health checks (prevents endpoint abuse & ping spam)
const healthRateLimitMap = new Map();
const HEALTH_RATE_MAX = 60; // max 60 requests per hour per IP
const HEALTH_RATE_WINDOW = 3600000; // 1 hour

// Cached GA validation to prevent wasting resources and external calls
let cachedGACheck = null;
let lastGACheckTime = 0;
const GA_CHECK_TTL = 60000; // 60 seconds cache

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://allinone.milanwebportal.com',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Rate limiting by IP
    const ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['client-ip'])) || 'unknown';
    const ipHash = hashIp(ip);
    const now = Date.now();

    // Memory prune if map grows large: remove expired first, then sort by resetAt ascending
    if (healthRateLimitMap.size > 500) {
        for (const [key, val] of healthRateLimitMap.entries()) {
            if (now > val.resetAt) healthRateLimitMap.delete(key);
        }
        if (healthRateLimitMap.size > 500) {
            const sortedEntries = Array.from(healthRateLimitMap.entries())
                .sort((a, b) => a[1].resetAt - b[1].resetAt);
            const toPrune = healthRateLimitMap.size - 300;
            for (let i = 0; i < toPrune && i < sortedEntries.length; i++) {
                healthRateLimitMap.delete(sortedEntries[i][0]);
            }
        }
    }

    const rateData = healthRateLimitMap.get(ipHash) || { count: 0, resetAt: now + HEALTH_RATE_WINDOW };
    if (now > rateData.resetAt) {
        rateData.count = 0;
        rateData.resetAt = now + HEALTH_RATE_WINDOW;
    }
    rateData.count++;
    healthRateLimitMap.set(ipHash, rateData);

    if (rateData.count > HEALTH_RATE_MAX) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({
                error: 'Rate limit exceeded',
                retry_after: Math.ceil((rateData.resetAt - now) / 1000)
            })
        };
    }

    const checks = {};
    let overallStatus = 'ok';

    // 1. Node.js environment (status only, no version/platform leakage)
    checks.nodejs = {
        status: 'ok'
    };

    // 2. Environment variables
    checks.env = {
        status: GA_MEASUREMENT_ID && GA_API_SECRET ? 'ok' : 'warning',
        ga_measurement_id_set: !!GA_MEASUREMENT_ID,
        ga_api_secret_set: !!GA_API_SECRET
    };

    if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
        overallStatus = 'warning';
    }

    // 3. GA Endpoint connectivity (cached & uses debug validation endpoint to avoid spamming live data)
    try {
        const gaCheck = await getGAEndpointCheck();
        checks.ga_endpoint = {
            status: gaCheck.reachable ? 'ok' : 'warning',
            response_time_ms: gaCheck.responseTime,
            reachable: gaCheck.reachable,
            cached: gaCheck.cached || false
        };
        if (!gaCheck.reachable) {
            overallStatus = 'warning';
        }
    } catch (error) {
        checks.ga_endpoint = {
            status: 'error',
            error: error.message
        };
        overallStatus = 'error';
    }

    // 4. Rate limiting memory status
    checks.rate_limiting = {
        status: 'ok',
        note: 'In-memory rate limiting active'
    };

    // 5. Function info
    checks.function = {
        status: 'ok',
        name: context ? context.functionName : 'health',
        remaining_time_ms: (context && typeof context.getRemainingTimeInMillis === 'function')
            ? context.getRemainingTimeInMillis()
            : 0
    };

    const response = {
        status: overallStatus,
        service: 'aio-analytics',
        version: '1.0',
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        checks,
        endpoints: {
            track: '/.netlify/functions/track',
            health: '/.netlify/functions/health'
        }
    };

    return {
        statusCode: overallStatus === 'ok' ? 200 : 503,
        headers,
        body: JSON.stringify(response, null, 2)
    };
};

async function getGAEndpointCheck() {
    const now = Date.now();
    if (cachedGACheck && (now - lastGACheckTime < GA_CHECK_TTL)) {
        return { ...cachedGACheck, cached: true };
    }

    const checkResult = await performGACheck();
    cachedGACheck = checkResult;
    lastGACheckTime = now;
    return checkResult;
}

function performGACheck() {
    return new Promise((resolve) => {
        if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
            resolve({
                reachable: false,
                responseTime: 0,
                statusCode: 0,
                error: 'Missing environment variables'
            });
            return;
        }

        const start = Date.now();
        // Use debug validation endpoint so live reports are not polluted with junk hits
        const endpoint = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

        const postBody = JSON.stringify({
            client_id: 'health-check-probe.0000000000',
            events: [{
                name: 'health_probe',
                params: {
                    engagement_time_msec: 1
                }
            }]
        });

        const req = https.request(endpoint, {
            method: 'POST',
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postBody)
            }
        }, (res) => {
            // Drain stream
            res.resume();
            resolve({
                reachable: [200, 204, 400, 401, 403].includes(res.statusCode),
                responseTime: Date.now() - start,
                statusCode: res.statusCode
            });
        });

        req.on('error', () => {
            resolve({
                reachable: false,
                responseTime: Date.now() - start,
                statusCode: 0
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                reachable: false,
                responseTime: Date.now() - start,
                statusCode: 0
            });
        });

        req.write(postBody);
        req.end();
    });
}
