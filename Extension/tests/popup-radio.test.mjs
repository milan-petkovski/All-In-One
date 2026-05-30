import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: { customRadioUrl: "" },
  runtimeResponses: {
    getRadioStatus: { playing: true, volume: 44 },
    toggleRadio: { playing: false },
    playCustomUrl: { ok: true }
  }
});

env.addPopupElement("radioBtn", "button");
env.addPopupElement("radioVol", "input");
env.addPopupElement("radioCardTitle", "div");
env.addPopupElement("radioModalTitle", "div");
env.addPopupElement("radioUrlInput", "input");
env.addPopupElement("radioImportModal", "div");
const preset = env.addPopupElement("preset1", "button");
preset.classList.add("preset-btn");
preset.setAttribute("data-url", "https://radio.example/stream");

const core = await import(new URL("../popup-core.js", import.meta.url));
const radio = await import(new URL("../popup-radio.js", import.meta.url));

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
