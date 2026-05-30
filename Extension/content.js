const isSystemPage = () => {
  const url = window.location.href;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("file://") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
};

if (!isSystemPage()) {
  runMainContentScript();
}

function runMainContentScript() {

  let contentI18nDict = null;
  let contentI18nWarned = false;
  async function loadTranslations() {
    try {
      const data = await chrome.storage.local.get(['appLang']);
      const lang = data.appLang || 'sr';
      const response = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ action: "get_locale_messages", lang }, (res) => {
            if (chrome.runtime.lastError) return resolve({ ok: false });
            resolve(res || { ok: false });
          });
        } catch (err) {
          resolve({ ok: false, error: String(err?.message || err) });
        }
      });
      if (response.ok && response.messages) {
        contentI18nDict = response.messages;
      } else if (!contentI18nWarned) {
        contentI18nWarned = true;
        console.warn("All In One: translations not loaded for content script.");
      }
    } catch (e) { }
  }
  loadTranslations();
  // Slušaj ako se jezik promeni u hodu
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.appLang) loadTranslations();
  });

  function getI18nMsg(key, defaultText) {
    if (contentI18nDict && contentI18nDict[key]) {
      return contentI18nDict[key].message;
    }
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
    return defaultText || "";
  }

  // --- TOOL ENGINES ---
  function initColorPicker(dataUrl) {
    if (window.aioEyeDropperActive) return;
    window.aioEyeDropperActive = true;

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = dataUrl;

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      overlay.remove();
      widget.remove();
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      window.aioEyeDropperActive = false;
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        return;
      }
      if (e.key === 'ArrowLeft') {
        virtualX = Math.max(0, virtualX - 1);
        updatePickerAt(virtualX, virtualY);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        virtualX = Math.min(window.innerWidth - 1, virtualX + 1);
        updatePickerAt(virtualX, virtualY);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        virtualY = Math.max(0, virtualY - 1);
        updatePickerAt(virtualX, virtualY);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        virtualY = Math.min(window.innerHeight - 1, virtualY + 1);
        updatePickerAt(virtualX, virtualY);
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        pickColorAndExit();
        e.preventDefault();
      }
    };

    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;cursor:none;background:transparent;';
    document.body.appendChild(overlay);

    let zoom = 9;
    const MAG_SIZE = 135;
    let CELL_SIZE = MAG_SIZE / zoom;

    // Unified widget wrapper centered on the cursor
    const widget = document.createElement('div');
    widget.setAttribute('data-aio-dark-exempt', '1');
    widget.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      width: ${MAG_SIZE}px;
      height: ${MAG_SIZE}px;
      display: none;
      transform: scale(0.8);
      transition: transform 0.15s cubic-bezier(0.25, 1, 0.5, 1);
    `;

    // Circular Magnifier
    const magnifier = document.createElement('div');
    magnifier.style.cssText = `
      width: 100%;
      height: 100%;
      border: 4px solid #fff;
      border-radius: 50%;
      overflow: hidden;
      position: relative;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5);
      background: transparent;
      box-sizing: border-box;
      transition: border-color 0.1s ease;
    `;

    const magCanvas = document.createElement('canvas');
    magCanvas.width = MAG_SIZE;
    magCanvas.height = MAG_SIZE;
    magCanvas.style.cssText = 'display: block; width: 100%; height: 100%; border-radius: 50%; transform: scale(1.02);';
    const magCtx = magCanvas.getContext('2d');
    magCtx.imageSmoothingEnabled = false;
    magnifier.appendChild(magCanvas);

    // Reticle (matches cell size exactly)
    const crosshair = document.createElement('div');
    crosshair.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${CELL_SIZE}px;
      height: ${CELL_SIZE}px;
      transform: translate(-50%, -50%);
      border: 1px solid #000;
      box-sizing: border-box;
      z-index: 10;
    `;
    magnifier.appendChild(crosshair);

    // Hex Pill Badge
    const colorBadge = document.createElement('div');
    colorBadge.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 15, 20, 0.85);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-family: 'Inter', monospace;
      font-size: 13px;
      font-weight: 800;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: 0.5px;
      white-space: nowrap;
      transition: top 0.15s ease, bottom 0.15s ease;
    `;

    widget.appendChild(magnifier);
    widget.appendChild(colorBadge);
    document.body.appendChild(widget);

    requestAnimationFrame(() => {
      widget.style.display = 'block';
      widget.style.transform = 'scale(1)';
    });

    const rgbToHex = (r, g, b) => "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

    let virtualX = 0;
    let virtualY = 0;
    let hasPointer = false;

    const updatePickerAt = (x, y) => {
      widget.style.left = (x - MAG_SIZE / 2) + 'px';
      widget.style.top = (y - MAG_SIZE / 2) + 'px';

      if (y > window.innerHeight - 120) {
        colorBadge.style.top = 'auto';
        colorBadge.style.bottom = 'calc(100% + 12px)';
      } else {
        colorBadge.style.bottom = 'auto';
        colorBadge.style.top = 'calc(100% + 12px)';
      }

      try {
        const physicalX = Math.floor(x * dpr);
        const physicalY = Math.floor(y * dpr);
        const pixel = ctx.getImageData(physicalX, physicalY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        magnifier.style.borderColor = hex;

        colorBadge.textContent = '';
        const colorDot = document.createElement('div');
        colorDot.style.cssText = `
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${hex};
          border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        const textSpan = document.createElement('span');
        textSpan.textContent = hex;
        colorBadge.append(colorDot, textSpan);

        magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
        const sourceX = physicalX - Math.floor(zoom / 2);
        const sourceY = physicalY - Math.floor(zoom / 2);
        magCtx.drawImage(canvas, sourceX, sourceY, zoom, zoom, 0, 0, MAG_SIZE, MAG_SIZE);

        const luma = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
        magCtx.strokeStyle = luma > 128 ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.3)';
        magCtx.lineWidth = 0.75;
        magCtx.beginPath();
        for (let j = 0; j <= zoom; j++) {
          const pos = j * CELL_SIZE;
          magCtx.moveTo(pos, 0); magCtx.lineTo(pos, MAG_SIZE);
          magCtx.moveTo(0, pos); magCtx.lineTo(MAG_SIZE, pos);
        }
        magCtx.stroke();
      } catch (err) { }
    };

    const pickColorAndExit = async () => {
      const x = virtualX;
      const y = virtualY;

      try {
        const physicalX = Math.floor(x * dpr);
        const physicalY = Math.floor(y * dpr);
        const pixel = ctx.getImageData(physicalX, physicalY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        await navigator.clipboard.writeText(hex);

        const toast = document.createElement('div');
        toast.setAttribute('data-aio-dark-exempt', '1');
        const copiedMsg = getI18nMsg("colorPickerCopied");
        toast.style.cssText = `position:fixed;bottom:40px;left:50%;transform:translateX(-50%) translateY(20px);background:#16161e;color:#fff;padding:12px 25px;border-radius:12px;font-family:sans-serif;font-weight:bold;border:1px solid ${hex};z-index:2147483647;opacity:0;transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);box-shadow:0 10px 30px rgba(0,0,0,0.5);display:flex;align-items:center;gap:10px;`;

        const check = document.createElement('span');
        check.style.color = '#00ff88';
        check.textContent = '✓';

        const msgText = document.createTextNode(` ${copiedMsg} `);

        const hexText = document.createElement('span');
        hexText.style.color = '#00ff88';
        hexText.style.fontSize = '16px';
        hexText.textContent = hex;

        toast.append(check, msgText, hexText);
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => toast.remove(), 500); }, 2500);
      } catch (err) { }
      cleanup();
    };

    overlay.onmousedown = (e) => {
      if (e.button !== 0) return; // Left click only
      pickColorAndExit();
    };

    overlay.onmousemove = (e) => {
      virtualX = e.clientX;
      virtualY = e.clientY;
      hasPointer = true;
      updatePickerAt(virtualX, virtualY);
    };

    overlay.onwheel = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        if (zoom > 3) {
          zoom -= 2;
        }
      } else {
        if (zoom < 25) {
          zoom += 2;
        }
      }
      CELL_SIZE = MAG_SIZE / zoom;
      crosshair.style.width = CELL_SIZE + 'px';
      crosshair.style.height = CELL_SIZE + 'px';
      if (hasPointer) {
        updatePickerAt(virtualX, virtualY);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
  }

  function initRuler() {
    if (document.getElementById("aioRulOv")) return;
    const ov = document.createElement("div");
    const r = document.createElement("div");
    ov.id = "aioRulOv";
    r.id = "aioRul";
    ov.setAttribute('data-aio-dark-exempt', '1');
    r.setAttribute('data-aio-dark-exempt', '1');
    ov.style = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999998;cursor:crosshair;background:transparent;";
    r.style = "position:fixed;border:1px solid #00ff88;background:rgba(0,255,136,0.1);z-index:999999;pointer-events:none;font-family: 'Inter', sans-serif;box-shadow:0 0 15px rgba(0,255,136,0.2); transition: none;";
    document.body.append(ov, r);

    const noSelectStyle = document.createElement("style");
    noSelectStyle.id = "aio-ruler-no-select";
    noSelectStyle.textContent = "html, body, * { user-select: none !important; -webkit-user-select: none !important; }";
    (document.head || document.documentElement).appendChild(noSelectStyle);

    const blockSelection = (e) => e.preventDefault();
    document.addEventListener("selectstart", blockSelection, true);
    document.addEventListener("dragstart", blockSelection, true);

    let sx, sy, drag = false;
    let isPointerDown = false;
    let removed = false;
    const clearSelection = () => {
      try {
        window.getSelection()?.removeAllRanges();
      } catch (_) { }
    };
    const esc = (e) => { if (e.key === "Escape") cleanup(); };
    const onGlobalMouseUp = () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      clearSelection();
      if (!drag) cleanup();
    };
    const cleanup = () => {
      if (removed) return;
      removed = true;
      clearSelection();
      ov.remove();
      r.remove();
      noSelectStyle.remove();
      document.removeEventListener("selectstart", blockSelection, true);
      document.removeEventListener("dragstart", blockSelection, true);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("mouseup", onGlobalMouseUp, true);
    };
    ov.onmousedown = (e) => {
      e.preventDefault();
      clearSelection();
      isPointerDown = true;
      sx = e.clientX; sy = e.clientY;
      drag = false;
      r.style.width = "0px"; r.style.height = "0px";
      r.innerHTML = "";
    };
    ov.onmousemove = (e) => {
      if (isPointerDown && e.buttons === 1) {
        e.preventDefault();
        drag = true;
        const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
        r.style.left = Math.min(e.clientX, sx) + "px";
        r.style.top = Math.min(e.clientY, sy) + "px";
        r.style.width = w + "px"; r.style.height = h + "px";

        r.textContent = '';
        const badge = document.createElement('div');
        badge.style.cssText = "position:absolute; background:rgba(0,0,0,0.75); padding:6px 12px; border-radius:8px; color:#00ff88; font-size:14px; font-weight:600; backdrop-filter:blur(4px); border:1px solid rgba(0,255,136,0.3); display:flex; gap:10px; box-shadow:0 4px 15px rgba(0,0,0,0.5); white-space:nowrap; z-index:1000000;";

        const hasEnoughSpace = (w > 135) && (h > 50);
        if (hasEnoughSpace) {
          badge.style.left = "50%";
          badge.style.top = "50%";
          badge.style.bottom = "auto";
          badge.style.transform = "translate(-50%, -50%)";
        } else {
          const boxBottom = Math.max(e.clientY, sy);
          if (window.innerHeight - boxBottom < 50) {
            badge.style.bottom = "calc(100% + 8px)";
            badge.style.top = "auto";
          } else {
            badge.style.top = "calc(100% + 8px)";
            badge.style.bottom = "auto";
          }
          badge.style.left = "50%";
          badge.style.transform = "translateX(-50%)";
        }

        const wLabel = document.createElement('span');
        wLabel.style.color = '#fff'; wLabel.style.opacity = '0.7'; wLabel.textContent = 'W: ';
        const wVal = document.createTextNode(`${w}px`);
        const wCont = document.createElement('span');
        wCont.append(wLabel, wVal);

        const divider = document.createElement('span');
        divider.style.color = 'rgba(255,255,255,0.2)'; divider.textContent = '|';

        const hLabel = document.createElement('span');
        hLabel.style.color = '#fff'; hLabel.style.opacity = '0.7'; hLabel.textContent = 'H: ';
        const hVal = document.createTextNode(`${h}px`);
        const hCont = document.createElement('span');
        hCont.append(hLabel, hVal);

        badge.append(wCont, divider, hCont);
        r.appendChild(badge);
      }
    };
    ov.onmouseup = onGlobalMouseUp;
    window.addEventListener("mouseup", onGlobalMouseUp, true);
    document.addEventListener("keydown", esc);
  }

  function initFontFinder() {
    if (window.aioFontFinderActive) return;
    window.aioFontFinderActive = true;
    const styleTag = document.createElement("style");
    styleTag.id = "aio-font-styles";
    styleTag.innerHTML = `
      * { cursor: default !important; }
      .aio-font-tooltip { position: fixed; pointer-events: none; background: #16161e; color: #00ff88; padding: 8px 12px; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid #00ff88; z-index: 2147483647; display: none; }
      .aio-font-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px); background: #16161e; color: #00ff88; padding: 15px 25px; border-radius: 12px; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: bold; box-shadow: 0 8px 20px rgba(0,0,0,0.6); border: 1px solid #00ff88; z-index: 2147483647; opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease; text-align: center; }
    `;
    (document.head || document.documentElement).appendChild(styleTag);
    const tooltip = document.createElement("div");
    tooltip.className = "aio-font-tooltip";
    document.body.appendChild(tooltip);
    let currentTarget = null;
    let cleaned = false;
    const getPrimaryFont = (el) => {
      if (!el || !(el instanceof Element)) return "";
      const rawFont = window.getComputedStyle(el).fontFamily || "";
      return rawFont.split(',')[0].replace(/[\'"]/g, '').trim();
    };
    const resolveFontTarget = (startEl) => {
      let node = startEl;
      while (node && node !== document.documentElement) {
        const font = getPrimaryFont(node);
        if (font) return { node, font };
        node = node.parentElement;
      }
      return { node: startEl, font: "Unknown Font" };
    };
    const cleanup = ({ removeStyle = true } = {}) => {
      if (cleaned) return;
      cleaned = true;
      document.removeEventListener("mouseover", mouseOverHandler, true);
      document.removeEventListener("mousemove", mouseMoveHandler, true);
      document.removeEventListener("click", clickHandler, true);
      document.removeEventListener("keydown", escHandler, true);
      window.removeEventListener("beforeunload", unloadHandler, true);
      tooltip.remove();
      if (removeStyle) styleTag.remove();
      window.aioFontFinderActive = false;
    };
    const copyText = async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    };
    const mouseOverHandler = (e) => {
      const result = resolveFontTarget(e.target);
      currentTarget = result.node;
      const cistFont = result.font || "Unknown Font";
      tooltip.style.display = 'block';
      tooltip.textContent = '';
      const label = document.createElement('span');
      label.style.cssText = 'color: #a0a0a8; font-size: 10px; display: block; margin-bottom: 2px;';
      label.textContent = 'Font:';
      const fontName = document.createTextNode(cistFont);
      tooltip.append(label, fontName);
    };
    const mouseMoveHandler = (e) => {
      if (tooltip.style.display === 'block') {
        const offset = 15;
        const maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
        const maxTop = window.innerHeight - tooltip.offsetHeight - 8;
        const left = Math.min(e.clientX + offset, Math.max(8, maxLeft));
        const top = Math.min(e.clientY + offset, Math.max(8, maxTop));
        tooltip.style.left = left + "px"; tooltip.style.top = top + "px";
      }
    };
    const clickHandler = async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!currentTarget) return;
      const cistFont = getPrimaryFont(currentTarget) || "Unknown Font";
      const copied = await copyText(cistFont);
      cleanup({ removeStyle: false });
      const toast = document.createElement("div");
      toast.className = "aio-font-toast";
      const copiedText = getI18nMsg("fontCopied", "Copied!");
      const notCopiedText = getI18nMsg("fontNotCopied", "Not copied");
      toast.textContent = '';
      const label = document.createElement('span');
      label.style.cssText = 'color: #a0a0a8; font-size: 12px; display: block; margin-bottom: 4px;';
      label.textContent = copied ? copiedText : notCopiedText;
      const fontVal = document.createTextNode(cistFont);
      toast.append(label, fontVal);
      document.body.appendChild(toast);
      requestAnimationFrame(() => { toast.style.opacity = "1"; toast.style.transform = "translateX(-50%) translateY(0)"; });
      setTimeout(() => {
        toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(() => { toast.remove(); styleTag.remove(); }, 300);
      }, 2500);
    };
    const escHandler = (e) => { if (e.key === "Escape") cleanup(); };
    const unloadHandler = () => cleanup();
    document.addEventListener("mouseover", mouseOverHandler, true);
    document.addEventListener("mousemove", mouseMoveHandler, true);
    document.addEventListener("click", clickHandler, true);
    document.addEventListener("keydown", escHandler, true);
    window.addEventListener("beforeunload", unloadHandler, true);
  }

  // Slušač za poruke iz background/popup-a
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "toggleColorPicker") {
      chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
        if (response && response.ok) {
          initColorPicker(response.dataUrl);
        }
      });
    } else if (request.action === "toggleRuler") {
      initRuler();
    } else if (request.action === "toggleFontFinder") {
      initFontFinder();
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
    if (el.querySelector('input[type="password"]')) return true;
    if (el.closest('[data-aio-dark-exempt="1"]')) return true;
    return false;
  };

  const elementMatchesIntrusiveText = (el) => {
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!text || text.length > 4000) return false;
    return INTRUSIVE_TEXT_KEYWORDS.some((kw) => text.includes(kw));
  };

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
    } catch (_) {
      return false;
    }
  };

  let originalVolumeDescriptor = null;
  let volumeOverrideActive = false;
  try {
    originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  } catch (_) { }

  const captureBaseVolume = (media) => {
    if (media.hasOwnProperty('_aioBaseVolume')) return media._aioBaseVolume;
    try {
      const actual = originalVolumeDescriptor.get.call(media);
      const lastMult = media._aioLastMultiplier ?? 1.0;
      const computedBase = lastMult > 0 ? (actual / lastMult) : actual;
      media._aioBaseVolume = Number.isFinite(computedBase) ? Math.max(0, Math.min(computedBase, 1)) : 1.0;
    } catch (_) {
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
    } catch (_) {
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
        } catch (_) { }
        media._aioLastMultiplier = 1.0;
        return;
      }
      try {
        originalVolumeDescriptor.set.call(media, base);
        chain.gainNode.gain.setTargetAtTime(multiplier, window.aioVolCtx.currentTime, 0.01);
      } catch (_) { }
      media._aioLastMultiplier = multiplier;
      return;
    }

    if (nodes?.gainNode) {
      try {
        originalVolumeDescriptor.set.call(media, base);
        nodes.gainNode.gain.setTargetAtTime(multiplier, window.aioVolCtx.currentTime, 0.01);
      } catch (_) { }
      media._aioLastMultiplier = multiplier;
      return;
    }

    try {
      const clampedTarget = Math.max(0, Math.min(target, 1.0));
      originalVolumeDescriptor.set.call(media, clampedTarget);
      media._aioLastMultiplier = (clampedTarget > 0 && base > 0) ? (clampedTarget / base) : multiplier;
    } catch (_) {
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
    } catch (_) { }
  };

  const restoreVolumeOverride = () => {
    if (!volumeOverrideActive || !originalVolumeDescriptor || !originalVolumeDescriptor.configurable) return;
    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', originalVolumeDescriptor);
      volumeOverrideActive = false;
    } catch (_) { }
  };

  const captureAllMediaBaselines = () => {
    try {
      document.querySelectorAll("audio, video").forEach((media) => captureBaseVolume(media));
    } catch (_) { }
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
          } catch (_) { }
        }
        try {
          originalVolumeDescriptor.set.call(media, base);
        } catch (_) { }
        delete media._aioBaseVolume;
        delete media._aioLastMultiplier;
      });
    } catch (_) { }

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
    } catch (_) { }
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
        let elements = [body, html, document.querySelector('main'), document.querySelector('[role="application"]'), document.querySelector('#root'), document.querySelector('#__next')];

        for (let el of elements) {
          if (!el) continue;
          let bg = window.getComputedStyle(el).backgroundColor;
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
        html, body, img, video, iframe, canvas, svg, picture, [style*="background-image"] {
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
        img, video, iframe, canvas, svg, picture, [style*="background-image"] { 
          filter: invert(1) hue-rotate(180deg) !important; 
        }
        /* Sprecavanje duplog invertovanja za ugnjezdene elemente */
        img *, video *, iframe *, canvas *, svg *, picture *, [style*="background-image"] * {
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
      } catch (_) { }

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
      if (window.top === window && location.protocol.startsWith("http")) {
      }
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
      } catch (_) { }
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
        } catch (_) {
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
      const elapsedMs = now - lastHeartbeatAt;
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
      } catch (_) { }
      stopTrackerHeartbeat();
    }, false);

    window.addEventListener("beforeunload", () => {
      try {
        flushTrackedTime(Date.now());
      } catch (_) { }
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
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

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