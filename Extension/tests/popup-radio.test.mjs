import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: { customRadioUrl: "" },
  runtimeResponses: {
    getRadioStatus: { playing: true, volume: 44 },
    toggleRadio: { playing: false },
    playCustomUrl: { ok: true }
  },
  i18nMessages: {
    toastInvalidRadioUrl: "Nevažeći URL! URL mora početi sa http:// ili https://",
    toastRadioSaved: "URL radio stanice je sačuvan!"
  }
});

env.addPopupElement("radioBtn", "button");
env.addPopupElement("radioVol", "input");
env.addPopupElement("radioCardTitle", "div");
env.addPopupElement("radioModalTitle", "div");
env.addPopupElement("radioUrlInput", "input");
env.addPopupElement("radioImportModal", "div");
env.addPopupElement("toastContainer", "div");

const preset = env.addPopupElement("preset1", "button");
preset.classList.add("preset-btn");
preset.setAttribute("data-url", "https://radio.example/stream");

const core = await import(new URL("../js/popup-core.js", import.meta.url));
const radio = await import(new URL("../js/popup-radio.js", import.meta.url));

// Ensure core.elements references the DOM nodes added by the test harness
core.elements.radioBtn = env.popupDocument.getElementById("radioBtn");
core.elements.radioVol = env.popupDocument.getElementById("radioVol");
core.elements.radioCardTitle = env.popupDocument.getElementById("radioCardTitle");
core.elements.radioModalTitle = env.popupDocument.getElementById("radioModalTitle");
core.elements.radioUrlInput = env.popupDocument.getElementById("radioUrlInput");
core.elements.radioImportModal = env.popupDocument.getElementById("radioImportModal");

test("updateRadioTitle chooses the right label", () => {
  radio.updateRadioTitle("");
  assert.equal(env.popupDocument.getElementById("radioCardTitle").textContent, "Radio IN");
  radio.updateRadioTitle("https://radio.example/stream");
  assert.equal(env.popupDocument.getElementById("radioCardTitle").textContent, "Radio");
});

test("initRadio hydrates controls and persists preset URL", async () => {
  radio.initRadio();
  await env.flush(20);

  const radioBtn = env.popupDocument.getElementById("radioBtn");
  const radioVol = env.popupDocument.getElementById("radioVol");
  assert.equal(radioBtn.innerHTML.includes("<svg"), true);
  assert.equal(radioVol.value, 44);

  preset.click();
  await env.flush(20);
  assert.equal(env.storageState.customRadioUrl, "https://radio.example/stream");
  assert.equal(env.popupDocument.getElementById("radioModalTitle").textContent, "Radio");
  assert.ok(env.runtimeMessages.some((msg) => msg.action === "playCustomUrl"));
});

test("radio volume control sends setRadioVolume and persists volume in storage", async () => {
  const radioVol = env.popupDocument.getElementById("radioVol");
  radioVol.value = 75;
  radioVol.dispatchEvent({ type: "input" });
  await env.flush(150); // wait for persistVolume debounce (120ms)

  assert.ok(env.runtimeMessages.some((msg) => msg.action === "setRadioVolume" && msg.value === 75));
  assert.equal(env.storageState.volume, 75);

  radioVol.value = 80;
  radioVol.dispatchEvent({ type: "change" });
  await env.flush(20);
  assert.equal(env.storageState.volume, 80);
});

test("radio button click toggles state and updates icon", async () => {
  env.runtimeMessages.length = 0;
  const radioBtn = env.popupDocument.getElementById("radioBtn");
  radioBtn.click();
  await env.flush(20);

  assert.ok(env.runtimeMessages.some((msg) => msg.action === "toggleRadio"));
});

test("custom radio URL import modal flows and url validation", async () => {
  const importBtn = env.addPopupElement("importRadioBtn", "button");
  core.elements.importRadioBtn = importBtn;
  const saveBtn = env.addPopupElement("saveRadioUrlBtn", "button");
  core.elements.saveRadioUrlBtn = saveBtn;
  const closeBtn = env.addPopupElement("closeRadioModal", "button");
  core.elements.closeRadioModal = closeBtn;
  const clearBtn = env.addPopupElement("clearRadioInput", "button");
  core.elements.clearRadioInput = clearBtn;

  // re-initialize to bind new elements
  radio.initRadio();
  await env.flush(20);

  const radioImportModal = env.popupDocument.getElementById("radioImportModal");
  const radioUrlInput = env.popupDocument.getElementById("radioUrlInput");

  // click import button opens modal
  importBtn.click();
  await env.flush(20);
  assert.equal(radioImportModal.classList.contains("hidden"), false);

  // invalid url triggers toast
  radioUrlInput.value = "ftp://invalid-url.com";
  saveBtn.click();
  await env.flush(20);
  assert.ok(env.popupDocument.getElementById("toastContainer").innerHTML.includes("Nevažeći URL"));

  // valid url saves and plays custom stream
  env.runtimeMessages.length = 0;
  radioUrlInput.value = "https://custom-stream.com/live.mp3";
  saveBtn.click();
  await env.flush(50);

  assert.equal(env.storageState.customRadioUrl, "https://custom-stream.com/live.mp3");
  assert.equal(radioImportModal.classList.contains("hidden"), true);
  assert.ok(env.runtimeMessages.some((msg) => msg.action === "playCustomUrl" && msg.url === "https://custom-stream.com/live.mp3"));

  // clear input button empty inputs
  radioUrlInput.value = "some text";
  clearBtn.click();
  assert.equal(radioUrlInput.value, "");

  // close modal button hides modal
  radioImportModal.classList.remove("hidden");
  closeBtn.click();
  assert.equal(radioImportModal.classList.contains("hidden"), true);
});
