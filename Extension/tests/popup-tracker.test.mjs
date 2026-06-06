import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: {
    tracker_index: ["tracker_2026_6_5", "tracker_2026_6_6"],
    tracker_2026_6_5: {
      "google.com": 300,
      "facebook.com": 120
    },
    tracker_2026_6_6: {
      "google.com": 100,
      "youtube.com": 600
    },
    appLang: "en"
  },
  tabUrl: "https://google.com/search?q=test",
  i18nMessages: {
    trackerToday: "Today",
    trackerThatDay: "That Day",
    trackerThisMonth: "This Month",
    trackerSelectedMonth: "Selected Month",
    trackerTotal: "Total",
    trackerThisMonthShort: "This Month",
    trackerThatMonth: "That Month",
    trackerAvgTotal: "Avg Total",
    trackerAvgThisMonth: "Avg Month",
    trackerNoData: "No data",
    toastTrackerRefreshed: "Data refreshed",
    toastTrackerExported: "Data exported",
    toastTrackerImported: "Data imported",
    toastTrackerImportError: "Import error"
  },
  runtimeResponses: {
    tracker_force_tick: { ok: true }
  }
});

// Setup DOM elements for popup-tracker
env.addPopupElement("trackerList", "div");
env.addPopupElement("trackerDate", "input");
env.addPopupElement("trackerMode", "select");
env.addPopupElement("trackerDatePrikaz", "input");
env.addPopupElement("importTrackerFile", "input");
env.addPopupElement("trackerSearch", "input");
env.addPopupElement("trackerRefreshBtn", "button");
env.addPopupElement("exportTrackerBtn", "button");
env.addPopupElement("importTrackerBtn", "button");
env.addPopupElement("statTotal", "span");
env.addPopupElement("statMonth", "span");
env.addPopupElement("statAvg", "span");
env.addPopupElement("statTotalLabel", "span");
env.addPopupElement("statMonthLabel", "span");
env.addPopupElement("statAvgLabel", "span");
env.addPopupElement("statBox2", "div");
env.addPopupElement("trackerDateWrapper", "div");
env.addPopupElement("mainView", "div");
env.addPopupElement("trackerView", "div");
env.addPopupElement("trackerBackBtn", "button");
env.addPopupElement("trackerBtn", "button");

// Mock document.getElementById for toastContainer
env.addPopupElement("toastContainer", "div");

const trackerList = env.popupDocument.getElementById("trackerList");
const trackerDate = env.popupDocument.getElementById("trackerDate");
const trackerMode = env.popupDocument.getElementById("trackerMode");
const trackerDatePrikaz = env.popupDocument.getElementById("trackerDatePrikaz");
const statTotal = env.popupDocument.getElementById("statTotal");
const statMonth = env.popupDocument.getElementById("statMonth");
const statAvg = env.popupDocument.getElementById("statAvg");

// Import modules
const core = await import(new URL("../js/popup-core.js", import.meta.url));
await core.initCore();
const tracker = await import(new URL("../js/popup-tracker.js", import.meta.url));

test("tracker initialization sets correct default date and mode and renders stats", async () => {
  tracker.initTracker();
  
  // Click trackerBtn to open and render
  env.popupDocument.getElementById("trackerBtn").click();
  await env.flush(100); // Allow debounced renderStats to execute

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  assert.equal(trackerDate.value, todayIso);
  assert.equal(trackerMode.value, "day");
  assert.ok(statTotal.textContent.length > 0);
  assert.ok(statAvg.textContent.length > 0);
});

test("stats are correctly aggregated in different modes", async () => {
  // Let's manually set a date: 2026-06-06
  trackerDate.value = "2026-06-06";
  trackerDate.dispatchEvent({ type: "change", target: trackerDate });
  await env.flush(100);

  // Day mode for 2026-06-06: google.com (100s) + youtube.com (600s) = 700s (11m 40s)
  assert.equal(statTotal.textContent, "11m 40s");
  assert.ok(trackerList.innerHTML.includes("google.com"));
  assert.ok(trackerList.innerHTML.includes("youtube.com"));

  // Change to all mode
  trackerMode.value = "all";
  trackerMode.dispatchEvent({ type: "change", target: trackerMode });
  await env.flush(100);

  // All mode totals: 300+120+100+600 = 1120s (18m 40s)
  assert.equal(statTotal.textContent, "18m 40s");
  assert.ok(trackerList.innerHTML.includes("facebook.com"));
});

test("searching filters domains dynamically", async () => {
  const searchInput = env.popupDocument.getElementById("trackerSearch");
  
  // Search for google
  searchInput.value = "google";
  searchInput.dispatchEvent({ type: "input", target: searchInput });
  await env.flush(100);

  assert.ok(trackerList.innerHTML.includes("google.com"));
  assert.ok(!trackerList.innerHTML.includes("youtube.com"));
  assert.ok(!trackerList.innerHTML.includes("facebook.com"));

  // Clear search
  searchInput.value = "";
  searchInput.dispatchEvent({ type: "input", target: searchInput });
  await env.flush(100);
});

test("tracker refresh forces tick with cooldown constraint", async () => {
  const refreshBtn = env.popupDocument.getElementById("trackerRefreshBtn");
  
  // Click once (success)
  refreshBtn.click();
  await env.flush(100);

  const container = env.popupDocument.getElementById("toastContainer");
  assert.ok(container.innerHTML.includes("refreshed"));

  // Clear toast HTML
  container.innerHTML = "";

  // Click immediately again (should be ignored due to cooldown)
  refreshBtn.click();
  await env.flush(100);

  assert.ok(!container.innerHTML.includes("refreshed"));
});

test("export tracker backup creates a valid JSON download", async () => {
  const originalCreate = env.popupDocument.createElement.bind(env.popupDocument);
  let downloadUrl = "";
  let downloadFilename = "";
  
  env.popupDocument.createElement = (tag) => {
    const el = originalCreate(tag);
    if (tag === "a") {
      Object.defineProperty(el, "href", {
        set: (val) => { downloadUrl = val; },
        get: () => downloadUrl
      });
      Object.defineProperty(el, "download", {
        set: (val) => { downloadFilename = val; },
        get: () => downloadFilename
      });
      el.click = () => {};
    }
    return el;
  };

  env.popupDocument.getElementById("exportTrackerBtn").click();
  await env.flush(50);
  env.popupDocument.createElement = originalCreate;

  assert.ok(downloadUrl.startsWith("blob:"));
  assert.equal(downloadFilename, "AllInOne_Tracker_Backup.json");
});

test("import tracker restores parsed data to storage", async () => {
  const backupData = {
    tracker_2026_06_10: {
      "github.com": 1200,
      "stackoverflow.com": 500
    }
  };

  const file = {
    name: "backup.json",
    size: 500,
    content: JSON.stringify(backupData)
  };

  const fileInput = env.popupDocument.getElementById("importTrackerFile");
  fileInput.dispatchEvent({
    type: "change",
    target: {
      files: [file]
    }
  });

  await env.flush(100);

  assert.equal(env.storageState.tracker_index.includes("tracker_2026_06_10"), true);
  assert.equal(env.storageState.tracker_2026_06_10["github.com"], 1200);
});
