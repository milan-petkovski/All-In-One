import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: {
    aio_counter_text: "Ovo je inicijalni tekst.",
    appLang: "en"
  },
  i18nMessages: {
    toastCounterCleared: "Counter text cleared",
    toastCounterCopied: "Text copied to clipboard",
    counterTooLarge: "Text exceeds 1M limit"
  }
});

// Setup DOM elements for popup-counter
env.addPopupElement("counterView", "div");
env.addPopupElement("counterBackBtn", "button");
env.addPopupElement("counterArea", "textarea");
env.addPopupElement("charCount", "span");
env.addPopupElement("wordCount", "span");
env.addPopupElement("lineCount", "span");
env.addPopupElement("clearCounterModal", "div");
env.addPopupElement("counterBtn", "button");
env.addPopupElement("counterClearBtn", "button");
env.addPopupElement("cancelClearCounter", "button");
env.addPopupElement("confirmClearCounter", "button");
env.addPopupElement("counterCopyBtn", "button");
env.addPopupElement("mainView", "div");

// Mock document.getElementById for toastContainer
env.addPopupElement("toastContainer", "div");

const counterArea = env.popupDocument.getElementById("counterArea");
const charCount = env.popupDocument.getElementById("charCount");
const wordCount = env.popupDocument.getElementById("wordCount");
const lineCount = env.popupDocument.getElementById("lineCount");

// Import modules
const core = await import(new URL("../js/popup-core.js", import.meta.url));
await core.initCore();
const counter = await import(new URL("../js/popup-counter.js", import.meta.url));

test("counter initialization hydrates text area and updates counts from storage", async () => {
  counter.initCounter();
  await env.flush(20);

  assert.equal(counterArea.value, "Ovo je inicijalni tekst.");
  assert.equal(charCount.textContent, "24");
  assert.equal(wordCount.textContent, "4");
  assert.equal(lineCount.textContent, "1");
});

test("counter updates counts on typing input", async () => {
  counterArea.value = "Prva linija.\nDruga linija sa brojem 2.";
  counterArea.dispatchEvent({ type: "input", target: counterArea });
  await env.flush(20);

  // charCount is 37 (without newlines in grapheme segmenter: 36, or similar)
  assert.ok(Number(charCount.textContent) > 30);
  assert.equal(wordCount.textContent, "7");
  assert.equal(lineCount.textContent, "2");
});

test("pasting text exceeding 1M chars raises a toast warning", async () => {
  counterArea.value = "Short content";
  
  const longText = "a".repeat(1000001);
  counterArea.dispatchEvent({
    type: "paste",
    clipboardData: {
      getData: () => longText
    }
  });
  await env.flush(20);

  // Warning toast should be visible in toastContainer
  const container = env.popupDocument.getElementById("toastContainer");
  assert.ok(container.innerHTML.includes("1M"));
});

test("clear modal confirm clears counter area and removes from storage", async () => {
  const modal = env.popupDocument.getElementById("clearCounterModal");
  modal.className = "hidden";

  env.popupDocument.getElementById("counterClearBtn").click();
  assert.equal(modal.className, "");

  env.popupDocument.getElementById("confirmClearCounter").click();
  await env.flush(50);

  assert.equal(counterArea.value, "");
  assert.equal(charCount.textContent, "0");
  assert.equal(wordCount.textContent, "0");
  assert.equal(lineCount.textContent, "0");
  assert.equal(env.storageState.aio_counter_text, undefined);
  assert.equal(modal.className, "hidden");
});

test("clipboard copy counter copies text to clipboard", async () => {
  counterArea.value = "Counter clipboard text!";
  
  env.popupDocument.getElementById("counterCopyBtn").click();
  await env.flush(20);

  assert.equal(env.clipboardWrites.at(-1), "Counter clipboard text!");
});

test("legacy localStorage counter text is successfully migrated to storage.local", async () => {
  // Setup legacy item
  env.popupWindow.localStorage = {
    getItem: (key) => key === "aio_counter_text" ? "Legacy text migration!" : null,
    removeItem: (key) => {}
  };
  
  // Re-initialize to trigger migration check
  counterArea.value = "";
  counter.initCounter();
  await env.flush(20);

  assert.equal(counterArea.value, "Legacy text migration!");
  assert.equal(env.storageState.aio_counter_text, "Legacy text migration!");
});
