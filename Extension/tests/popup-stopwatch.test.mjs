import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: {
    isRunning: false,
    startTime: 0,
    currentLaps: [],
    history: []
  },
  runtimeResponses: {
    sw_start_session: { ok: true },
    manual_lap: { ok: true }
  }
});

[
  ["mainView", "div"],
  ["stopwatchView", "div"],
  ["stopwatchBtn", "button"],
  ["swBackBtn", "button"],
  ["start", "button"],
  ["lap", "button"],
  ["stop", "button"],
  ["clear-history", "button"],
  ["cancelClear", "button"],
  ["confirmClear", "button"],
  ["customModal", "div"],
  ["timer", "div"],
  ["status", "div"],
  ["laps", "ul"],
  ["history-list", "div"]
].forEach(([id, tag]) => env.addPopupElement(id, tag));

env.popupDocument.getElementById("stopwatchView").classList.add("view-visible");

const stopwatch = await import(new URL("../js/popup-stopwatch.js", import.meta.url));
const core = await import(new URL("../js/popup-core.js", import.meta.url));

test("start button activates a running session", async () => {
  stopwatch.initStopwatch();
  env.popupDocument.getElementById("start").click();
  await env.flush(20);
  assert.equal(env.storageState.isRunning, true);
  assert.equal(Array.isArray(env.storageState.currentLaps), true);
  assert.ok(env.runtimeMessages.some((msg) => msg.action === "sw_start_session"));
});

test("stop button appends session history and clears running state", async () => {
  env.storageState.isRunning = true;
  env.storageState.startTime = 1000;
  env.storageState.currentLaps = [5000, 10000];
  env.storageState.history = [];
  env.popupDocument.getElementById("stop").click();
  await env.flush(40);
  assert.equal(env.storageState.isRunning, false);
  assert.equal(env.storageState.history.length, 1);
  assert.equal(env.storageState.history[0].laps.length, 2);
  assert.equal(env.storageState.history[0].laps[0], 5000);
  assert.equal(env.storageState.history[0].laps[1], 10000);
  assert.equal(env.storageState.currentLaps.length, 0);
});

test("stop button does not save session if no laps recorded", async () => {
  env.storageState.isRunning = true;
  env.storageState.startTime = 1000;
  env.storageState.currentLaps = [];
  env.storageState.history = [];
  env.popupDocument.getElementById("stop").click();
  await env.flush(40);
  assert.equal(env.storageState.isRunning, false);
  assert.equal(env.storageState.history.length, 0);
  assert.equal(env.storageState.currentLaps.length, 0);
});

test("clear-history modal empties history", async () => {
  env.storageState.history = [{ sessionStart: 1000, laps: [2000] }];
  env.popupDocument.getElementById("clear-history").click();
  assert.equal(env.popupDocument.getElementById("customModal").classList.contains("hidden"), false);
  env.popupDocument.getElementById("confirmClear").click();
  await env.flush(20);
  assert.deepEqual(env.storageState.history, []);
  assert.equal(env.popupDocument.getElementById("customModal").classList.contains("hidden"), true);
});

test("keyboard shortcut triggers lap while stopwatch view is visible", async () => {
  env.runtimeMessages.length = 0;
  env.popupDocument.dispatchEvent({ type: "keydown", altKey: true, shiftKey: true, key: "l" });
  await env.flush(10);
  assert.ok(env.runtimeMessages.some((msg) => msg.action === "manual_lap"));
});
