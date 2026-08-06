// Tests for popup-settings.js initSettings() wiring
// and popup.js lazy-loading smoke test

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createExtensionTestEnv } from './helpers/mock-env.mjs';

const root = path.resolve(process.cwd());

// ---------- popup-settings.js ----------

const settingsEnv = createExtensionTestEnv({
  storage: {},
  tabUrl: 'https://example.com/',
  manifest: { version: '1.5.5' }
});

// DOM elements that initSettings() hooks into
[
  ['settingsBtn', 'button'],
  ['settingsBackBtn', 'button'],
  ['settingsView', 'div'],
  ['mainView', 'div'],
  ['verNum', 'span'],
  ['donateBtn', 'button'],
  ['webBtn', 'button'],
  ['portalBtn', 'button'],
  ['rateBtn', 'button'],
  ['privacyLink', 'a']
].forEach(([id, tag]) => settingsEnv.addPopupElement(id, tag));

// Track tabs.create calls
const tabsCreated = [];
settingsEnv.chrome.tabs.create = (details) => {
  tabsCreated.push(details);
  return Promise.resolve({ id: 999, ...details });
};

// Import popup-core so global state is initialized
await import(new URL('../js/popup-core.js', import.meta.url));
const settingsMod = await import(new URL('../js/popup-settings.js', import.meta.url));

test('initSettings sets verNum to manifest version', () => {
  settingsMod.initSettings();
  const verNum = settingsEnv.popupDocument.getElementById('verNum');
  assert.equal(verNum.innerText, '1.5.5');
});

test('settingsBtn click triggers switchView to settingsView', async () => {
  settingsMod.initSettings();
  const settingsView = settingsEnv.popupDocument.getElementById('settingsView');
  settingsView.classList.remove('view-visible');
  settingsEnv.popupDocument.getElementById('settingsBtn').click();
  await settingsEnv.flush(10);
  assert.ok(settingsView.classList.contains('view-visible'), 'settingsView should become visible');
});

test('settingsBackBtn click triggers switchView back to mainView', async () => {
  settingsMod.initSettings();
  const mainView = settingsEnv.popupDocument.getElementById('mainView');
  mainView.classList.remove('view-visible');
  settingsEnv.popupDocument.getElementById('settingsBackBtn').click();
  await settingsEnv.flush(10);
  assert.ok(!mainView.classList.contains('view-hidden'), 'mainView should not be hidden after back nav');
});

test('donateBtn opens paypal.me URL', () => {
  settingsMod.initSettings();
  const prevLen = tabsCreated.length;
  settingsEnv.popupDocument.getElementById('donateBtn').click();
  const newTabs = tabsCreated.slice(prevLen);
  assert.ok(newTabs.some(t => t.url.includes('paypal.me')), 'donateBtn should open paypal.me');
});

test('webBtn opens allinone.milanwebportal.com', () => {
  settingsMod.initSettings();
  const prevLen = tabsCreated.length;
  settingsEnv.popupDocument.getElementById('webBtn').click();
  const newTabs = tabsCreated.slice(prevLen);
  assert.ok(newTabs.some(t => t.url.includes('allinone.milanwebportal.com')), 'webBtn should open AIO website');
});

test('rateBtn opens Chrome Web Store', () => {
  settingsMod.initSettings();
  const prevLen = tabsCreated.length;
  settingsEnv.popupDocument.getElementById('rateBtn').click();
  const newTabs = tabsCreated.slice(prevLen);
  assert.ok(newTabs.some(t => t.url.includes('chromewebstore.google.com')), 'rateBtn should open CWS');
});

test('privacyLink opens privacy page on click', () => {
  settingsMod.initSettings();
  const prevLen = tabsCreated.length;
  // The mock element's click() dispatches an event without preventDefault.
  // Patch it temporarily so the handler does not throw.
  const link = settingsEnv.popupDocument.getElementById('privacyLink');
  const origDispatch = link.dispatchEvent?.bind(link);
  link.dispatchEvent = (ev) => {
    if (!ev.preventDefault) ev.preventDefault = () => {};
    if (!ev.stopPropagation) ev.stopPropagation = () => {};
    return origDispatch ? origDispatch(ev) : undefined;
  };
  link.click();
  link.dispatchEvent = origDispatch;
  const newTabs = tabsCreated.slice(prevLen);
  assert.ok(newTabs.some(t => t.url.includes('/privacy')), 'privacyLink should open privacy page');
});



// ---------- popup.js structural smoke tests ----------

test('popup.html loads popup.js as module entry', async () => {
  const popup = await readFile(path.join(root, 'popup.html'), 'utf8');
  assert.match(popup, /<script type="module" src="js\/popup\.js"><\/script>/);
});

test('popup.js imports initCore from popup-core.js', async () => {
  const src = await readFile(path.join(root, 'js', 'popup.js'), 'utf8');
  assert.match(src, /import.*initCore.*from.*popup-core\.js/);
});

test('popup.js lazy-loads all feature modules', async () => {
  const src = await readFile(path.join(root, 'js', 'popup.js'), 'utf8');
  const expected = [
    'popup-radio.js',
    'popup-notes.js',
    'popup-tracker.js',
    'popup-counter.js',
    'popup-stopwatch.js',
    'popup-settings.js',
    'popup-tech.js'
  ];
  for (const mod of expected) {
    assert.match(src, new RegExp(mod.replace('.', '\\.')), `popup.js should reference ${mod}`);
  }
});

test('popup.js has module-load error handling (showToast fallback)', async () => {
  const src = await readFile(path.join(root, 'js', 'popup.js'), 'utf8');
  assert.match(src, /toastModuleLoadError/,
    'popup.js should handle module load errors with toastModuleLoadError key');
});

test('popup.js uses requestIdleCallback for prefetch with setTimeout fallback', async () => {
  const src = await readFile(path.join(root, 'js', 'popup.js'), 'utf8');
  assert.match(src, /requestIdleCallback/, 'popup.js should use requestIdleCallback');
  assert.match(src, /setTimeout.*prefetch|prefetch.*setTimeout/s, 'popup.js should have a setTimeout fallback');
});
