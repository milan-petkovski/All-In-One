const isSystemPage = (urlStr) => {
  const url = urlStr || (typeof window !== "undefined" && window.location ? window.location.href : "");
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("file://") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
};

const rgbToHex = (r, g, b) => "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

const INTRUSIVE_TEXT_KEYWORDS = [
  'cookie', 'kolačić', 'kolacic', 'kolačic', 'consent', 'gdpr', 'privatnost', 'privacy policy',
  'obaveštenj', 'obavestenj', 'notifik', 'newsletter', 'push obave', 'web push',
  'prihvatam', 'prihvati sve', 'accept all', 'accept cookies', 'agree to all', 'i agree',
  'slažem se', 'slazem se', 'saglasan', 'koristimo kolačiće', 'use cookies',
  'reklam', 'advertisement', 'personalizovane reklame', 'sponsored',
  'pretplat', 'subscribe', 'sign up for', 'email list'
];

const isProtectedModal = (el) => {
  if (!el) return true;
  const token = `${el.id || ""} ${String(el.className || "")}`.toLowerCase();
  if (/\b(login|sign-?in|sign-?up|register|auth|checkout|payment|billing|account)\b/.test(token)) {
    return true;
  }
  if (el.querySelector && el.querySelector('input[type="password"]')) return true;
  if (el.closest && el.closest('[data-aio-dark-exempt="1"]')) return true;
  return false;
};

const elementMatchesIntrusiveText = (el) => {
  const rawText = typeof el === "string" ? el : (el?.innerText || el?.textContent || "");
  const text = rawText.replace(/\s+/g, " ").trim().toLowerCase();
  if (!text || text.length > 4000) return false;
  return INTRUSIVE_TEXT_KEYWORDS.some((kw) => text.includes(kw));
};

if (typeof window !== "undefined" && typeof isSystemPage === "function" && !isSystemPage()) {
  runMainContentScript();
}


function runMainContentScript() {


  /**
   * Runs a callback with the lazily injected page tools (js/content-tools.js).
   * The background script injects the file into this frame on first use.
   * @param {(tools: {initColorPicker: Function, initRuler: Function, initFontFinder: Function}) => void} callback
   */
  function withTools(callback) {
    if (window.__aioTools) {
      callback(window.__aioTools);
      return;
    }
    try {
      chrome.runtime.sendMessage({ action: "load_content_tools" }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok || !window.__aioTools) return;
        callback(window.__aioTools);
      });
    } catch {
      // Extension context invalidated (extension was reloaded).
    }
  }
  // Slušač za poruke iz background/popup-a
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "toggleColorPicker") {
      chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) return;
        withTools((tools) => tools.initColorPicker(response.dataUrl));
      });
    } else if (request.action === "toggleRuler") {
      withTools((tools) => tools.initRuler());
    } else if (request.action === "toggleFontFinder") {
      withTools((tools) => tools.initFontFinder());
    } else if (request.action === "setDarkMode") {
      applyDark(request.enabled === true, true);
    } else if (request.action === "setMasterVolume") {
      applyMasterVolume(request.value);
    }
  });

  const host = window.location.hostname;
  const copyEvents = ["contextmenu", "copy", "cut", "paste", "selectstart"];
  const stopBlockedEvent = (e) => e.stopImmediatePropagation();
  let cookieObserver = null;
  let cookieScanTimer = null;
  let cookieWhitelist = [];

  window.aioMediaNodes = window.aioMediaNodes || new WeakMap();

  const isCriticalAppContainer = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el === document.documentElement || el === document.body) return true;
    const id = String(el.id || "").toLowerCase();
    if (id === "root" || id === "__next" || id === "app" || id === "__nuxt") return true;
    if (el.matches?.('main, #root, #__next, #app, #__nuxt, [data-reactroot], [data-react-helmet]')) return true;
    return false;
  };

  const hasExplicitCookieSignal = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const token = `${el.id || ""} ${String(el.className || "")} ${(el.getAttribute?.("aria-label") || "")}`.toLowerCase();
    return /(cookie|consent|gdpr|onetrust|didomi|cookiebot|cmp|privacy[-_ ]?(banner|notice)|sp_message|trustarc|qc-cmp)/.test(token);
  };

  const hideCookieElement = (el) => {
    if (!el || el.dataset?.aioCookieHidden === "1") return;
    if (isCriticalAppContainer(el)) return;
    el.dataset.aioCookieHidden = "1";
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
  };

  const INTRUSIVE_SELECTORS = [
    '[id*="cookie" i]', '[class*="cookie" i]',
    '[id*="consent" i]', '[class*="consent" i]',
    '[id*="gdpr" i]', '[class*="gdpr" i]',
    '[id*="privacy" i]', '[class*="privacy-banner" i]', '[class*="privacy-notice" i]',
    '[class*="cookie-banner" i]', '[class*="cookie-notice" i]', '[class*="cookie-modal" i]',
    '[id*="onetrust" i]', '[class*="onetrust" i]', '#onetrust-banner-sdk', '#onetrust-consent-sdk',
    '[id*="sp_message" i]', '[id*="didomi" i]', '[class*="didomi" i]',
    '[id*="cookiebot" i]', '[class*="cookiebot" i]', '#CybotCookiebotDialog',
    '[class*="fc-consent" i]', '[class*="qc-cmp" i]', '[class*="cmp-container" i]',
    '[class*="newsletter" i]', '[id*="newsletter" i]', '[class*="subscribe" i]',
    '[class*="webpush" i]', '[class*="web-push" i]', '[class*="push-prompt" i]',
    '[class*="notification" i][class*="modal" i]', '[class*="notif" i][class*="popup" i]',
    '[class*="ad-overlay" i]', '[class*="interstitial" i]',
    '[class*="paywall" i]', '[class*="gdpr" i]',
    '.fc-consent-root', '.qc-cmp2-container', '.trustarc-banner-container',
    '[data-testid*="cookie" i]', '[data-test*="consent" i]',
    'iframe[id*="consent" i]', 'iframe[src*="consent" i]', 'iframe[src*="cmp." i]', 'iframe[src*="gdpr" i]'
  ];

  const isLikelyIntrusiveOverlay = (el) => {
    if (!el || el.nodeType !== 1 || isProtectedModal(el)) return false;
    if (isCriticalAppContainer(el)) return false;
    if (el.dataset?.aioCookieHidden === "1") return false;

    const style = window.getComputedStyle(el);
    const pos = style.position;
    if (pos !== "fixed" && pos !== "sticky" && pos !== "absolute") return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < 220 || rect.height < 120) return false;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const coversViewport = rect.width >= vw * 0.45 || rect.height >= vh * 0.35;
    const nearFullViewport = rect.width >= vw * 0.85 && rect.height >= vh * 0.85;
    const isDialog = el.matches('[role="dialog"], dialog, [aria-modal="true"]');
    const zIndex = parseInt(style.zIndex, 10);

    // Avoid blank-page regressions: never hide near full-screen containers unless
    // they have explicit consent/cookie markers.
    if (nearFullViewport && !hasExplicitCookieSignal(el)) return false;

    if (!elementMatchesIntrusiveText(el)) return false;
    if (isDialog) return true;
    if (Number.isFinite(zIndex) && zIndex >= 100 && coversViewport) return true;
    if (coversViewport && (style.backgroundColor.includes("rgba") || Number(style.opacity) < 1)) return true;

    return rect.width >= 280 && rect.height >= 180;
  };

  const hideIntrusiveBackdrop = (el) => {
    const parent = el.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) return;
    if (isCriticalAppContainer(parent)) return;
    const siblingCount = parent.children.length;
    if (siblingCount > 6) return;
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === "fixed" && elementMatchesIntrusiveText(parent)) {
      hideCookieElement(parent);
    }
  };

  const unlockPageScroll = () => {
    const html = document.documentElement;
    const body = document.body;
    if (!body) return;
    body.style.removeProperty("overflow");
    html.style.removeProperty("overflow");
    ["modal-open", "no-scroll", "overflow-hidden", "disable-scroll", "has-modal", "noscroll", "is-locked", "scroll-lock"].forEach((cls) => {
      body.classList.remove(cls);
      html.classList.remove(cls);
    });
  };

  const getEffectiveVolume = (res) => {
    const globalRaw = Number(res.global_vol);
    if (Number.isFinite(globalRaw)) return globalRaw;

    return 100;
  };

  const isMediaElementCorsSafe = (media) => {
    try {
      const src = media.currentSrc || media.src;
      if (!src) return true;

      if (src.startsWith('blob:') || src.startsWith('data:')) {
        return true;
      }

      const url = new URL(src, window.location.href);
      if (url.origin === window.location.origin) {
        return true;
      }

      if (media.crossOrigin === 'anonymous' || media.crossOrigin === 'use-credentials') {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  let originalVolumeDescriptor = null;
  let volumeOverrideActive = false;
  try {
    originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  } catch {}

  const captureBaseVolume = (media) => {
    if (media.hasOwnProperty('_aioBaseVolume')) return media._aioBaseVolume;
    try {
      const actual = originalVolumeDescriptor.get.call(media);
      const lastMult = media._aioLastMultiplier ?? 1.0;
      const computedBase = lastMult > 0 ? (actual / lastMult) : actual;
      media._aioBaseVolume = Number.isFinite(computedBase) ? Math.max(0, Math.min(computedBase, 1)) : 1.0;
    } catch {
      media._aioBaseVolume = 1.0;
    }
    return media._aioBaseVolume;
  };

  const ensureAudioContext = () => {
    if (!window.aioVolCtx) {
      window.aioVolCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (window.aioVolCtx.state === "suspended") {
      const resume = () => { if (window.aioVolCtx?.state === "suspended") window.aioVolCtx.resume(); };
      ["pointerdown", "keydown", "click", "touchstart"].forEach(ev =>
        document.addEventListener(ev, resume, { once: true, capture: true })
      );
    }
  };

  const ensureMediaAudioChain = (media) => {
    if (window.aioMediaNodes.has(media)) return window.aioMediaNodes.get(media);
    ensureAudioContext();
    try {
      const source = window.aioVolCtx.createMediaElementSource(media);
      const gainNode = window.aioVolCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(window.aioVolCtx.destination);
      const nodes = { source, gainNode };
      window.aioMediaNodes.set(media, nodes);
      return nodes;
    } catch {
      window.aioMediaNodes.set(media, null);
      return null;
    }
  };

  const applyVolumeToMedia = (media, rawVolume) => {
    if (!originalVolumeDescriptor) return;

    const multiplier = Math.max(0, rawVolume / 100);
    const base = captureBaseVolume(media);
    const target = base * multiplier;
    const nodes = window.aioMediaNodes.get(media);
    const needsBoost = target > 1.0 && isMediaElementCorsSafe(media);

    if (needsBoost) {
      const chain = ensureMediaAudioChain(media);
      if (!chain) {
        try {
          originalVolumeDescriptor.set.call(media, 1.0);
        } catch {}
        media._aioLastMultiplier = 1.0;
        return;
      }
      try {
        originalVolumeDescriptor.set.call(media, base);
        chain.gainNode.gain.setTargetAtTime(multiplier, window.aioVolCtx.currentTime, 0.01);
      } catch {}
      media._aioLastMultiplier = multiplier;
      return;
    }

    if (nodes?.gainNode) {
      try {
        originalVolumeDescriptor.set.call(media, base);
        nodes.gainNode.gain.setTargetAtTime(multiplier, window.aioVolCtx.currentTime, 0.01);
      } catch {}
      media._aioLastMultiplier = multiplier;
      return;
    }

    try {
      const clampedTarget = Math.max(0, Math.min(target, 1.0));
      originalVolumeDescriptor.set.call(media, clampedTarget);
      media._aioLastMultiplier = (clampedTarget > 0 && base > 0) ? (clampedTarget / base) : multiplier;
    } catch {
      media._aioLastMultiplier = multiplier;
    }
  };

  const installVolumeOverride = () => {
    if (volumeOverrideActive || !originalVolumeDescriptor || !originalVolumeDescriptor.configurable) return;
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
        configurable: true,
        enumerable: true,
        get: function () {
          return this.hasOwnProperty('_aioBaseVolume')
            ? this._aioBaseVolume
            : originalVolumeDescriptor.get.call(this);
        },
        set: function (val) {
          const num = Number(val);
          this._aioBaseVolume = Number.isFinite(num) ? Math.max(0, Math.min(num, 1)) : 1.0;
          this._aioLastMultiplier = 1.0; // Reset last multiplier because we are setting a new unscaled baseline
          applyVolumeToMedia(this, window.aioCurrentRawVolume ?? 100);
        }
      });
      volumeOverrideActive = true;
    } catch {}
  };

  const restoreVolumeOverride = () => {
    if (!volumeOverrideActive || !originalVolumeDescriptor || !originalVolumeDescriptor.configurable) return;
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', originalVolumeDescriptor);
      volumeOverrideActive = false;
    } catch {}
  };

  const captureAllMediaBaselines = () => {
    try {
      document.querySelectorAll("audio, video").forEach((media) => captureBaseVolume(media));
    } catch {}
  };

  const restoreMediaVolumesAt100 = () => {
    try {
      document.querySelectorAll("audio, video").forEach((media) => {
        if (!media.hasOwnProperty('_aioBaseVolume')) return;
        const base = media._aioBaseVolume;
        const nodes = window.aioMediaNodes.get(media);
        if (nodes?.gainNode) {
          try {
            nodes.gainNode.gain.setTargetAtTime(1.0, window.aioVolCtx?.currentTime || 0, 0.01);
          } catch {}
        }
        try {
          originalVolumeDescriptor.set.call(media, base);
        } catch {}
        delete media._aioBaseVolume;
        delete media._aioLastMultiplier;
      });
    } catch {}

    restoreVolumeOverride();

    if (window.aioVolObserver) {
      window.aioVolObserver.disconnect();
      window.aioVolObserver = null;
    }
  };

  const applyMasterVolume = (rawValue) => {
    const safeRaw = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 100;
    const clampedRaw = Math.max(0, Math.min(safeRaw, 1000));
    const wasModified = window.aioVolumeModified === true;

    window.aioCurrentRawVolume = clampedRaw;

    if (clampedRaw === 100) {
      if (wasModified) {
        restoreMediaVolumesAt100();
      }
      window.aioVolumeModified = false;
      return;
    }

    window.aioVolumeModified = true;

    captureAllMediaBaselines();
    installVolumeOverride();

    const connectMedia = () => {
      captureAllMediaBaselines();
      const currentVol = window.aioCurrentRawVolume ?? 100;
      document.querySelectorAll("audio, video").forEach((media) => {
        applyVolumeToMedia(media, currentVol);
      });
    };

    connectMedia();

    try {
      if (!window.aioVolObserver && document.documentElement) {
        window.aioVolObserver = new MutationObserver(connectMedia);
        window.aioVolObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    } catch {}
  };

  const syncVolumeFromStorage = () => {
    chrome.storage.local.get(["global_vol"], (res) => {
      applyMasterVolume(getEffectiveVolume(res));
    });
  };

  // Funkcija za Dark Mode
  const applyDark = (on, isToggle = false) => {
    let style = document.getElementById("aio-dark-style");
    let transitionStyle = document.getElementById("aio-dark-transition");
    const isDarkAlreadyActive = !!style;

    if (on) {
      if (isDarkAlreadyActive) return;

      let isSiteAlreadyDark = false;
      const html = document.documentElement;
      const body = document.body;

      const themeAttr = [
        html.getAttribute('data-theme'), html.getAttribute('data-color-mode'),
        html.getAttribute('data-bs-theme'), html.getAttribute('theme'),
        body?.getAttribute('data-theme'), body?.getAttribute('theme')
      ].join(' ').toLowerCase();

      const classStr = ((html.className || "") + " " + (body?.className || "")).toLowerCase();

      if (themeAttr.includes('dark') || classStr.includes('dark') || classStr.includes('night') || themeAttr.includes('night')) {
        isSiteAlreadyDark = true;
      } else {
        let bgColor = null;
        const elements = [body, html, document.querySelector('main'), document.querySelector('[role="application"]'), document.querySelector('#root'), document.querySelector('#__next')];

        for (const el of elements) {
          if (!el) continue;
          const bg = window.getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== '') {
            bgColor = bg;
            break;
          }
        }

        if (!bgColor) bgColor = 'rgb(255, 255, 255)';

        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const luma = 0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2]);
          if (luma < 128) isSiteAlreadyDark = true;
        }
      }

      if (isSiteAlreadyDark) return;

      if (isToggle && !transitionStyle) {
        transitionStyle = document.createElement("style");
        transitionStyle.id = "aio-dark-transition";
        transitionStyle.innerHTML = `
        html, body, img, video, canvas, [style*="background-image"] {
          transition: filter 0.3s ease, background-color 0.3s ease !important;
        }
      `;
        (document.head || document.documentElement).appendChild(transitionStyle);
      }

      if (!style) {
        style = document.createElement("style");
        style.id = "aio-dark-style";
        style.innerHTML = `
        html { 
          filter: invert(1) hue-rotate(180deg) !important; 
          background: #fff !important; 
          color-scheme: dark !important; 
        }
        /* Vracanje slika i videa u normalu */
        img, video, canvas, embed, object, [style*="background-image"] {
          filter: invert(1) hue-rotate(180deg) !important; 
        }
        /* Sprecavanje duplog invertovanja za ugnjezdene elemente */
        picture img, img img, video img, [style*="background-image"] img, [style*="background-image"] video {
          filter: none !important;
        }
        [class*="avatar"], [class*="profile"], [class*="thumb"], [aria-label*="avatar"] {
          filter: none !important;
        }
        [class*="avatar"] img, [class*="profile"] img, [class*="thumb"] img {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        svg[role="img"], svg.illustration, svg.chart, svg.graphic {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        img *, video *, canvas *, picture * {
          filter: none !important;
        }
      `;
        (document.head || document.documentElement).appendChild(style);
      }
    } else {

      if (style) style.remove();
      if (transitionStyle) transitionStyle.remove();
    }
  };

  // Funkcija za Enable Copy
  const enableCopy = () => {
    if (window.aioCopyEnabled) return;

    window.aioCopyEnabled = true;

    copyEvents.forEach(type => {
      document.addEventListener(type, stopBlockedEvent, true);
    });

    if (!document.getElementById("force-copy-fix")) {
      const s = document.createElement("style");
      s.id = "force-copy-fix";
      s.innerHTML = "*{user-select:text!important;-webkit-user-select:text!important;}";
      document.documentElement.appendChild(s);
    }
  };

  const disableCopy = () => {
    if (!window.aioCopyEnabled) return;

    window.aioCopyEnabled = false;

    copyEvents.forEach(type => {
      document.removeEventListener(type, stopBlockedEvent, true);
    });

    const style = document.getElementById("force-copy-fix");
    if (style) style.remove();
  };

  let foucStyle = document.createElement("style");
  foucStyle.id = "aio-fouc-style";
  foucStyle.innerHTML = `html { background-color: #121212 !important; } html * { visibility: hidden !important; }`;
  if (document.documentElement) {
    document.documentElement.appendChild(foucStyle);
  }

  const foucHardDeadlineTimer = setTimeout(() => {
    if (foucStyle && foucStyle.parentNode) {
      foucStyle.remove();
      foucStyle = null;
    }
  }, 2500);

  window.aioInitialized = window.aioInitialized || false;

  const initializeFeatures = () => {
    if (window.aioInitialized) return;
    window.aioInitialized = true;

    clearTimeout(foucHardDeadlineTimer);

    chrome.storage.local.get([host, "nightToggle", "global_vol"], (res) => {
      if (!res.nightToggle && foucStyle) {
        foucStyle.remove();
        foucStyle = null;
      }

      if (res.nightToggle) {
        if (foucStyle) {
          foucStyle.remove();
          foucStyle = null;
        }
        applyDark(true, false); // isToggle = false, bez animacije za instant ucitavanje
      }

      if (res[host]) {
        enableCopy();
      } else {
        disableCopy();
      }

      applyMasterVolume(getEffectiveVolume(res));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeFeatures);

    setTimeout(() => { if (foucStyle && !window.aioInitialized) initializeFeatures(); }, 800);
  } else {
    initializeFeatures();
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.nightToggle !== undefined) {
      applyDark(changes.nightToggle.newValue, true); // isToggle = true, sa animacijom
    }

    if (changes[host] !== undefined) {
      if (changes[host].newValue) enableCopy();
      else disableCopy();
    }

    if (changes.cookieWhitelist !== undefined) {
      cookieWhitelist = Array.isArray(changes.cookieWhitelist.newValue) ? changes.cookieWhitelist.newValue : [];
      if (cookieBlockEnabled()) {
        if (isWhitelisted(host)) disableCookieBlock();
        else enableCookieBlock();
      }
    }

    if (changes.cookieBlock !== undefined) {
      if (changes.cookieBlock.newValue && !isWhitelisted(host)) enableCookieBlock();
      else disableCookieBlock();
    }

    if (changes.global_vol !== undefined) {
      syncVolumeFromStorage();
    }
  });

  let cookieScanDebounceId = null;
  const debouncedCookieScan = () => {
    if (cookieScanDebounceId) clearTimeout(cookieScanDebounceId);
    cookieScanDebounceId = setTimeout(killCookies, 100);
  };

  const processedElements = new WeakSet();
  let cookieCleanupPending = false;
  let cookieRescanTimers = [];

  const killCookies = () => {
    if (cookieCleanupPending) return;
    if (window.top !== window) return;
    cookieCleanupPending = true;

    const runCleanup = () => {
      try {
        document.querySelectorAll(INTRUSIVE_SELECTORS.join(",")).forEach((el) => {
          if (processedElements.has(el) || isProtectedModal(el)) return;
          processedElements.add(el);
          hideCookieElement(el);
        });

        document.querySelectorAll('div, section, aside, dialog, [role="dialog"], [aria-modal="true"]').forEach((el) => {
          if (processedElements.has(el) || !isLikelyIntrusiveOverlay(el)) return;
          processedElements.add(el);
          hideCookieElement(el);
          hideIntrusiveBackdrop(el);
        });
      } catch {}

      unlockPageScroll();
      cookieCleanupPending = false;
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(runCleanup, { timeout: 500 });
    } else {
      setTimeout(runCleanup, 100);
    }
  };

  const scheduleCookieRescans = () => {
    cookieRescanTimers.forEach((id) => clearTimeout(id));
    cookieRescanTimers = [300, 900, 1800, 3500, 6000].map((ms) => setTimeout(killCookies, ms));
  };

  const enableCookieBlock = () => {
    if (window.top !== window) return;
    if (cookieObserver) return;

    killCookies();
    scheduleCookieRescans();

    cookieObserver = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
      if (hasAddedNodes) debouncedCookieScan();
    });

    cookieObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  const disableCookieBlock = () => {
    cookieRescanTimers.forEach((id) => clearTimeout(id));
    cookieRescanTimers = [];
    if (cookieScanTimer) {
      clearTimeout(cookieScanTimer);
      cookieScanTimer = null;
    }
    if (cookieObserver) {
      cookieObserver.disconnect();
      cookieObserver = null;
    }
  };

  const isWhitelisted = (domain) => {
    if (!domain) return false;
    return cookieWhitelist.includes(domain);
  };

  const cookieBlockEnabled = () => cookieObserver !== null;

  chrome.storage.local.get(["cookieBlock", "cookieWhitelist"], (res) => {
    cookieWhitelist = Array.isArray(res.cookieWhitelist) ? res.cookieWhitelist : [];
    const shouldEnable = res.cookieBlock === true && !isWhitelisted(host);
    if (shouldEnable) enableCookieBlock();
    else disableCookieBlock();
  });

  let systemIsIdle = false;

  chrome.runtime.onMessage.addListener((request) => {
    if (request?.action === "system_idle") {
      systemIsIdle = true;
    } else if (request?.action === "system_active") {
      systemIsIdle = false;
    }
  });

  if (window.top === window && location.protocol.startsWith("http")) {
    chrome.runtime.sendMessage({ action: "get_system_idle_state" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res?.state === 'idle' || res?.state === 'locked') {
        systemIsIdle = true;
      }
    });
  }

  if (window.top === window && location.protocol.startsWith("http")) {
    const TAB_IDLE_LIMIT_MS = 150000;
    const HEARTBEAT_INTERVAL_MS = 5000;
    const MAX_HEARTBEAT_CHUNK_SEC = 5;
    let lastHeartbeatAt = Date.now();
    let lastTabInteractionAt = Date.now();
    let trackerIntervalId = null;
    let leftoverMs = 0;
    let pendingSeconds = 0;

    const isContextInvalidatedError = (err) => {
      const msg = String(err?.message || err || "").toLowerCase();
      return msg.includes("extension context invalidated");
    };

    const stopTrackerHeartbeat = () => {
      if (trackerIntervalId) {
        clearInterval(trackerIntervalId);
        trackerIntervalId = null;
      }
    };

    const saveToEmergencyBuffer = (domain, seconds) => {
      try {
        chrome.storage.local.get(['tracker_buffer'], (res) => {
          if (chrome.runtime.lastError) return;
          const buffer = (res.tracker_buffer && typeof res.tracker_buffer === 'object' && !Array.isArray(res.tracker_buffer))
            ? res.tracker_buffer : {};
          buffer[domain] = (Number(buffer[domain]) || 0) + seconds;
          chrome.storage.local.set({ tracker_buffer: buffer }).catch(() => { });
        });
      } catch {}
    };

    const sendHeartbeatSeconds = (totalSeconds) => {
      const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
      if (seconds <= 0) return;

      const domain = location.hostname;

      if (chrome?.runtime?.id) {
        try {
          const p = chrome.runtime.sendMessage({
            action: "tracker_heartbeat",
            domain: domain,
            seconds: seconds
          });
          if (p && typeof p.catch === "function") {
            p.catch(() => saveToEmergencyBuffer(domain, seconds));
          }
        } catch {
          saveToEmergencyBuffer(domain, seconds);
        }
      } else {
        saveToEmergencyBuffer(domain, seconds);
      }
    };

    const consumeElapsedSeconds = (elapsedMs) => {
      const safeElapsed = Math.max(0, Math.floor(Number(elapsedMs) || 0));
      const combinedMs = leftoverMs + safeElapsed;
      const wholeSeconds = Math.floor(combinedMs / 1000);
      leftoverMs = combinedMs % 1000;
      return wholeSeconds;
    };

    const flushTrackedTime = (now, maxSeconds = Number.POSITIVE_INFINITY) => {
      // After sleep or a long main thread stall a tick can arrive very late; never credit
      // more than a few intervals for periodic ticks (maxSeconds is finite only for them).
      const rawElapsedMs = now - lastHeartbeatAt;
      const elapsedMs = Number.isFinite(maxSeconds) ? Math.min(rawElapsedMs, HEARTBEAT_INTERVAL_MS * 3) : rawElapsedMs;
      lastHeartbeatAt = now;
      const wholeSeconds = consumeElapsedSeconds(elapsedMs);
      pendingSeconds += wholeSeconds;
      const boundedSeconds = Math.max(0, Math.min(pendingSeconds, maxSeconds));
      if (boundedSeconds > 0) {
        sendHeartbeatSeconds(boundedSeconds);
        pendingSeconds -= boundedSeconds;
      }
    };

    const markTabInteraction = () => {
      const now = Date.now();
      const wasIdle = now - lastTabInteractionAt > TAB_IDLE_LIMIT_MS;
      lastTabInteractionAt = now;

      if (wasIdle) {
        lastHeartbeatAt = now;
      }
    };

    ["pointerdown", "keydown", "wheel", "scroll", "touchstart", "mousemove"].forEach((eventName) => {
      document.addEventListener(eventName, markTabInteraction, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      try {
        const now = Date.now();
        if (document.visibilityState === "hidden") {
          flushTrackedTime(now);
        }
        lastHeartbeatAt = now;
        leftoverMs = 0;
        pendingSeconds = 0;
        if (document.visibilityState === "visible") {
          lastTabInteractionAt = now;
        }
      } catch (err) {
        if (isContextInvalidatedError(err)) {
          stopTrackerHeartbeat();
        }
      }
    });

    const sendTrackerHeartbeat = () => {
      try {
        if (document.visibilityState !== "visible") {
          lastHeartbeatAt = Date.now();
          leftoverMs = 0;
          pendingSeconds = 0;
          return;
        }

        if (systemIsIdle) {
          lastHeartbeatAt = Date.now();
          leftoverMs = 0;
          pendingSeconds = 0;
          return;
        }

        const now = Date.now();
        if (now - lastTabInteractionAt > TAB_IDLE_LIMIT_MS) {
          const idleCutoff = lastTabInteractionAt + TAB_IDLE_LIMIT_MS;
          const boundedNow = Math.max(lastHeartbeatAt, Math.min(now, idleCutoff));
          if (boundedNow > lastHeartbeatAt) {
            const boundedElapsedMs = boundedNow - lastHeartbeatAt;
            lastHeartbeatAt = boundedNow;
            const wholeSeconds = consumeElapsedSeconds(boundedElapsedMs);
            if (wholeSeconds > 0) {
              sendHeartbeatSeconds(wholeSeconds);
            }
          }

          lastHeartbeatAt = now;
          leftoverMs = 0;
          pendingSeconds = 0;
          return;
        }

        flushTrackedTime(now, MAX_HEARTBEAT_CHUNK_SEC);
      } catch (err) {
        if (isContextInvalidatedError(err)) {
          stopTrackerHeartbeat();
        }
      }
    };

    sendTrackerHeartbeat();
    trackerIntervalId = setInterval(sendTrackerHeartbeat, HEARTBEAT_INTERVAL_MS);

    window.addEventListener("pagehide", () => {
      try {
        flushTrackedTime(Date.now());
      } catch {}
      stopTrackerHeartbeat();
    }, false);

    window.addEventListener("beforeunload", () => {
      try {
        flushTrackedTime(Date.now());
      } catch {}
      stopTrackerHeartbeat();
    }, false);
    // --- SHORTCUT ENGINE ---
    let userShortcuts = {};
    chrome.storage.local.get(['user_shortcuts'], (res) => {
      userShortcuts = res.user_shortcuts || {};
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.user_shortcuts) {
        userShortcuts = changes.user_shortcuts.newValue || {};
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;

      const key = e.key.toUpperCase();
      for (const [action, shortcutKey] of Object.entries(userShortcuts)) {
        if (key === shortcutKey) {
          e.preventDefault();
          chrome.runtime.sendMessage({ action: "shortcut_triggered", toolAction: action });
          break;
        }
      }
    }, true);
  }

} // kraj runMainContentScript()

if (typeof globalThis !== "undefined") {
  globalThis.aioContentHelpers = {
    isSystemPage,
    rgbToHex,
    INTRUSIVE_TEXT_KEYWORDS,
    isProtectedModal,
    elementMatchesIntrusiveText,
    runMainContentScript
  };
}


