import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  storage: {
    mojeBeleske: "Hello <b>world</b>!",
    appLang: "en"
  },
  tabUrl: "https://notes-demo.example/",
  tabTitle: "Notes Tab Title",
  i18nMessages: {
    notesSaved: "Saved",
    notesTooLarge: "Note too large",
    notesLinkText: "Link",
    toastNotesCleared: "Notes cleared",
    toastNotesExported: "Notes exported",
    toastNotesImported: "Notes imported",
    toastNotesImportError: "Notes import error",
    toastNotesCopied: "Text copied to clipboard!"
  }
});

// Setup DOM elements for popup-notes
env.addPopupElement("noteArea", "div");
env.addPopupElement("saveIndicator", "span");
env.addPopupElement("clearNotesModal", "div");
env.addPopupElement("notesBtn", "button");
env.addPopupElement("backBtn", "button");
env.addPopupElement("notesClearBtn", "button");
env.addPopupElement("cancelClearNotes", "button");
env.addPopupElement("confirmClearNotes", "button");
env.addPopupElement("grabTextBtn", "button");
env.addPopupElement("addUrlBtn", "button");
env.addPopupElement("addDateBtn", "button");
env.addPopupElement("exportNotesBtn", "button");
env.addPopupElement("importNotesBtn", "button");
env.addPopupElement("importFileInput", "input");
env.addPopupElement("notesCopyBtn", "button");
env.addPopupElement("mainView", "div");
env.addPopupElement("notesView", "div");

// Mock document.getElementById for toastContainer just in case
env.addPopupElement("toastContainer", "div");

const noteArea = env.popupDocument.getElementById("noteArea");
noteArea.isContentEditable = true;

// Import module
const core = await import(new URL("../js/popup-core.js", import.meta.url));
await core.initCore();
const notes = await import(new URL("../js/popup-notes.js", import.meta.url));

test("notes initialization loads and sanitizes content from storage", async () => {
  notes.initNotes();
  await env.flush(20);

  assert.equal(noteArea.innerHTML, "Hello <b>world</b>!");
});

test("grabbing text appends it to noteArea", async () => {
  // Mock window.getSelection for the page view script
  env.pageWindow.getSelection = () => ({
    toString: () => "grabbed website text"
  });

  env.popupDocument.getElementById("grabTextBtn").click();
  await env.flush(20);

  assert.ok(noteArea.innerHTML.includes("grabbed website text"));
});

test("addUrlBtn appends canonical active tab link", async () => {
  env.popupDocument.getElementById("addUrlBtn").click();
  await env.flush(20);

  assert.ok(noteArea.innerHTML.includes('href="https://notes-demo.example/"'));
  assert.ok(noteArea.innerHTML.includes('Notes Tab Title'));
});

test("addDateBtn appends localized timestamp", async () => {
  env.popupDocument.getElementById("addDateBtn").click();
  await env.flush(20);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en");
  assert.ok(noteArea.innerHTML.includes(dateStr));
});

test("auto-calculator evaluates expression on input event", async () => {
  noteArea.innerText = "Kupio 3 jabuke i 4 banane, ukupno = 5 + 4 = ";
  noteArea.dispatchEvent({ type: "input" });
  await env.flush(100);

  assert.ok(noteArea.innerHTML.includes("= 5 + 4 = <b>9</b>"));
});

test("clear notes modal confirm empties notes and updates storage", async () => {
  const modal = env.popupDocument.getElementById("clearNotesModal");
  modal.className = "hidden";

  env.popupDocument.getElementById("notesClearBtn").click();
  assert.equal(modal.className, "");

  env.popupDocument.getElementById("confirmClearNotes").click();
  await env.flush(50);

  assert.equal(noteArea.innerHTML, "");
  assert.equal(env.storageState.mojeBeleske, "");
  assert.equal(modal.className, "hidden");
});

test("export notes backups note HTML content", async () => {
  noteArea.innerHTML = "Exportable HTML content";
  
  // Spy on document.createElement for download link
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

  env.popupDocument.getElementById("exportNotesBtn").click();
  env.popupDocument.createElement = originalCreate;

  assert.ok(downloadUrl.startsWith("blob:"));
  assert.equal(downloadFilename, "beleske_backup.html");
});

test("import notes restores HTML content from file reader", async () => {
  const file = {
    name: "backup.html",
    size: 200,
    content: "Imported <i>verified</i> content"
  };

  const fileInput = env.popupDocument.getElementById("importFileInput");
  
  // Simulate file input change event
  fileInput.dispatchEvent({
    type: "change",
    target: {
      files: [file],
      value: "backup.html"
    }
  });
  await env.flush(400);
  assert.equal(noteArea.innerHTML, "Imported <i>verified</i> content");
  assert.equal(env.storageState.mojeBeleske, "Imported <i>verified</i> content");
});

test("clipboard copy button writes notes text to clipboard", async () => {
  noteArea.innerText = "Copy me to clipboard!";
  
  env.popupDocument.getElementById("notesCopyBtn").click();
  await env.flush(20);

  assert.equal(env.clipboardWrites.at(-1), "Copy me to clipboard!");
});
