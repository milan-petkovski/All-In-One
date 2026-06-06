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

  class FakeTextNode {
    constructor(document, text = '') {
      this.ownerDocument = document;
      this.nodeType = 3;
      this._text = String(text);
      this.parentNode = null;
      this.children = [];
    }
    get textContent() {
      return this._text;
    }
    set textContent(value) {
      this._text = String(value);
    }
    get nodeValue() {
      return this._text;
    }
    set nodeValue(value) {
      this._text = String(value);
    }
  }

  class FakeElement {
    constructor(document, tagName = 'div') {
      this.ownerDocument = document;
      this.nodeType = 1;
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

    get className() {
      return this.getAttribute('class') || '';
    }

    set className(value) {
      this.setAttribute('class', value);
    }

    set innerHTML(value) {
      this._html = String(value);
      this.children = [];
      this._text = "";
      this._innerText = "";
      if (value) {
        const parser = new globalThis.DOMParser();
        const doc = parser.parseFromString(String(value), "text/html");
        const parsedChildren = [...doc.body.children];
        parsedChildren.forEach(child => this.appendChild(child));
      }
    }

    get innerHTML() {
      if (this.children.length > 0) {
        return this.children.map(child => {
          if (child.nodeType === 3) {
            return child.textContent;
          }
          const attrs = Object.entries(child.attributes)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('');
          return `<${child.tagName.toLowerCase()}${attrs}>${child.innerHTML}</${child.tagName.toLowerCase()}>`;
        }).join('');
      }
      return this._html || this._text || "";
    }

    set textContent(value) {
      this._text = String(value);
      this._html = "";
      this.children = [];
      this._innerText = String(value);
      if (value) {
        const textNode = this.ownerDocument ? this.ownerDocument.createTextNode(String(value)) : new FakeTextNode(null, String(value));
        textNode.parentNode = this;
        this.children.push(textNode);
      }
    }

    get textContent() {
      return this._text;
    }

    set innerText(value) {
      this._innerText = String(value);
      this._text = String(value);
      this._html = "";
      this.children = [];
      if (value) {
        const textNode = this.ownerDocument ? this.ownerDocument.createTextNode(String(value)) : new FakeTextNode(null, String(value));
        textNode.parentNode = this;
        this.children.push(textNode);
      }
    }

    get innerText() {
      return this._innerText || this._text;
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
    if (!element || element.nodeType !== 1) return false;
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

    createTextNode(text) {
      return new FakeTextNode(this, text);
    }

    createDocumentFragment() {
      const frag = this.createElement('div');
      frag.nodeType = 11;
      frag.tagName = '#document-fragment';
      return frag;
    }

    _registerElement(element) {
      if (element.id) this.elementsById.set(element.id, element);
    }

    _registerTree(element) {
      if (!element) return;
      if (element.id) this._registerElement(element);
      if (element.children) {
        element.children.forEach((child) => this._registerTree(child));
      }
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

  class DOMParserMock {
    parseFromString(html, type) {
      const doc = new FakeDocument();
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
  window.localStorage = createLocalStorageMock();

  globalThis.window = window;
  globalThis.document = document;
  globalThis.DOMParser = DOMParserMock;
  globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.FileReader = MockFileReader;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { return window.localStorage; },
    set(v) { window.localStorage = v; }
  });
  document.createRange = () => new MockRange();
  document.createTreeWalker = (root) => new MockTreeWalker(root);
  window.getSelection = () => mockSelection;
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
