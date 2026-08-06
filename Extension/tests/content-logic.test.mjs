// Tests for content.js pure helper logic — importing actual js/content.js

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Minimal window/document/chrome mocks so content.js can load in Node environment
globalThis.window = {
  location: { href: 'https://example.com' },
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.document = {
  documentElement: { style: {}, classList: { add() {}, remove() {} }, appendChild() {} },
  body: { style: {}, classList: { add() {}, remove() {} }, appendChild() {} },
  head: { appendChild() {} },
  createElement: (tag) => ({ tagName: String(tag).toUpperCase(), style: {}, classList: { add() {}, remove() {} }, setAttribute: () => {}, remove: () => {} }),
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.chrome = {
  storage: {
    local: { get: (_k, cb) => cb && cb({}), set: () => {} },
    onChanged: { addListener: () => {} }
  },
  runtime: { sendMessage: () => {}, onMessage: { addListener: () => {} } }
};


await import('../js/content.js');

const {
  isSystemPage,
  rgbToHex,
  elementMatchesIntrusiveText,
  isProtectedModal
} = globalThis.aioContentHelpers;

// ----- isSystemPage tests -----

test('isSystemPage — detects all system URL schemes', () => {
  assert.equal(isSystemPage('chrome://extensions'), true);
  assert.equal(isSystemPage('chrome://settings/'), true);
  assert.equal(isSystemPage('edge://settings'), true);
  assert.equal(isSystemPage('about:blank'), true);
  assert.equal(isSystemPage('about:newtab'), true);
  assert.equal(isSystemPage('file:///C:/Users/test.html'), true);
  assert.equal(isSystemPage('devtools://devtools/bundled/inspector.html'), true);
  assert.equal(isSystemPage('view-source:https://example.com'), true);
});

test('isSystemPage — allows normal HTTP/HTTPS URLs', () => {
  assert.equal(isSystemPage('https://example.com'), false);
  assert.equal(isSystemPage('http://localhost:3000'), false);
  assert.equal(isSystemPage('https://chrome.google.com/webstore'), false);
  assert.equal(isSystemPage('https://edge.microsoft.com'), false);
});

// ----- rgbToHex tests -----

test('rgbToHex — converts pure red', () => {
  assert.equal(rgbToHex(255, 0, 0), '#FF0000');
});

test('rgbToHex — converts pure green', () => {
  assert.equal(rgbToHex(0, 255, 0), '#00FF00');
});

test('rgbToHex — converts pure blue', () => {
  assert.equal(rgbToHex(0, 0, 255), '#0000FF');
});

test('rgbToHex — converts white', () => {
  assert.equal(rgbToHex(255, 255, 255), '#FFFFFF');
});

test('rgbToHex — converts black', () => {
  assert.equal(rgbToHex(0, 0, 0), '#000000');
});

test('rgbToHex — converts arbitrary color', () => {
  assert.equal(rgbToHex(18, 52, 86), '#123456');
});

// ----- elementMatchesIntrusiveText tests -----

test('elementMatchesIntrusiveText — detects cookie notices', () => {
  assert.ok(elementMatchesIntrusiveText('We use cookies to improve your experience.'));
  assert.ok(elementMatchesIntrusiveText('Accept all cookies'));
  assert.ok(elementMatchesIntrusiveText('Koristimo kolačiće za bolje iskustvo'));
});

test('elementMatchesIntrusiveText — detects consent dialogs', () => {
  assert.ok(elementMatchesIntrusiveText('GDPR Consent required'));
  assert.ok(elementMatchesIntrusiveText('Please accept our privacy policy'));
  assert.ok(elementMatchesIntrusiveText('Slažem se sa uslovima'));
});

test('elementMatchesIntrusiveText — detects newsletter popups', () => {
  assert.ok(elementMatchesIntrusiveText('Sign up for our newsletter and get updates'));
  assert.ok(elementMatchesIntrusiveText('Subscribe to our email list'));
  assert.ok(elementMatchesIntrusiveText('Pretplatite se na naš newsletter'));
});

test('elementMatchesIntrusiveText — allows legitimate page content', () => {
  assert.equal(elementMatchesIntrusiveText('Welcome to our website! Read our latest articles.'), false);
  assert.equal(elementMatchesIntrusiveText('Contact us for more information about our products.'), false);
  assert.equal(elementMatchesIntrusiveText('Click here to learn more about our services.'), false);
});

test('elementMatchesIntrusiveText — ignores very long text (> 4000 chars)', () => {
  const longText = 'cookie '.repeat(700); // > 4000 chars
  assert.equal(elementMatchesIntrusiveText(longText), false);
});

test('elementMatchesIntrusiveText — handles empty string', () => {
  assert.equal(elementMatchesIntrusiveText(''), false);
});

// ----- isProtectedModal tests -----

function makeFakeElement(id = '', className = '') {
  return { id, className, querySelector: () => null, closest: () => null };
}

test('isProtectedModal — protects login/auth modals from removal', () => {
  assert.ok(isProtectedModal(makeFakeElement('modal-login-form')));
  assert.ok(isProtectedModal(makeFakeElement('sign-in-dialog')));
  assert.ok(isProtectedModal(makeFakeElement('register-overlay')));
  assert.ok(isProtectedModal(makeFakeElement('checkout-modal')));
  assert.ok(isProtectedModal(makeFakeElement('payment-container')));
  assert.ok(isProtectedModal(makeFakeElement('billing-info')));
  assert.ok(isProtectedModal(makeFakeElement('my-account-modal')));
});

test('isProtectedModal — allows removal of cookie-only modals', () => {
  assert.equal(isProtectedModal(makeFakeElement('cookie-banner-wrapper')), false);
  assert.equal(isProtectedModal(makeFakeElement('gdpr-consent-dialog')), false);
  assert.equal(isProtectedModal(makeFakeElement('newsletter-popup')), false);
});
