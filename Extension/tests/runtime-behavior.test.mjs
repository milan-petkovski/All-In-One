import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockEnvironment } from './mock-env.mjs';

const localeMessages = {
  en: {
    systemPageTitle: { message: 'SYSTEM PAGE' },
    systemPageDesc: { message: 'Tools are disabled on system pages' },
    toastDarkModeOn: { message: 'Dark mode enabled' },
    toastDarkModeOff: { message: 'Dark mode disabled' },
    toastStopwatchCleared: { message: 'Stopwatch history cleared' },
    techScannerUnavailable: { message: 'Scanner unavailable on this page' },
    radioTitle: { message: 'Radio IN' },
    radioTitleCustom: { message: 'Custom Radio' },
    swStatusLive: { message: 'LIVE' },
    swStatusReady: { message: 'READY' },
    swNoHistory: { message: 'No history' },
    swNoLaps: { message: 'No laps' },
    swUndoTitle: { message: 'Delete this lap' },
    swLiveTitlePrefix: { message: 'Session #' },
    swDurationLabel: { message: 'Duration: ' },
    swMomentLabel: { message: 'Moment ' },
    swExportTxtBtn: { message: 'EXPORT TXT' },
    swCopyBtn: { message: 'COPY' },
    swCopiedBtn: { message: 'COPIED' },
    swTotalDurationPrefix: { message: 'TOTAL DURATION: ' },
    toastCacheCleared: { message: 'Cache cleared' },
    toastPermissionDenied: { message: 'Permission denied' },
    toastCookieOn: { message: 'Cookie blocking enabled' },
    toastCookieOff: { message: 'Cookie blocking disabled' },
    toastCookieWhitelistOn: { message: 'Cookies allowed for this site' },
    toastCookieWhitelistOff: { message: 'Cookies blocked for this site' },
    toastCookieWhitelistError: { message: 'Whitelist update failed' },
    cacheNotSupported: { message: 'Not supported' },
    cacheClearing: { message: 'Clearing...' },
    cacheError: { message: 'Error' },
    cacheClearConfirm: { message: 'Clear all data from this site' }
  },
  sr: {
    systemPageTitle: { message: 'SISTEMSKA STRANICA' },
    systemPageDesc: { message: 'Alati za modifikaciju su onemogućeni' },
    toastDarkModeOn: { message: 'Tamni režim aktiviran' },
    toastDarkModeOff: { message: 'Svetli režim aktiviran' },
    toastStopwatchCleared: { message: 'Istorija lajvova je obrisana!' },
    techScannerUnavailable: { message: 'Skener nije dostupan na ovoj stranici.' },
    radioTitle: { message: 'Radio IN' },
    radioTitleCustom: { message: 'Radio' }
  }
};

const env = createMockEnvironment({
  appLang: 'en',
  tab: {
    id: 1,
    url: 'https://example.com/dashboard',
    title: 'Example Dashboard'
  },
  locales: localeMessages
});

const create = (tagName, attrs = {}, parent = env.document.body) => {
  const el = env.createElement(tagName, attrs);
  parent.appendChild(el);
  return el;
};

const seedDom = () => {
  create('div', { id: 'mainView', className: 'view-visible' });
  create('div', { id: 'notesView', className: 'sub-view hidden' });
  create('div', { id: 'counterView', className: 'sub-view hidden' });
  create('div', { id: 'techView', className: 'sub-view hidden' });
  create('div', { id: 'stopwatchView', className: 'sub-view hidden' });

  create('button', { id: 'radioBtn' });
  create('input', { id: 'radioVol', type: 'range' });
  create('input', { id: 'masterVol', type: 'range', className: 'range-slider', value: '100' });
  create('span', { id: 'volText' });
  create('button', { id: 'colorBtn' });
  create('input', { id: 'nightToggle', type: 'checkbox' });
  create('input', { id: 'copyToggle', type: 'checkbox' });
  create('input', { id: 'ytToggle', type: 'checkbox' });
  create('button', { id: 'rulerBtn' });
  create('button', { id: 'markerBtn' });
  create('button', { id: 'resetVolBtn' });
  create('button', { id: 'clearCacheBtn' });
  create('button', { id: 'fontBtn' });
  create('button', { id: 'notesBtn' });
  create('button', { id: 'trackerBtn' });
  create('button', { id: 'counterBtn' });
  create('button', { id: 'stopwatchBtn' });
  create('div', { id: 'cookieModal' });
  create('input', { id: 'cookieToggle', type: 'checkbox' });
  create('input', { id: 'cookieWhitelistToggle', type: 'checkbox' });
  create('button', { id: 'closeCookieModal' });
  create('button', { id: 'realClearBtn' });
  create('button', { id: 'importRadioBtn' });
  create('div', { id: 'radioImportModal', className: 'hidden' });
  create('input', { id: 'radioUrlInput' });
  create('button', { id: 'saveRadioUrlBtn' });
  create('button', { id: 'closeRadioModal' });
  create('button', { id: 'clearRadioInput' });
  create('div', { id: 'radioCardTitle' });
  create('div', { id: 'radioModalTitle' });
  create('select', { id: 'langSelect' });
  create('div', { id: 'whatsNewOverlay', className: 'hidden' });
  create('button', { id: 'closeWhatsNewBtn' });
  create('div', { id: 'whatsNewTitle' });
  create('div', { id: 'whatsNewDesc' });
  create('div', { id: 'whatsNewDate' });
  create('div', { id: 'whatsNewFeatures' });
  create('textarea', { id: 'noteArea' });
  create('textarea', { id: 'counterArea' });

  create('div', { id: 'techLoading' });
  create('div', { id: 'techResultList' });
  create('div', { id: 'customModal', className: 'hidden' });
  create('div', { id: 'timer' });
  create('div', { id: 'status' });
  create('ul', { id: 'laps' });
  create('div', { id: 'history-list' });
  create('button', { id: 'start' });
  create('button', { id: 'stop' });
  create('button', { id: 'lap' });
  create('button', { id: 'swBackBtn' });
  create('button', { id: 'clear-history' });
  create('button', { id: 'cancelClear' });
  create('button', { id: 'confirmClear' });

  const i18nLabel = create('div', { id: 'i18nLabel' });
  i18nLabel.setAttribute('data-i18n', 'systemPageTitle');
  const i18nPlaceholder = create('input', { id: 'i18nPlaceholder' });
  i18nPlaceholder.setAttribute('data-i18n-placeholder', 'systemPageDesc');
  const i18nTitle = create('button', { id: 'i18nTitleBtn' });
  i18nTitle.setAttribute('data-i18n-title', 'toastDarkModeOn');

  create('div', { className: 'card clickable', id: 'clickableCard' });
  create('input', { className: 'range-slider', id: 'secondarySlider', type: 'range', value: '50' });
  create('button', { className: 'preset-btn active', id: 'presetOne' }).setAttribute('data-url', 'https://radio.example/one');
  create('button', { className: 'preset-btn', id: 'presetTwo' }).setAttribute('data-url', 'https://radio.example/two');
  create('div', { id: 'mainFocusable', tabindex: '0' });
}

seedDom();

const core = await import('../js/popup-core.js');
const radio = await import('../js/popup-radio.js');
const tech = await import('../js/popup-tech.js');
const stopwatch = await import('../js/popup-stopwatch.js');

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test('core helpers preserve escaping, i18n fallback, and runtime event payloads', async () => {
  env.window.i18nDict = {
    customKey: { message: 'Custom message' }
  };

  assert.equal(core.escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#039;');
  assert.equal(core.getI18nMsg('customKey', 'fallback'), 'Custom message');
  assert.equal(core.getI18nMsg('missingKey', 'fallback text'), 'fallback text');

  await core.initCore();
  core.trackEvent('test_event', { foo: 'bar' });

  const message = env.state.runtimeMessages.at(-1);
  assert.equal(message.action, 'aio_track_event');
  assert.equal(message.eventName, 'test_event');
  assert.equal(message.eventData.foo, 'bar');
  assert.equal(message.eventData.page_location, 'https://example.com/dashboard');
  assert.equal(message.eventData.page_title, 'Example Dashboard');
});

test('initCore applies translations, dir, and system-page overlay', async () => {
  env.setTab({
    id: 1,
    url: 'https://example.com/dashboard',
    title: 'Example Dashboard'
  });
  env.window.i18nDict = null;
  env.document.documentElement.setAttribute('dir', 'ltr');

  await core.initCore();

  assert.equal(env.document.documentElement.getAttribute('dir'), 'ltr');
  assert.equal(core.currentLang, 'en');
  assert.equal(core.elements.radioBtn.id, 'radioBtn');
  assert.equal(env.document.getElementById('i18nLabel').textContent, 'SYSTEM PAGE');
  assert.equal(env.document.getElementById('i18nLabel').getAttribute('title'), 'SYSTEM PAGE');
  assert.equal(env.document.getElementById('i18nPlaceholder').getAttribute('placeholder'), 'Tools are disabled on system pages');
  assert.equal(env.document.getElementById('i18nTitleBtn').getAttribute('title'), 'Dark mode enabled');

  env.setTab({
    id: 1,
    url: 'chrome://extensions',
    title: 'Extensions'
  });
  await core.initCore();

  assert.ok(env.document.body.classList.contains('restricted-session'));
  assert.ok(env.document.getElementById('mainView').querySelector('.restricted-overlay'));
});

test('switchView and showToast manage transitions and toast stacking', async () => {
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms = 0, ...args) => {
    let delay = Number(ms) || 0;
    if (delay === 3000) delay = 100;
    else delay = Math.min(delay, 15);
    return realSetTimeout(fn, delay, ...args);
  };
  try {
    const fromEl = env.document.getElementById('mainView');
    const toEl = env.document.getElementById('notesView');
    fromEl.className = 'view-visible';
    toEl.className = 'sub-view hidden';

    core.switchView('mainView', 'notesView');
    assert.ok(toEl.classList.contains('view-visible'));
    assert.ok(fromEl.classList.contains('view-slide-left'));

    await wait(25);
    await wait(25);
    assert.ok(fromEl.classList.contains('view-hidden'));

    core.showToast('One', 'info');
    core.showToast('Two', 'success');
    core.showToast('Three', 'error');
    core.showToast('Four', 'info');

    await wait(25);
    await wait(25);
    const container = env.document.getElementById('toastContainer');
    assert.ok(container);
    assert.equal(container.querySelectorAll('.toast:not(.toast-fade-out)').length, 3);
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});

test('radio title follows custom url and default label', async () => {
  env.window.i18nDict = {
    radioTitleCustom: { message: 'Custom Radio' },
    radioTitle: { message: 'Radio IN' }
  };

  radio.updateRadioTitle('https://stream.example/live');
  assert.equal(env.document.getElementById('radioCardTitle').textContent, 'Custom Radio');
  assert.equal(env.document.getElementById('radioModalTitle').textContent, 'Custom Radio');

  radio.updateRadioTitle('');
  assert.equal(env.document.getElementById('radioCardTitle').textContent, 'Radio IN');
  assert.equal(env.document.getElementById('radioModalTitle').textContent, 'Radio IN');
});

test('tech scanner exits cleanly on unsupported pages', async () => {
  env.setTab({
    id: 1,
    url: 'chrome://extensions',
    title: 'Extensions'
  });
  env.window.i18nDict = null;

  await core.initCore();
  await tech.runTechScanner();

  assert.equal(env.document.getElementById('techLoading').style.display, 'none');
  assert.match(env.document.getElementById('techResultList').innerHTML, /Scanner unavailable|Skener nije dostupan/);
});

test('stopwatch renders history, supports lap deletion, and appends a session on stop', async () => {
  env.setTab({
    id: 1,
    url: 'https://example.com/dashboard',
    title: 'Example Dashboard'
  });
  env.window.i18nDict = null;
  await env.chrome.storage.local.set({
    isRunning: true,
    startTime: Date.now() - 6000,
    currentLaps: [1500, 3500, 6000],
    history: [{ sessionStart: Date.now() - 6000, laps: [1500, 3500, 6000] }]
  });

  stopwatch.initStopwatch();

  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms = 0, ...args) => realSetTimeout(fn, Math.min(Number(ms) || 0, 15), ...args);
  try {
    env.document.getElementById('stopwatchBtn').click();
    await wait(100);
    await wait(100);
    await wait(100);

    const lapsList = env.document.getElementById('laps');
    const historyList = env.document.getElementById('history-list');
    assert.ok(lapsList.children.length > 0);
    assert.ok(historyList.children.length > 0);

    const undoButtons = lapsList.querySelectorAll('.lap-undo-btn');
    const undoButton = undoButtons[1];
    assert.ok(undoButton);
    undoButton.click();
    await wait(100);
    await wait(100);
    await wait(100);

    assert.deepEqual(env.state.storage.currentLaps, [1500, 6000]);

    env.document.getElementById('stop').click();
    await wait(100);
    await wait(100);
    await wait(100);

    assert.equal(env.state.storage.isRunning, false);
    assert.equal(env.state.storage.currentLaps.length, 0);
    assert.equal(env.state.storage.history.length, 2);
    assert.deepEqual(env.state.storage.history.at(-1).laps, [1500, 6000]);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    env.window.dispatchEvent({ type: 'beforeunload' });
  }
});

test('markerBtn click triggers executeScript with the correct file path and sends initMarker message', async () => {
  env.setTab({
    id: 42,
    url: 'https://example.com/marker-test',
    title: 'Marker Test'
  });
  
  let executedDetails = null;
  let sentMessage = null;

  env.chrome.scripting.executeScript = async (details, callback) => {
    executedDetails = details;
    if (typeof callback === 'function') {
      callback();
    }
    return [{ result: true }];
  };

  await core.initCore();

  const markerBtn = env.document.getElementById('markerBtn');
  assert.ok(markerBtn);

  const originalSendMessage = env.chrome.tabs.sendMessage;
  env.chrome.tabs.sendMessage = (tabId, message, callback) => {
    sentMessage = { tabId, message };
    if (typeof callback === 'function') callback({ ok: true });
    return Promise.resolve({ ok: true });
  };

  try {
    markerBtn.click();
    await wait(50);

    assert.ok(executedDetails);
    assert.deepEqual(executedDetails.target, { tabId: 42 });
    assert.deepEqual(executedDetails.files, ['js/marker_engine.js']);
    assert.ok(sentMessage);
    assert.equal(sentMessage.tabId, 42);
    assert.deepEqual(sentMessage.message, { action: 'initMarker' });
  } finally {
    env.chrome.tabs.sendMessage = originalSendMessage;
  }
});

