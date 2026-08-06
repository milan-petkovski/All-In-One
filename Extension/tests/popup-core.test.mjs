import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: { appLang: "ar" },
  localeDict: {
    hello_key: { message: "Zdravo" },
    with_placeholder: { message: "Unesi tekst" },
    title_key: { message: "Naslov" },
    toast_key: { message: "Poruka" }
  },
  tabUrl: "https://demo.example/path"
});

const core = await import(new URL("../js/popup-core.js", import.meta.url));

const makeDom = () => {
  const i18n = env.addPopupElement("i18nNode");
  i18n.setAttribute("data-i18n", "hello_key");
  const placeholder = env.addPopupElement("placeholderNode");
  placeholder.setAttribute("data-i18n-placeholder", "with_placeholder");
  const title = env.addPopupElement("titleNode");
  title.setAttribute("data-i18n-title", "title_key");
  env.addPopupElement("mainView");
  env.addPopupElement("notesView");
  env.addPopupElement("counterView");
  env.addPopupElement("noteArea", "textarea");
  env.addPopupElement("counterArea", "textarea");
  return { i18n, placeholder, title };
};

test("escapeHtml and getI18nMsg resolve correctly", () => {
  assert.equal(core.escapeHtml(`a & b < c > d "e" 'f'`), "a &amp; b &lt; c &gt; d &quot;e&quot; &#039;f&#039;");
  // Provide in-memory translations so getI18nMsg resolves during unit tests
  window.i18nDict = {
    hello_key: { message: "Zdravo" },
    with_placeholder: { message: "Unesi tekst" },
    title_key: { message: "Naslov" },
    toast_key: { message: "Poruka" }
  };
  // debug dump (removed)
  assert.equal(core.getI18nMsg("hello_key", "fallback"), "Zdravo");
  assert.equal(core.getI18nMsg("missing_key", "fallback"), "fallback");
});

test("switchView and showToast update the popup DOM", async () => {
  makeDom();
  const fromEl = env.popupDocument.getElementById("mainView");
  const toEl = env.popupDocument.getElementById("notesView");
  fromEl.classList.add("view-visible");
  core.switchView("mainView", "notesView");
  assert.ok(toEl.classList.contains("view-visible"));
  await env.flush(320);
  assert.ok(fromEl.classList.contains("view-hidden"));

  core.showToast("A", "info");
  core.showToast("B", "success");
  core.showToast("C", "error");
  core.showToast("D", "info");
  const toasts = env.popupDocument.getElementById("toastContainer").querySelectorAll(".toast:not(.toast-fade-out)");
  assert.equal(toasts.length, 3);
});

test("initCore applies rtl and translations", async () => {
  makeDom();
  await core.initCore();
  assert.equal(env.popupDocument.documentElement.getAttribute("dir"), "rtl");
  assert.equal(env.popupDocument.getElementById("i18nNode").textContent, "Zdravo");
  assert.equal(env.popupDocument.getElementById("placeholderNode").getAttribute("placeholder"), "Unesi tekst");
  assert.equal(env.popupDocument.getElementById("titleNode").getAttribute("title"), "Naslov");
  assert.equal(core.currentLang, "ar");
});

test("trackEvent catches errors silently when chrome is unavailable", () => {
  const savedChrome = globalThis.chrome;
  globalThis.chrome = undefined;
  // Must not throw
  assert.doesNotThrow(() => core.trackEvent("test_event", { value: 1 }));
  globalThis.chrome = savedChrome;
});

test("escapeHtml returns empty string for falsy input", () => {
  assert.equal(core.escapeHtml(""), "");
  assert.equal(core.escapeHtml(null), "");
  assert.equal(core.escapeHtml(undefined), "");
  assert.equal(core.escapeHtml(0), "");
});

test("getI18nMsg falls back through chain: dict → chrome.i18n → defaultText", () => {
  window.i18nDict = null;
  // With no dict and no chrome.i18n message, returns defaultText
  assert.equal(core.getI18nMsg("no_such_key", "my fallback"), "my fallback");
});

test("switchView isBack=true animates reverse direction", async () => {
  makeDom();
  const mainView = env.popupDocument.getElementById("mainView");
  const notesView = env.popupDocument.getElementById("notesView");
  notesView.classList.add("view-visible");
  notesView.classList.remove("view-hidden");
  mainView.classList.add("view-hidden");

  core.switchView("notesView", "mainView", true);
  // toEl (mainView) should be becoming visible
  assert.ok(mainView.classList.contains("view-visible") || !mainView.classList.contains("view-hidden"));
  // fromEl (notesView) should be sliding away
  assert.ok(notesView.classList.contains("view-slide-right") || notesView.classList.contains("view-hidden"));
});

test("showToast enforces max 3 active toasts and evicts oldest", async () => {
  makeDom();
  // Force fast fade-out
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms = 0, ...args) => realTimeout(fn, Math.min(Number(ms), 5), ...args);
  try {
    core.showToast("T1", "info");
    core.showToast("T2", "success");
    core.showToast("T3", "error");
    core.showToast("T4", "info"); // 4th — oldest should be evicted
    const container = env.popupDocument.getElementById("toastContainer");
    const active = container.querySelectorAll(".toast:not(.toast-fade-out)");
    assert.equal(active.length, 3);
  } finally {
    globalThis.setTimeout = realTimeout;
  }
});

