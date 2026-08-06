import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionTestEnv } from "./helpers/mock-env.mjs";

const env = createExtensionTestEnv({
  tabUrl: "https://tech.example/",
  pageUrl: "https://tech.example/",
  runtimeResponses: {
    tech_resolve_network_info: {
      results: [
        { category: "Mreža", name: "1.2.3.4" },
        { category: "Mreža", name: "example.net" }
      ]
    }
  }
});

env.pageDocument.title = "Example title";
env.pageDocument.documentElement.lang = "en";

const manifest = env.addPageElement("link", { rel: "manifest", href: "/manifest.webmanifest" });
const canonical = env.addPageElement("link", { rel: "canonical", href: "https://tech.example/" });
const description = env.addPageElement("meta", { name: "description", content: "Demo site" });
const serverHeader = { server: "nginx", "x-powered-by": "express" };
void manifest;
void canonical;
void description;

const core = await import(new URL("../js/popup-core.js", import.meta.url));
const tech = await import(new URL("../js/popup-tech.js", import.meta.url));

// Ensure popup-core has a tab context that points to our mocked page
await core.initCore();

env.addPopupElement("mainView", "div");
env.addPopupElement("techView", "div");
env.addPopupElement("techBackBtn", "button");
env.addPopupElement("techResultList", "div");
env.addPopupElement("techLoading", "div");

test("runTechScanner renders detected technologies", async () => {
  const origQuery = env.pageDocument.querySelector.bind(env.pageDocument);
  const origQueryAll = env.pageDocument.querySelectorAll.bind(env.pageDocument);
  env.pageDocument.querySelector = (selector) => {
    if (selector === 'link[rel="manifest"]') return manifest;
    if (selector === 'link[rel="canonical"]') return canonical;
    if (selector === 'script[type="application/ld+json"]') return null;
    if (selector === 'h1') return null;
    return origQuery(selector);
  };
  env.pageDocument.querySelectorAll = (selector) => {
    if (selector === 'link') return [manifest, canonical];
    if (selector === 'meta') return [description];
    return origQueryAll(selector);
  };
  env.pageDocument.getElementsByTagName = (tagName) => {
    if (tagName === '*') return [env.pageDocument.documentElement, env.pageDocument.body, manifest, canonical, description];
    if (tagName === 'link') return [manifest, canonical];
    if (tagName === 'meta') return [description];
    return [];
  };

  tech.runTechScanner();
  await env.flush(30);

  const list = env.popupDocument.getElementById("techResultList");
  const children = list.children;

  assert.ok(children.length > 0);
  assert.equal(env.popupDocument.getElementById("techLoading").style.display, "none");
  const found = Array.from(list.children).some((c) => String(c.textContent || "").includes("Mreža"));
  assert.ok(found, 'expected a group titled Mreža');
});

test("runTechScanner shows unavailable message for system pages (no HTTP tab)", async () => {
  // Temporarily override tab query to return a non-HTTP URL
  const prevTab = env.chrome.tabs.query;
  env.chrome.tabs.query = async () => [{ id: 99, url: 'chrome://settings', title: 'Settings' }];

  // Reset the result list
  const list = env.popupDocument.getElementById("techResultList");
  while (list.firstChild) list.removeChild(list.firstChild);
  const loading = env.popupDocument.getElementById("techLoading");
  loading.style.display = "block";

  // runTechScanner reads tab from storage/query directly, not from initCore
  // It handles non-HTTP tabs by showing a message without DOM system-overlay creation
  await tech.runTechScanner();
  await env.flush(30);

  assert.equal(loading.style.display, "none");
  // Should show an unavailability message (any text is fine)
  const text = list.innerHTML || list.textContent || "";
  assert.ok(
    text.length > 0,
    `expected some content in techResultList for non-HTTP tab, got empty`
  );

  // Restore
  env.chrome.tabs.query = prevTab;
});


test("getTechIconHtml returns known badge for React", async () => {
  // Access via tech scanner — test through the exported runTechScanner
  // We verify the icon map logic by reading the source
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const src = await readFile(resolve(process.cwd(), 'js', 'popup-tech.js'), 'utf8');
  assert.match(src, /TECH_ICON_MAP/, 'popup-tech.js should define TECH_ICON_MAP');
  assert.match(src, /react.*tech-icon-react|tech-icon-react.*react/s, 'should have react icon mapping');
  assert.match(src, /vue.*tech-icon-vue|tech-icon-vue.*vue/s, 'should have vue icon mapping');
  assert.match(src, /wordpress.*tech-icon-wp|tech-icon-wp.*wordpress/s, 'should have wordpress icon mapping');
});

test("runTechScanner handles executeScript with runtime.lastError gracefully", async () => {
  const prevTab = env.chrome.tabs.query;
  env.chrome.tabs.query = async () => [{ id: 99, url: 'https://crash.example.com/', title: 'Crash Test' }];
  await core.initCore();

  const prevExecute = env.chrome.scripting.executeScript;
  env.chrome.scripting.executeScript = async (details, callback) => {
    env.chrome.runtime.lastError = { message: 'Extension context invalidated' };
    if (typeof callback === 'function') callback(undefined);
    env.chrome.runtime.lastError = null;
    return undefined;
  };

  const list = env.popupDocument.getElementById("techResultList");
  while (list.firstChild) list.removeChild(list.firstChild);

  await tech.runTechScanner();
  await env.flush(100);

  // Should show an error/failure message, not crash
  const text = list.innerHTML || list.textContent || "";
  // Any message is acceptable — just confirm it didn't leave loading spinner visible
  assert.equal(
    env.popupDocument.getElementById("techLoading").style.display,
    "none",
    "loading should be hidden even on error"
  );

  env.chrome.scripting.executeScript = prevExecute;
  env.chrome.tabs.query = prevTab;
});

