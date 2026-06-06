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
