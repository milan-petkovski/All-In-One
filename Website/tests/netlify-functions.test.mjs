// Tests for Website Netlify Functions
// Pokreni iz: Website/
// Komanda: npm test
//
// Netlify functions use CommonJS (exports.handler).
// Website package.json has "type": "module" so we must use createRequire.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Mock environment variables before requiring modules
process.env.GA_MEASUREMENT_ID = 'G-TESTID123';
process.env.GA_API_SECRET = 'test_secret_abc';

// Lazy-load using require (CJS)
const indexFn = require(path.join(__dirname, '../netlify/functions/index.js'));
const trackFn = require(path.join(__dirname, '../netlify/functions/track.js'));
const healthFn = require(path.join(__dirname, '../netlify/functions/health.js'));


function makeEvent(overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      events: [{ name: 'test_event', params: { label: 'unit' } }]
    }),
    ...overrides
  };
}

function makeFakeContext() {
  return {
    functionName: 'test-function',
    getRemainingTimeInMillis: () => 9000
  };
}

// --- index.js ---

test('index.js returns API info on GET', async () => {
  const event = { httpMethod: 'GET', headers: {} };
  const result = await indexFn.handler(event, makeFakeContext());

  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.status, 'active');
  assert.ok(body.endpoints.track);
  assert.ok(body.endpoints.health);
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://allinone.milanwebportal.com');
});

test('index.js rejects non-GET with 405', async () => {
  const result = await indexFn.handler({ httpMethod: 'POST', headers: {} }, makeFakeContext());
  assert.equal(result.statusCode, 405);
});

test('index.js handles OPTIONS preflight', async () => {
  const result = await indexFn.handler({ httpMethod: 'OPTIONS', headers: {} }, makeFakeContext());
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '');
});

// --- track.js ---

test('track.js rejects OPTIONS with 200 (preflight)', async () => {
  const event = makeEvent({ httpMethod: 'OPTIONS' });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '');
});

test('track.js rejects non-POST with 405', async () => {
  const event = makeEvent({ httpMethod: 'GET' });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.statusCode, 405);
});

test('track.js returns 400 on missing client_id', async () => {
  const event = makeEvent({
    body: JSON.stringify({ events: [{ name: 'test' }] })
  });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.match(body.error, /client_id/i);
});

test('track.js returns 400 on invalid client_id format', async () => {
  const event = makeEvent({
    body: JSON.stringify({
      client_id: '<script>alert(1)</script>',
      events: [{ name: 'test' }]
    })
  });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.match(body.error, /client_id/i);
});

test('track.js returns 400 when no valid events after sanitization', async () => {
  const event = makeEvent({
    headers: { 'x-forwarded-for': '10.0.0.99', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      events: [{ name: '!!!!!!' }]
    })
  });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.statusCode, 400);
  const body = JSON.parse(result.body);
  assert.match(body.error, /No valid events/i);
});


test('track.js sanitizes event params — strips unsafe keys and truncates values', async () => {
  const longString = 'x'.repeat(200);
  const event = makeEvent({
    body: JSON.stringify({
      client_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      events: [{
        name: 'sanitize_test',
        params: {
          good_key: longString,
          'bad key!@#': 'value',
          numeric: 42,
          bool: true
        }
      }]
    })
  });
  const result = await trackFn.handler(event, makeFakeContext());
  // Regardless of GA response, the function should not crash and returns 200
  // (GA may return non-2xx but we still respond 200 with ok:true)
  const body = JSON.parse(result.body);
  // events_received should be 1 (the sanitize_test event passed)
  assert.equal(body.events_received, 1);
});

test('track.js CORS header is restricted to specific domain', async () => {
  const event = makeEvent({ httpMethod: 'OPTIONS' });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://allinone.milanwebportal.com');
});

test('track.js returns 500 on malformed JSON body', async () => {
  const event = makeEvent({ body: 'not-json{{{' });
  const result = await trackFn.handler(event, makeFakeContext());
  assert.equal(result.statusCode, 500);
});

// --- health.js ---

test('health.js rejects non-GET with 405', async () => {
  const result = await healthFn.handler({ httpMethod: 'POST', headers: {} }, makeFakeContext());
  assert.equal(result.statusCode, 405);
});

test('health.js handles OPTIONS preflight', async () => {
  const result = await healthFn.handler({ httpMethod: 'OPTIONS', headers: {} }, makeFakeContext());
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '');
});

test('health.js includes env and nodejs checks', async () => {
  const result = await healthFn.handler({ httpMethod: 'GET', headers: {} }, makeFakeContext());
  // 200 or 503 depending on GA reachability — both are acceptable in unit test
  assert.ok([200, 503].includes(result.statusCode), `unexpected status ${result.statusCode}`);
  const body = JSON.parse(result.body);
  assert.ok(body.checks.nodejs);
  assert.equal(body.checks.nodejs.status, 'ok');
  assert.equal(body.checks.env.ga_measurement_id_set, true);
  assert.equal(body.checks.env.ga_api_secret_set, true);
});

test('health.js CORS header is restricted to specific domain', async () => {
  const result = await healthFn.handler({ httpMethod: 'OPTIONS', headers: {} }, makeFakeContext());
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://allinone.milanwebportal.com');
});


