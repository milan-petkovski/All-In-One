/**
 * All In One - Advanced Analytics & Performance Monitoring (2026 Edition)
 * Optimized for GA4, Google Tag, Consent Mode v2 and Web Vitals
 */
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

window.dataLayer = window.dataLayer || [];

export function gtag() {
    window.dataLayer.push(arguments);
}

// Default Consent Mode v2 settings
export const initConsentMode = () => {
    gtag('consent', 'default', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'granted',
        'wait_for_update': 500
    });
};

// Asynchronous GA4 Initialization without inline script blocks
export const initGA = (measurementId = 'G-F52S6J4TZV') => {
    initConsentMode();

    gtag('js', new Date());
    gtag('config', measurementId, {
        anonymize_ip: true,
        cookie_flags: 'SameSite=None;Secure'
    });

    if (!document.querySelector(`script[src*="${measurementId}"]`)) {
        const s = document.createElement('script');
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(s);
    }
};

// Error Tracking
export const trackError = (message, source, lineno, colno, error) => {
    trackEvent('exception', {
        description: `${message} at ${source}:${lineno}:${colno}`,
        fatal: false
    });
};

// Real Core Web Vitals Tracking
export const trackWebVitals = () => {
    const sendMetric = ({ name, value, id, rating }) => {
        trackEvent('web_vitals', {
            metric_name: name,
            metric_value: Math.round(name === 'CLS' ? value * 1000 : value),
            metric_id: id,
            metric_rating: rating
        });
    };
    try {
        onCLS(sendMetric);
        onINP(sendMetric);
        onLCP(sendMetric);
        onFCP(sendMetric);
        onTTFB(sendMetric);
    } catch {
        // Fallback performance paint timing if web-vitals fails
        if ('performance' in window && 'getEntriesByType' in performance) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const paint = performance.getEntriesByType('paint');
                    paint.forEach((entry) => {
                        trackEvent('web_vitals', {
                            metric_name: entry.name,
                            metric_value: entry.startTime,
                            metric_id: entry.entryType
                        });
                    });
                }, 3000);
            });
        }
    }
};

// Enhanced Event Tracking
export const trackEvent = (eventName, params = {}) => {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
            ...params,
            page_location: window.location.href,
            page_path: window.location.pathname,
            send_to: 'G-F52S6J4TZV'
        });
    } else {
        window.dataLayer.push({
            event: eventName,
            ...params
        });
    }
};

// Global Error Handler
window.onerror = trackError;

// Global Unhandled Rejection Handler
window.onunhandledrejection = (event) => {
    trackEvent('exception', {
        description: `Unhandled Rejection: ${event.reason}`,
        fatal: false
    });
};
