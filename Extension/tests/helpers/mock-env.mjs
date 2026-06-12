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

export class MockTextNode {
  constructor(text = "", documentRef = null) {
    this.ownerDocument = documentRef;
    this.nodeType = 3;
    this.textContent = String(text);
    this.parentNode = null;
    this.children = [];
  }
  get nodeValue() {
    return this.textContent;
  }
  set nodeValue(value) {
    this.textContent = String(value);
  }
  get innerText() {
    return this.textContent;
  }
  set innerText(value) {
    this.textContent = String(value);
  }
}

export class MockElement {
  constructor(tagName = "div", documentRef = null) {
    this.ownerDocument = documentRef;
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new MockClassList(this);
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this._textContent = "";
    this._innerHTML = "";
    this._className = "";
    this.value = "";
    this.title = "";
    this.placeholder = "";
    this._innerText = "";
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
    if (this.children.length > 0) {
      return this.children.map(child => {
        if (child.nodeType === 3) {
          return child.textContent;
        }
        const attrs = Array.from(child.attributes.entries())
          .map(([k, v]) => ` ${k}="${v}"`)
          .join('');
        return `<${child.tagName.toLowerCase()}${attrs}>${child.innerHTML}</${child.tagName.toLowerCase()}>`;
      }).join('');
    }
    return this._innerHTML || this._textContent || "";
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    this._textContent = "";
    this._innerText = "";
    if (value) {
      const parser = new globalThis.DOMParser();
      const doc = parser.parseFromString(String(value), "text/html");
      const parsedChildren = [...doc.body.children];
      parsedChildren.forEach(child => this.appendChild(child));
    }
  }

  get textContent() {
    return this._textContent || "";
  }

  set textContent(value) {
    this._textContent = String(value);
    this._innerHTML = "";
    this.children = [];
    this._innerText = String(value);
    if (value) {
      const textNode = this.ownerDocument ? this.ownerDocument.createTextNode(String(value)) : new MockTextNode(String(value));
      textNode.parentNode = this;
      this.children.push(textNode);
    }
  }

  get innerText() {
    return this._innerText || this._textContent || "";
  }

  set innerText(value) {
    this._innerText = String(value);
    this._textContent = String(value);
    this._innerHTML = "";
    this.children = [];
    if (value) {
      const textNode = this.ownerDocument ? this.ownerDocument.createTextNode(String(value)) : new MockTextNode(String(value));
      textNode.parentNode = this;
      this.children.push(textNode);
    }
  }

  contains(other) {
    let current = other;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
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

  get childNodes() {
    return this.children;
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get lastChild() {
    return this.children[this.children.length - 1] || null;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx >= 0) {
      if (newChild.nodeType === 11) {
        const fragmentChildren = [...newChild.children];
        this.children.splice(idx, 1);
        oldChild.parentNode = null;
        fragmentChildren.forEach(child => {
          if (child.parentNode) {
            child.parentNode.removeChild(child);
          }
          child.parentNode = this;
        });
        this.children.splice(idx, 0, ...fragmentChildren);
        if (this.ownerDocument) {
          fragmentChildren.forEach(child => this.ownerDocument._registerTree(child));
        }
      } else {
        if (newChild.parentNode) {
          newChild.parentNode.removeChild(newChild);
        }
        this.children[idx] = newChild;
        newChild.parentNode = this;
        oldChild.parentNode = null;
        if (this.ownerDocument) {
          this.ownerDocument._registerTree(newChild);
        }
      }
    }
    return oldChild;
  }

  appendChild(child) {
    assert.ok(child, "appendChild expects a child node");
    if (child.nodeType === 11) {
      const fragmentChildren = [...child.children];
      fragmentChildren.forEach(c => this.appendChild(c));
      return child;
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    if (this.ownerDocument) {
      this.ownerDocument._registerTree(child);
    }
    return child;
  }

  insertBefore(newChild, referenceChild) {
    if (!newChild) return null;
    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }
    if (!referenceChild) {
      return this.appendChild(newChild);
    }
    const idx = this.children.indexOf(referenceChild);
    if (idx < 0) {
      throw new Error("referenceChild is not a child of this node");
    }
    if (newChild.nodeType === 11) {
      const fragmentChildren = [...newChild.children];
      fragmentChildren.forEach(child => {
        child.parentNode = this;
        if (this.ownerDocument) {
          this.ownerDocument._registerTree(child);
        }
      });
      this.children.splice(idx, 0, ...fragmentChildren);
    } else {
      newChild.parentNode = this;
      this.children.splice(idx, 0, newChild);
      if (this.ownerDocument) {
        this.ownerDocument._registerTree(newChild);
      }
    }
    return newChild;
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

  createTextNode(text) {
    const node = new MockTextNode(text, this);
    this._register(node);
    return node;
  }

  createDocumentFragment() {
    const frag = this.createElement('div');
    frag.nodeType = 11;
    frag.tagName = '#document-fragment';
    return frag;
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
    if (element.children) {
      element.children.forEach((child) => this._registerTree(child));
    }
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
    if (!element || element.nodeType !== 1) return false;
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

class DOMParserMock {
  parseFromString(html, type) {
    const doc = new MockDocument();
    const root = doc.createElement('div');
    const tagRegex = /(<[^>]+>|[^<]+)/g;
    const stack = [root];
    let match;
    while ((match = tagRegex.exec(html))) {
      const token = match[0];
      if (token.startsWith('</')) {
        if (stack.length > 1) stack.pop();
      } else if (token.startsWith('<')) {
        const tagMatch = token.match(/<([a-zA-Z1-6]+)/);
        if (tagMatch) {
          const tagName = tagMatch[1];
          const el = doc.createElement(tagName);
          const hrefMatch = token.match(/href="([^"]+)"/) || token.match(/href='([^']+)'/);
          if (hrefMatch) el.setAttribute('href', hrefMatch[1]);
          const styleMatch = token.match(/style="([^"]+)"/) || token.match(/style='([^']+)'/);
          if (styleMatch) el.setAttribute('style', styleMatch[1]);
          
          stack[stack.length - 1].appendChild(el);
          if (!token.endsWith('/>') && !['br', 'img', 'hr'].includes(tagName.toLowerCase())) {
            stack.push(el);
          }
        }
      } else {
        const textNode = doc.createTextNode(token);
        stack[stack.length - 1].appendChild(textNode);
      }
    }
    [...root.children].forEach(child => {
      doc.body.appendChild(child);
    });
    return doc;
  }
}

class MockRange {
  constructor() {
    this.commonAncestorContainer = null;
  }
  selectNodeContents(node) {
    this.commonAncestorContainer = node;
  }
  collapse(toStart) {}
  deleteContents() {
    if (this.commonAncestorContainer) {
      this.commonAncestorContainer.children = [];
      this.commonAncestorContainer.textContent = "";
    }
  }
  insertNode(node) {
    if (this.commonAncestorContainer) {
      this.commonAncestorContainer.appendChild(node);
    }
  }
  setStartAfter(node) {}
  setEndBefore(node) {}
}

class MockTreeWalker {
  constructor(root) {
    this.root = root;
    this.currentNode = null;
    this.allNodes = [];
    const collect = (node) => {
      if (node.nodeType === 3) this.allNodes.push(node);
      if (node.children) node.children.forEach(collect);
    };
    collect(root);
    this.index = -1;
  }
  nextNode() {
    this.index++;
    if (this.index < this.allNodes.length) {
      this.currentNode = this.allNodes[this.index];
      return this.currentNode;
    }
    this.currentNode = null;
    return null;
  }
}

class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }
  readAsText(file) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: file.content || '' } });
      }
    }, 0);
  }
}

const mockSelection = {
  rangeCount: 1,
  getRangeAt: () => new MockRange(),
  removeAllRanges: () => {},
  addRange: () => {}
};

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
    "clearTimeout",
    "localStorage"
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

        let response;
        try {
          globalThis.document = pageDocument;
          globalThis.window = pageWindow;
          globalThis.location = pageWindow.location;
          globalThis.navigator = pageWindow.navigator || globalThis.navigator;
          pageWindow.chrome = { runtime: pageRuntime };
          const result = await details.func(...(details.args || []));
          response = [{ result }];
          chrome.runtime.lastError = null;
        } catch (err) {
          chrome.runtime.lastError = { message: err?.message || "executeScript failed" };
          response = undefined;
        } finally {
          globalThis.document = previous.document;
          globalThis.window = previous.window;
          globalThis.location = previous.location;
          globalThis.navigator = previous.navigator;
          chrome.runtime.lastError = previous.chromeRuntimeLastError;
        }
        if (typeof callback === "function") callback(response);
        return response;
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

  const createLocalStorageMock = () => {
    const store = new Map();
    return {
      getItem: (key) => store.get(String(key)) ?? null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: (key) => store.delete(String(key)),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index) => Array.from(store.keys())[index] || null
    };
  };
  popupWindow.localStorage = createLocalStorageMock();
  pageWindow.localStorage = createLocalStorageMock();

  setGlobal('window', popupWindow);
  setGlobal('document', popupDocument);
  setGlobal('DOMParser', DOMParserMock);
  setGlobal('Node', { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 });
  setGlobal('NodeFilter', { SHOW_TEXT: 4 });
  setGlobal('FileReader', MockFileReader);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { return popupWindow.localStorage; },
    set(v) { popupWindow.localStorage = v; }
  });
  popupDocument.createRange = () => new MockRange();
  pageDocument.createRange = () => new MockRange();
  popupDocument.createTreeWalker = (root) => new MockTreeWalker(root);
  pageDocument.createTreeWalker = (root) => new MockTreeWalker(root);
  popupWindow.getSelection = () => mockSelection;
  pageWindow.getSelection = () => mockSelection;
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
