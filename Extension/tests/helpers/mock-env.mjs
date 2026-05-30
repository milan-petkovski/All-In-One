import assert from "node:assert/strict";

export class MockClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...tokens) {
    tokens.filter(Boolean).forEach((token) => this.values.add(String(token)));
    this._sync();
  }

  remove(...tokens) {
    tokens.filter(Boolean).forEach((token) => this.values.delete(String(token)));
    this._sync();
  }

  contains(token) {
    return this.values.has(String(token));
  }

  toggle(token, force) {
    const name = String(token);
    if (force === true) {
      this.values.add(name);
      this._sync();
      return true;
    }
    if (force === false) {
      this.values.delete(name);
      this._sync();
      return false;
    }
    if (this.values.has(name)) {
      this.values.delete(name);
      this._sync();
      return false;
    }
    this.values.add(name);
    this._sync();
    return true;
  }

  toString() {
    return [...this.values].join(" ");
  }

  _sync() {
    if (this.owner) {
      this.owner._className = this.toString();
    }
  }
}

export class MockElement {
  constructor(tagName = "div", documentRef = null) {
    this.ownerDocument = documentRef;
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new MockClassList(this);
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.textContent = "";
    this._innerHTML = "";
    this._className = "";
    this.value = "";
    this.title = "";
    this.placeholder = "";
    this.innerText = "";
    this.isContentEditable = false;
    this.focused = false;
    this.removed = false;
    this.onclick = null;
  }

  get id() {
    return this.attributes.get("id") || "";
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.attributes.set("class", String(value));
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    this.classList._sync();
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
  }

  get innerText() {
    return this.textContent;
  }

  set innerText(value) {
    this.textContent = String(value);
  }

  setAttribute(name, value) {
    const key = String(name);
    const val = String(value);
    this.attributes.set(key, val);
    if (key === "class") {
      this.className = val;
      return;
    }
    if (key === "id" && this.ownerDocument) {
      this.ownerDocument._registerId(val, this);
    }
    if (key.startsWith("data-")) {
      const dataKey = key
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[dataKey] = val;
    }
  }

  getAttribute(name) {
    const key = String(name);
    if (key === "class") {
      return this.classList.toString();
    }
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === "class") {
      this.classList.values.clear();
      this.classList._sync();
    }
  }

  appendChild(child) {
    assert.ok(child, "appendChild expects a child node");
    child.parentNode = this;
    this.children.push(child);
    if (this.ownerDocument) {
      this.ownerDocument._registerTree(child);
    }
    return child;
  }

  remove() {
    this.removed = true;
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }
  }

  focus() {
    this.focused = true;
  }

  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const payload = typeof event === "string" ? { type: event } : { ...(event || {}) };
    payload.target = payload.target || this;
    const handlers = this.listeners.get(payload.type) || [];
    handlers.forEach((handler) => handler.call(this, payload));
    if (payload.type === "click" && typeof this.onclick === "function") {
      this.onclick.call(this, payload);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  querySelectorAll(selector) {
    if (!this.ownerDocument) return [];
    return this.ownerDocument._querySelectorAll(selector, this);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class MockDocument {
  constructor(url = "https://example.test/") {
    this.title = "";
    this.characterSet = "UTF-8";
    this._listeners = new Map();
    this._all = [];
    this._byId = new Map();
    this.documentElement = new MockElement("html", this);
    this.body = new MockElement("body", this);
    this.defaultView = null;
    this.documentElement.appendChild(this.body);
    this.documentElement.setAttribute("dir", "ltr");
    this.location = new URL(url);
  }

  createElement(tagName) {
    const element = new MockElement(tagName, this);
    this._register(element);
    return element;
  }

  getElementById(id) {
    return this._byId.get(String(id)) || null;
  }

  querySelectorAll(selector) {
    return this._querySelectorAll(selector, null);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getElementsByTagName(tagName) {
    const normalized = String(tagName).toLowerCase();
    if (normalized === "*") {
      return [...this._all];
    }
    return this._all.filter((element) => element.tagName.toLowerCase() === normalized);
  }

  addEventListener(type, handler) {
    const listeners = this._listeners.get(type) || [];
    listeners.push(handler);
    this._listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const payload = typeof event === "string" ? { type: event } : { ...(event || {}) };
    const handlers = this._listeners.get(payload.type) || [];
    handlers.forEach((handler) => handler.call(this, payload));
    return true;
  }

  get images() {
    return this.getElementsByTagName("img");
  }

  get links() {
    return this.getElementsByTagName("a");
  }

  get forms() {
    return this.getElementsByTagName("form");
  }
  get scripts() {
    return this.getElementsByTagName("script");
  }

  _register(element) {
    if (!this._all.includes(element)) {
      this._all.push(element);
    }
    if (element.id) {
      this._byId.set(element.id, element);
    }
  }

  _registerId(id, element) {
    this._byId.set(String(id), element);
  }

  _registerTree(element) {
    this._register(element);
    element.children.forEach((child) => this._registerTree(child));
  }

  _isDescendantOf(element, root) {
    if (!root) return true;
    let current = element;
    while (current) {
      if (current === root) return true;
      current = current.parentNode;
    }
    return false;
  }

  _querySelectorAll(selector, root) {
    const cleaned = String(selector).trim();
    if (!cleaned) return [];
    if (cleaned.includes(" ")) {
      const parts = cleaned.split(/\s+/);
      let current = [root || this.documentElement];
      parts.forEach((part) => {
        const next = [];
        current.forEach((scope) => {
          next.push(...this._querySelectorAll(part, scope));
        });
        current = next;
      });
      return current;
    }

    const candidates = root ? this._descendants(root) : this._all;
    return candidates.filter((element) => this._matchesSelector(element, cleaned));
  }

  _descendants(root) {
    const result = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        result.push(child);
        walk(child);
      });
    };
    walk(root);
    return result;
  }

  _matchesSelector(element, selector) {
    const trimmed = selector.trim();
    if (!trimmed) return false;

    if (trimmed.includes(",")) {
      return trimmed.split(",").some((part) => this._matchesSelector(element, part));
    }

    if (trimmed.includes(":not(")) {
      const match = trimmed.match(/^(.*):not\((.*)\)$/);
      if (!match) return false;
      return this._matchesSelector(element, match[1]) && !this._matchesSelector(element, match[2]);
    }

    let working = trimmed;
    const idMatch = working.match(/^#([\w-]+)$/);
    if (idMatch) {
      return element.id === idMatch[1];
    }

    const classPrefix = working.startsWith(".");
    if (classPrefix) {
      const classMatch = working.match(/^((?:\.[\w-]+)+)(.*)$/);
      if (!classMatch) return false;
      const classNames = classMatch[1].split(".").filter(Boolean);
      if (!classNames.every((className) => element.classList.contains(className))) return false;
      working = classMatch[2] || "";
    }

    const tagMatch = working.match(/^[a-zA-Z][\w-]*/);
    if (tagMatch) {
      const tagName = tagMatch[0].toLowerCase();
      if (element.tagName.toLowerCase() !== tagName) return false;
      working = working.slice(tagMatch[0].length);
    }

    const attrRegex = /\[([^\]=*]+)(\*?=)?(?:"([^"]*)"|'([^']*)'|([^\]]*))?\]/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(working))) {
      const attrName = attrMatch[1].trim();
      const operator = attrMatch[2] || null;
      const expected = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? "";
      const actual = element.getAttribute(attrName);
      if (!operator) {
        if (actual == null) return false;
      } else if (operator === "=") {
        if (String(actual ?? "") !== expected) return false;
      } else if (operator === "*=") {
        if (!String(actual ?? "").includes(expected)) return false;
      }
    }

    if (working.includes(".")) {
      const extraClasses = working.split(".").slice(1).filter(Boolean);
      if (!extraClasses.every((className) => element.classList.contains(className))) return false;
    }

    return true;
  }
}

function createMockWindow(documentRef, href) {
  const listeners = new Map();
  const location = new URL(href);
  return {
    document: documentRef,
    location,
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((item) => item !== handler));
    },
    dispatchEvent(event) {
      const payload = typeof event === "string" ? { type: event } : { ...(event || {}) };
      const handlers = listeners.get(payload.type) || [];
      handlers.forEach((handler) => handler.call(this, payload));
      return true;
    }
  };
}

function normalizeStorageKeys(keys, storageState) {
  if (keys == null) {
    return { ...storageState };
  }
  if (typeof keys === "string") {
    return { [keys]: storageState[keys] };
  }
  if (Array.isArray(keys)) {
    return keys.reduce((acc, key) => {
      acc[key] = storageState[key];
      return acc;
    }, {});
  }
  if (typeof keys === "object") {
    return Object.entries(keys).reduce((acc, [key, fallback]) => {
      acc[key] = Object.prototype.hasOwnProperty.call(storageState, key) ? storageState[key] : fallback;
      return acc;
    }, {});
  }
  return {};
}

export function createExtensionTestEnv(options = {}) {
  const storageState = { ...(options.storage || {}) };
  const storageListeners = new Set();
  const runtimeMessages = [];
  const runtimeResponses = options.runtimeResponses || {};
  const runtimeOnMessageListeners = new Set();
  const popupDocument = new MockDocument(options.popupUrl || "chrome-extension://test/popup.html");
  const popupWindow = createMockWindow(popupDocument, options.popupUrl || "chrome-extension://test/popup.html");
  const pageDocument = options.pageDocument || new MockDocument(options.pageUrl || (options.tabUrl || "https://example.test/"));
  const pageWindow = createMockWindow(pageDocument, options.pageUrl || (options.tabUrl || "https://example.test/"));
  popupDocument.defaultView = popupWindow;
  pageDocument.defaultView = pageWindow;

  const originalGlobals = new Map();
  const remember = (key) => originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  [
    "window",
    "document",
    "location",
    "navigator",
    "chrome",
    "fetch",
    "URL",
    "Blob",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "setTimeout",
    "clearTimeout"
  ].forEach(remember);

  const clipboardWrites = [];
  const clipboard = {
    async writeText(text) {
      clipboardWrites.push(String(text));
    }
  };

  const restore = () => {
    originalGlobals.forEach((desc, key) => {
      try {
        if (typeof desc === "undefined" || desc === null) {
          try { delete globalThis[key]; } catch (_) { }
          return;
        }
        Object.defineProperty(globalThis, key, desc);
      } catch (_) {
        try {
          if (desc && Object.prototype.hasOwnProperty.call(desc, 'value')) {
            globalThis[key] = desc.value;
          }
        } catch (__ignore) { }
      }
    });
  };

  const setGlobal = (key, value) => {
    try {
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
      return true;
    } catch (e) {
      try { globalThis[key] = value; return true; } catch (_) { return false; }
    }
  };

  const fireStorageChange = (changes) => {
    storageListeners.forEach((listener) => {
      try {
        listener(changes, "local");
      } catch (_) {
        // Ignore listener failures in tests.
      }
    });
  };

  const localStorageApi = {
    async get(keys, callback) {
      const result = normalizeStorageKeys(keys, storageState);
      if (typeof callback === "function") callback(result);
      return result;
    },
    async set(items, callback) {
      const changes = {};
      Object.entries(items || {}).forEach(([key, value]) => {
        const oldValue = storageState[key];
        storageState[key] = value;
        changes[key] = { oldValue, newValue: value };
      });
      fireStorageChange(changes);
      if (typeof callback === "function") callback();
      return undefined;
    },
    async remove(keys, callback) {
      const items = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      items.filter(Boolean).forEach((key) => {
        const oldValue = storageState[key];
        delete storageState[key];
        changes[key] = { oldValue, newValue: undefined };
      });
      fireStorageChange(changes);
      if (typeof callback === "function") callback();
      return undefined;
    }
  };

  const pageRuntime = {
    get lastError() {
      return null;
    }
  };

  const chrome = {
    runtime: {
      id: "test-extension-id",
      lastError: null,
      getURL(path) {
        return `chrome-extension://test/${String(path).replace(/^\//, "")}`;
      },
      getManifest() {
        return options.manifest || { version: "1.5.3" };
      },
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        const handler = runtimeResponses[message?.action];
        let response = handler;
        if (typeof handler === "function") {
          response = handler(message);
        }
        if (response === undefined && message?.action === "aio_track_event") {
          response = { ok: true };
        }
        if (response === undefined && message?.action === "sw_start_session") {
          response = { ok: true };
        }
        if (response === undefined && message?.action === "manual_lap") {
          response = { ok: true };
        }
        if (response === undefined && message?.action === "getRadioStatus") {
          response = { playing: false, volume: 30 };
        }
        chrome.runtime.lastError = null;
        if (typeof callback === "function") {
          callback(response);
        }
        return Promise.resolve(response);
      },
      onMessage: {
        addListener(listener) {
          runtimeOnMessageListeners.add(listener);
        }
      }
    },
    i18n: {
      getMessage(key) {
        return options.i18nMessages?.[key] || "";
      }
    },
    tabs: {
      async query() {
        return options.tabs || [{ id: 1, url: options.tabUrl || "https://example.test/", title: options.tabTitle || "Example" }];
      },
      async sendMessage(_tabId, message, callback) {
        return chrome.runtime.sendMessage(message, callback);
      },
      async captureVisibleTab(_windowId, _options, callback) {
        const response = options.captureTabResponse || "data:image/png;base64,AAA";
        if (typeof callback === "function") callback(response);
        return response;
      }
    },
    storage: {
      local: localStorageApi,
      onChanged: {
        addListener(listener) {
          storageListeners.add(listener);
        },
        removeListener(listener) {
          storageListeners.delete(listener);
        }
      }
    },
    scripting: {
      async executeScript(details, callback) {
        const previous = {
          document: globalThis.document,
          window: globalThis.window,
          location: globalThis.location,
          navigator: globalThis.navigator,
          chromeRuntimeLastError: chrome.runtime.lastError
        };

        try {
          globalThis.document = pageDocument;
          globalThis.window = pageWindow;
          globalThis.location = pageWindow.location;
          globalThis.navigator = pageWindow.navigator || globalThis.navigator;
          pageWindow.chrome = { runtime: pageRuntime };
          const result = await details.func(...(details.args || []));
          const response = [{ result }];
          chrome.runtime.lastError = null;
          if (typeof callback === "function") callback(response);
          return response;
        } catch (err) {
          chrome.runtime.lastError = { message: err?.message || "executeScript failed" };

          if (typeof callback === "function") callback(undefined);
          return undefined;
        } finally {
          globalThis.document = previous.document;
          globalThis.window = previous.window;
          globalThis.location = previous.location;
          globalThis.navigator = previous.navigator;
          chrome.runtime.lastError = previous.chromeRuntimeLastError;
        }
      }
    }
  };

  const fetchMock = async (input, init) => {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (url.includes("_locales/") && url.endsWith("messages.json")) {
      return {
        ok: true,
        status: 200,
        json: async () => options.localeDict || {},
        headers: {
          get: () => null
        }
      };
    }
    if ((init?.method || "GET").toUpperCase() === "HEAD") {
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            return options.headHeaders?.[String(name).toLowerCase()] || null;
          }
        },
        json: async () => ({})
      };
    }
    if (options.fetchResponse) {
      return typeof options.fetchResponse === "function"
        ? options.fetchResponse(input, init)
        : options.fetchResponse;
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({})
    };
  };

  setGlobal('window', popupWindow);
  setGlobal('document', popupDocument);
  setGlobal('location', popupWindow.location);
  setGlobal('navigator', {
    language: options.language || "en-US",
    clipboard,
    userAgent: options.userAgent || "node-test"
  });
  setGlobal('chrome', chrome);
  setGlobal('fetch', fetchMock);
  if (!globalThis.Blob) {
    setGlobal('Blob', class Blob { });
  }
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = () => "blob:mock";
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = () => { };
  }
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  popupWindow.navigator = globalThis.navigator;
  pageWindow.navigator = globalThis.navigator;
  popupWindow.chrome = chrome;
  pageWindow.chrome = chrome;

  return {
    chrome,
    popupDocument,
    popupWindow,
    pageDocument,
    pageWindow,
    storageState,
    runtimeMessages,
    runtimeOnMessageListeners,
    clipboardWrites,
    addPopupElement(id, tagName = "div") {
      const el = popupDocument.createElement(tagName);
      el.id = id;
      popupDocument.body.appendChild(el);
      return el;
    },
    addPageElement(tagName = "div", attrs = {}, textContent = "") {
      const el = pageDocument.createElement(tagName);
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      if (textContent) el.textContent = textContent;
      pageDocument.body.appendChild(el);
      return el;
    },
    async flush(ms = 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
    restore
  };
}
