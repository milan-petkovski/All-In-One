export function createMockEnvironment(options = {}) {
  const state = {
    storage: {
      appLang: options.appLang || 'en',
      ...(options.storage || {})
    },
    tab: options.tab || {
      id: 1,
      url: 'https://example.com/',
      title: 'Example Page'
    },
    sentMessages: [],
    runtimeMessages: [],
    fetchedUrls: [],
    clipboardText: '',
    listeners: {
      storageChanged: [],
      runtimeMessage: [],
      suspend: []
    }
  };

  const createClassList = (element) => {
    const classSet = new Set();
    const sync = () => {
      element.attributes.class = Array.from(classSet).join(' ');
    };
    return {
      add: (...names) => {
        names.flat().filter(Boolean).forEach((name) => classSet.add(String(name)));
        sync();
      },
      remove: (...names) => {
        names.flat().filter(Boolean).forEach((name) => classSet.delete(String(name)));
        sync();
      },
      contains: (name) => classSet.has(String(name)),
      toggle: (name, force) => {
        const value = String(name);
        const shouldAdd = force === undefined ? !classSet.has(value) : Boolean(force);
        if (shouldAdd) classSet.add(value);
        else classSet.delete(value);
        sync();
        return shouldAdd;
      },
      toString: () => Array.from(classSet).join(' '),
      _setFromString: (value) => {
        classSet.clear();
        String(value || '').split(/\s+/).filter(Boolean).forEach((name) => classSet.add(name));
        sync();
      }
    };
  };

  class FakeElement {
    constructor(document, tagName = 'div') {
      this.ownerDocument = document;
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.dataset = {};
      this.style = {};
      this.eventListeners = new Map();
      this.classList = createClassList(this);
      this.id = '';
      this.disabled = false;
      this.value = '';
      this.checked = false;
      this._text = '';
      this._html = '';
      this._innerText = '';
      this.isContentEditable = false;
      this.offsetParent = document.body;
    }

    set innerHTML(value) {
      this._html = String(value);
      this.children = [];
    }

    get innerHTML() {
      return this._html;
    }

    set textContent(value) {
      this._text = String(value);
    }

    get textContent() {
      return this._text;
    }

    set innerText(value) {
      this._innerText = String(value);
      this._text = String(value);
    }

    get innerText() {
      return this._innerText || this._text;
    }

    setAttribute(name, value) {
      const key = String(name);
      const text = String(value);
      this.attributes[key] = text;
      if (key === 'id') {
        this.id = text;
        this.ownerDocument._registerElement(this);
      } else if (key === 'class') {
        this.classList._setFromString(text);
      } else if (key.startsWith('data-')) {
        const datasetKey = key
          .slice(5)
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[datasetKey] = text;
      }
    }

    getAttribute(name) {
      const key = String(name);
      if (key === 'class') return this.classList.toString();
      if (key === 'id') return this.id || null;
      return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
    }

    hasAttribute(name) {
      const key = String(name);
      return key === 'class'
        ? this.classList.toString().length > 0
        : key === 'id'
          ? Boolean(this.id)
          : Object.prototype.hasOwnProperty.call(this.attributes, key);
    }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      this.ownerDocument._registerTree(child);
      return child;
    }

    append(...nodes) {
      nodes.forEach((node) => this.appendChild(node));
    }

    remove() {
      if (!this.parentNode) return;
      const siblings = this.parentNode.children || [];
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
      this.parentNode = null;
    }

    addEventListener(type, handler) {
      if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
      this.eventListeners.get(type).push(handler);
    }

    dispatchEvent(event) {
      const evt = event || {};
      evt.target = evt.target || this;
      const handlers = this.eventListeners.get(evt.type) || [];
      handlers.forEach((handler) => handler(evt));
      const direct = this[`on${evt.type}`];
      if (typeof direct === 'function') direct(evt);
      return true;
    }

    click() {
      this.dispatchEvent({ type: 'click', preventDefault() { }, stopPropagation() { } });
    }

    focus() {
      this.ownerDocument.activeElement = this;
    }

    querySelectorAll(selector) {
      return this.ownerDocument.querySelectorAllWithin(this, selector);
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 20 };
    }

    get offsetHeight() {
      return 0;
    }
  }

  const parseSelector = (selector) => {
    const trimmed = String(selector).trim();
    const notMatch = trimmed.match(/:not\((.+)\)$/);
    const base = notMatch ? trimmed.slice(0, notMatch.index).trim() : trimmed;
    const negate = notMatch ? notMatch[1].trim() : null;
    const parts = { tag: null, id: null, classes: [], attrs: [] };

    let remainder = base;
    const tagMatch = remainder.match(/^[a-zA-Z][\w-]*/);
    if (tagMatch) {
      parts.tag = tagMatch[0].toUpperCase();
      remainder = remainder.slice(tagMatch[0].length);
    }

    const tokenRegex = /([.#][\w-]+)|(\[[^\]]+\])/g;
    let tokenMatch;
    while ((tokenMatch = tokenRegex.exec(remainder))) {
      const token = tokenMatch[0];
      if (token.startsWith('.')) {
        parts.classes.push(token.slice(1));
      } else if (token.startsWith('#')) {
        parts.id = token.slice(1);
      } else if (token.startsWith('[')) {
        const attrMatch = token.slice(1, -1).match(/^([^=\s]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]+)))?$/);
        if (attrMatch) {
          parts.attrs.push({ name: attrMatch[1], value: attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? null });
        }
      }
    }

    return { base: parts, negate };
  };

  const matchesSimpleSelector = (element, selector) => {
    const { base, negate } = parseSelector(selector);
    if (base.tag && element.tagName !== base.tag) return false;
    if (base.id && element.id !== base.id) return false;
    if (base.classes.some((className) => !element.classList.contains(className))) return false;
    for (const attr of base.attrs) {
      if (!element.hasAttribute(attr.name)) return false;
      if (attr.value !== null && element.getAttribute(attr.name) !== attr.value) return false;
    }
    if (negate && matchesSimpleSelector(element, negate)) return false;
    return true;
  };

  class FakeDocument {
    constructor() {
      this.listeners = new Map();
      this.title = options.title || 'All In One';
      this.activeElement = null;
      this.documentElement = new FakeElement(this, 'html');
      this.body = new FakeElement(this, 'body');
      this.documentElement.appendChild(this.body);
      this.documentElement.setAttribute('dir', 'ltr');
      this.elementsById = new Map();
    }

    createElement(tagName) {
      return new FakeElement(this, tagName);
    }

    _registerElement(element) {
      if (element.id) this.elementsById.set(element.id, element);
    }

    _registerTree(element) {
      if (!element) return;
      if (element.id) this._registerElement(element);
      element.children.forEach((child) => this._registerTree(child));
    }

    getElementById(id) {
      return this.elementsById.get(String(id)) || null;
    }

    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    }

    dispatchEvent(event) {
      const handlers = this.listeners.get(event.type) || [];
      handlers.forEach((handler) => handler(event));
    }

    querySelectorAllWithin(root, selector) {
      const selectors = String(selector).split(',').map((item) => item.trim()).filter(Boolean);
      const results = [];
      const seen = new Set();

      const visit = (node) => {
        if (!node) return;
        if (selectors.some((item) => matchesSimpleSelector(node, item)) && !seen.has(node)) {
          seen.add(node);
          results.push(node);
        }
        node.children.forEach(visit);
      };

      visit(root);
      return results;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      return this.querySelectorAllWithin(this.documentElement, selector);
    }
  }

  const document = new FakeDocument();
  const window = {
    document,
    location: { href: options.locationHref || 'https://example.com/popup.html' },
    i18nDict: options.i18nDict || null,
    close: () => {
      window.closed = true;
    },
    addEventListener: (type, handler) => document.addEventListener(type, handler),
    removeEventListener: () => { },
    dispatchEvent: (event) => document.dispatchEvent(event)
  };
  window.window = window;

  const emitStorageChanged = (changes, areaName = 'local') => {
    state.listeners.storageChanged.forEach((listener) => listener(changes, areaName));
  };

  const readStorage = (keys) => {
    if (Array.isArray(keys)) {
      return keys.reduce((acc, key) => {
        acc[key] = state.storage[key];
        return acc;
      }, {});
    }
    if (typeof keys === 'string') {
      return { [keys]: state.storage[keys] };
    }
    if (keys && typeof keys === 'object') {
      return Object.keys(keys).reduce((acc, key) => {
        acc[key] = state.storage[key] ?? keys[key];
        return acc;
      }, {});
    }
    return { ...state.storage };
  };

  const chrome = {
    i18n: {
      getMessage: (key) => {
        const dict = options.chromeMessages || {};
        return dict[key] || '';
      }
    },
    runtime: {
      id: 'aio-test-runtime',
      getURL: (path) => `chrome-extension://test/${String(path).replace(/^\//, '')}`,
      getManifest: () => ({ version: options.version || '1.5.3' }),
      lastError: null,
      sendMessage: (payload, callback) => {
        state.runtimeMessages.push(payload);
        const response = typeof options.onRuntimeMessage === 'function'
          ? options.onRuntimeMessage(payload, state)
          : { ok: true };
        if (typeof callback === 'function') callback(response);
        return Promise.resolve(response);
      },
      onMessage: {
        addListener: (listener) => {
          state.listeners.runtimeMessage.push(listener);
        }
      },
      onSuspend: {
        addListener: (listener) => {
          state.listeners.suspend.push(listener);
        }
      }
    },
    storage: {
      onChanged: {
        addListener: (listener) => {
          state.listeners.storageChanged.push(listener);
        }
      },
      local: {
        get: (keys, callback) => {
          const result = readStorage(keys);
          if (typeof callback === 'function') {
            callback(result);
            return undefined;
          }
          return Promise.resolve(result);
        },
        set: (entries, callback) => {
          const changes = {};
          Object.entries(entries || {}).forEach(([key, value]) => {
            const oldValue = state.storage[key];
            state.storage[key] = value;
            changes[key] = { oldValue, newValue: value };
          });
          emitStorageChanged(changes, 'local');
          if (typeof callback === 'function') callback();
          return Promise.resolve();
        },
        remove: (keys, callback) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const changes = {};
          list.forEach((key) => {
            const oldValue = state.storage[key];
            delete state.storage[key];
            changes[key] = { oldValue, newValue: undefined };
          });
          emitStorageChanged(changes, 'local');
          if (typeof callback === 'function') callback();
          return Promise.resolve();
        },
        clear: (callback) => {
          const changes = {};
          Object.keys(state.storage).forEach((key) => {
            changes[key] = { oldValue: state.storage[key], newValue: undefined };
            delete state.storage[key];
          });
          emitStorageChanged(changes, 'local');
          if (typeof callback === 'function') callback();
          return Promise.resolve();
        }
      }
    },
    tabs: {
      query: async () => [state.tab],
      sendMessage: (tabId, payload, callback) => {
        state.sentMessages.push({ tabId, payload });
        const response = typeof options.onTabMessage === 'function'
          ? options.onTabMessage(tabId, payload, state)
          : { ok: true };
        if (typeof callback === 'function') callback(response);
        return Promise.resolve(response);
      },
      reload: (tabId) => {
        state.sentMessages.push({ tabId, payload: { action: 'reload' } });
      },
      captureVisibleTab: (windowId, optionsArg, callback) => {
        const response = typeof options.onCaptureTab === 'function'
          ? options.onCaptureTab(windowId, optionsArg, state)
          : 'data:image/png;base64,AAA';
        callback(response);
      }
    },
    permissions: {
      contains: async () => false,
      request: async () => true
    },
    scripting: {
      executeScript: async () => ({})
    },
    offscreen: {
      hasDocument: async () => false,
      createDocument: async () => { }
    }
  };

  const fetch = async (url) => {
    const resolvedUrl = String(url);
    state.fetchedUrls.push(resolvedUrl);
    if (resolvedUrl.includes('_locales/')) {
      const localeMatch = resolvedUrl.match(/_locales\/([^/]+)\/messages\.json/);
      const locale = localeMatch ? localeMatch[1] : 'en';
      const messages = options.locales?.[locale] || options.locales?.en || {};
      return {
        ok: true,
        status: 200,
        json: async () => messages,
        text: async () => JSON.stringify(messages)
      };
    }
    if (resolvedUrl.endsWith('updates.json')) {
      const updates = options.updates || [];
      return {
        ok: true,
        status: 200,
        json: async () => updates,
        text: async () => JSON.stringify(updates)
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => ''
    };
  };

  const setTab = (tab) => {
    state.tab = { ...state.tab, ...(tab || {}) };
  };

  const resetDom = () => {
    const fresh = new FakeDocument();
    fresh.title = document.title;
    globalThis.document = fresh;
    window.document = fresh;
    state.document = fresh;
    return fresh;
  };

  globalThis.window = window;
  globalThis.document = document;
  globalThis.chrome = chrome;
  globalThis.fetch = fetch;
  globalThis.location = window.location;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      clipboard: {
        writeText: async (text) => {
          state.clipboardText = String(text);
        }
      },
      serviceWorker: {
        getRegistrations: async () => []
      }
    }
  });
  if (!globalThis.Blob) {
    globalThis.Blob = class Blob {
      constructor(parts = [], options = {}) {
        this.parts = parts;
        this.type = options.type || '';
      }
    };
  }
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = () => 'blob:test';
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = () => { };
  }

  return {
    state,
    document,
    window,
    chrome,
    fetch,
    setTab,
    resetDom,
    createElement: (tagName, attrs = {}) => {
      const el = document.createElement(tagName);
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'textContent') el.textContent = value;
        else if (key === 'innerText') el.innerText = value;
        else if (key === 'innerHTML') el.innerHTML = value;
        else if (key === 'className') el.setAttribute('class', value);
        else if (key === 'dataset' && value && typeof value === 'object') {
          Object.entries(value).forEach(([dataKey, dataValue]) => {
            el.dataset[dataKey] = dataValue;
            const attrName = `data-${dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
            el.setAttribute(attrName, dataValue);
          });
        } else {
          el.setAttribute(key, value);
        }
      });
      return el;
    },
    appendToBody: (el) => document.body.appendChild(el),
    appendTo: (parent, el) => parent.appendChild(el),
    flushMicrotasks: () => new Promise((resolve) => setTimeout(resolve, 0))
  };
}
