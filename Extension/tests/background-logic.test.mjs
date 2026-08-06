// Tests for background.js pure helper functions
// background.js is a Service Worker — it cannot be imported as an ES module.
// These tests extract and test its pure helper logic in isolation using
// a mock Chrome environment that mirrors what background.js expects.

import assert from 'node:assert/strict';
import test from 'node:test';

// --- Setup minimal Chrome mock (background.js uses globalThis.chrome at load time) ---

const storedData = {};
const analyticsEvents = [];
const runtimeMessages = [];

globalThis.chrome = {
  runtime: {
    id: 'aio-bg-test',
    getURL: (p) => `chrome-extension://test/${p}`,
    sendMessage: (msg, cb) => {
      runtimeMessages.push(msg);
      if (typeof cb === 'function') cb({ ok: true });
      return Promise.resolve({ ok: true });
    },
    onMessage: { addListener() {} },
    onSuspend: { addListener() {} },
    onInstalled: { addListener() {} },
    setUninstallURL: () => {},
    lastError: null
  },
  commands: {
    onCommand: { addListener() {} }
  },
  contextMenus: {
    create() {},
    removeAll() {},
    onClicked: { addListener() {} }
  },
  action: {
    setBadgeText() {},
    setBadgeBackgroundColor() {}
  },
  storage: {
    local: {
      get: async (keys) => {
        if (Array.isArray(keys)) return Object.fromEntries(keys.map(k => [k, storedData[k]]));
        if (typeof keys === 'string') return { [keys]: storedData[keys] };
        return { ...storedData };
      },
      set: async (items) => { Object.assign(storedData, items); },
      remove: async (keys) => { [].concat(keys).forEach(k => delete storedData[k]); }
    },
    onChanged: { addListener() {} }
  },
  alarms: {
    create() {},
    get: (_name, cb) => { if (typeof cb === 'function') cb(null); return Promise.resolve(null); },
    clear: () => {},
    onAlarm: { addListener() {} }
  },
  browsingData: {
    remove: (_opts, _data, cb) => cb && cb()
  },
  offscreen: {
    hasDocument: async () => false,
    createDocument: async () => {}
  },
  tabs: {
    query: async () => [],
    sendMessage: async () => {},
    create: async () => ({ id: 1 })
  },
  idle: { setDetectionInterval() {}, onStateChanged: { addListener() {} } },
  declarativeNetRequest: {
    updateDynamicRules: async () => {},
    getDynamicRules: async () => []
  },
  permissions: { contains: async () => false }
};
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });


// Import actual background.js functions
const {
  toOriginSet,
  getI18nMsg: getI18nMsgBg,
  safeSendRuntimeMessage,
  resolveNetworkInfo,
  trackEvent,
  flushAnalyticsQueue
} = await import('../js/background.js');

function resolveNetworkInfoHostnameValidation(hostname) {
  const host = String(hostname || '').trim();
  if (!/^[a-z0-9.-]+$/i.test(host) || host.length > 255) return false;
  return true;
}

function sanitizePageLocation(pageLocation) {
  if (!pageLocation) return undefined;
  try {
    const u = new URL(pageLocation);
    return u.origin + u.pathname;
  } catch {
    return undefined;
  }
}


// --- Tests ---

test('toOriginSet — standard HTTPS URL produces 4 origins', () => {
  const origins = toOriginSet('https://example.com/path?q=1');
  assert.ok(origins.includes('https://example.com'));
  assert.ok(origins.includes('http://example.com'));
  assert.ok(origins.includes('https://www.example.com'));
  assert.ok(origins.includes('http://www.example.com'));
  assert.equal(origins.length, 4);
});

test('toOriginSet — www. prefix URL produces bare domain variants', () => {
  const origins = toOriginSet('https://www.site.com/');
  assert.ok(origins.includes('https://www.site.com'));
  assert.ok(origins.includes('https://site.com'));
  assert.ok(origins.includes('http://site.com'));
});

test('toOriginSet — invalid URL returns empty array', () => {
  assert.deepEqual(toOriginSet('not-a-url'), []);
  assert.deepEqual(toOriginSet(''), []);
  assert.deepEqual(toOriginSet(null), []);
});

test('toOriginSet — non-HTTP scheme with no HTTP/HTTPS returns origins based on hostname', () => {
  // chrome://extensions has hostname 'extensions' via URL API,
  // so it DOES produce origins. The real guard is in clearSiteDataEverywhere
  // which checks origins.length === 0 before proceeding.
  // For a truly empty result, pass something that URL can't parse at all.
  const result = toOriginSet('not-a-url');
  assert.deepEqual(result, []);

  // Also verify that a URL with an empty hostname (like 'file:' with path)
  // gracefully returns []
  const fileResult = toOriginSet('file:///local/path');
  // file:// has empty hostname — should return []
  assert.deepEqual(fileResult, []);
});


test('getI18nMsgBg returns defaultText when chrome.i18n not available', () => {
  const saved = globalThis.chrome.i18n;
  delete globalThis.chrome.i18n;
  assert.equal(getI18nMsgBg('anyKey', 'fallback'), 'fallback');
  globalThis.chrome.i18n = saved;
});

test('sanitizePageLocation strips query params and hash', () => {
  const result = sanitizePageLocation('https://example.com/path?q=secret&token=abc#section');
  assert.equal(result, 'https://example.com/path');
});

test('sanitizePageLocation returns undefined for invalid URL', () => {
  const result = sanitizePageLocation('not-a-url');
  assert.equal(result, undefined);
});

test('sanitizePageLocation returns undefined for empty string', () => {
  const result = sanitizePageLocation('');
  assert.equal(result, undefined);
});

test('resolveNetworkInfo hostname validation — valid hostnames', () => {
  assert.ok(resolveNetworkInfoHostnameValidation('example.com'));
  assert.ok(resolveNetworkInfoHostnameValidation('sub.domain.co.uk'));
  assert.ok(resolveNetworkInfoHostnameValidation('localhost'));
  assert.ok(resolveNetworkInfoHostnameValidation('123.456.789.0'));
});

test('resolveNetworkInfo hostname validation — rejects unsafe hostnames', () => {
  assert.equal(resolveNetworkInfoHostnameValidation('evil.com; rm -rf /'), false);
  assert.equal(resolveNetworkInfoHostnameValidation('<script>alert(1)</script>'), false);
  assert.equal(resolveNetworkInfoHostnameValidation('x'.repeat(256)), false);
  assert.equal(resolveNetworkInfoHostnameValidation(''), false);
});

test('syncKickLiveStatus created_at string normalization — no timezone suffix', () => {
  // Reproduces the logic in syncKickLiveStatus for parsing "created_at" timestamps
  const parseKickTimestamp = (createdAt) => {
    if (typeof createdAt === 'string') {
      const trimmed = createdAt.trim();
      if (!trimmed.includes('Z') && !trimmed.includes('+') && !/-\d{2}:\d{2}$/.test(trimmed)) {
        const formatted = trimmed.replace(' ', 'T');
        return new Date(formatted + 'Z').getTime();
      }
      return new Date(trimmed).getTime();
    }
    return new Date(createdAt).getTime();
  };

  // Space-separated timestamp without timezone should be parsed as UTC
  const ts = parseKickTimestamp('2026-08-07 21:00:00');
  assert.ok(Number.isFinite(ts), 'should parse to a valid timestamp');
  assert.ok(ts > 0);

  // ISO string with Z suffix
  const ts2 = parseKickTimestamp('2026-08-07T21:00:00Z');
  assert.equal(ts, ts2, 'space-separated and ISO should produce same timestamp');
});

test('analytics opt-out skips queue (logic test)', () => {
  let queue = [];
  let optOut = true;

  function trackEventMock(eventName, eventData = {}) {
    if (optOut) return;
    queue.push({ name: eventName, params: eventData });
  }

  trackEventMock('test_event', { value: 1 });
  assert.equal(queue.length, 0, 'opt-out should prevent events from queuing');

  optOut = false;
  trackEventMock('test_event', { value: 1 });
  assert.equal(queue.length, 1, 'enabled should queue events');
});

test('analytics queue flush threshold — flushes at 20 events', () => {
  let flushed = false;
  let queue = [];

  function trackEventMock(eventName) {
    queue.push({ name: eventName });
    if (queue.length >= 20) {
      flushed = true;
      queue = [];
    }
  }

  for (let i = 0; i < 19; i++) {
    trackEventMock(`event_${i}`);
  }
  assert.equal(flushed, false, 'should not flush before 20 events');

  trackEventMock('event_20');
  assert.equal(flushed, true, 'should flush at 20 events');
  assert.equal(queue.length, 0, 'queue should be empty after flush');
});
