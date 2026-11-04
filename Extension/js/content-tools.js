// Heavy page tools (color picker, ruler, font finder).
// Injected on demand by the background script (action: load_content_tools),
// so the always-on content script stays small.
(() => {
  if (window.__aioTools) return;

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
        } catch {
          resolve({ ok: false });
        }
      });
      if (response.ok && response.messages) {
        contentI18nDict = response.messages;
      } else if (!contentI18nWarned) {
        contentI18nWarned = true;
        console.warn("All In One: translations not loaded for content script.");
      }
    } catch {}
  }
  // Translations load lazily (only when a tool needs them) so pages and frames do not wake the service worker.
  let translationsRequested = false;
  function ensureTranslations() {
    if (translationsRequested) return;
    translationsRequested = true;
    loadTranslations();
  }
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.appLang && translationsRequested) loadTranslations();
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
    ensureTranslations();
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
        const hex = globalThis.aioContentHelpers.rgbToHex(pixel[0], pixel[1], pixel[2]);

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
      } catch {}
    };

    const pickColorAndExit = async () => {
      const x = virtualX;
      const y = virtualY;

      try {
        const physicalX = Math.floor(x * dpr);
        const physicalY = Math.floor(y * dpr);
        const pixel = ctx.getImageData(physicalX, physicalY, 1, 1).data;
        const hex = globalThis.aioContentHelpers.rgbToHex(pixel[0], pixel[1], pixel[2]);
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
      } catch {}
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
      } catch {}
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

        const hasEnoughSpace = (w > 175) && (h > 50);
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

        const getRatio = (width, height) => {
          if (!width || !height) return '';
          const ratio = width / height;
          const standards = [
            { name: '1:1', val: 1 },
            { name: '16:9', val: 16 / 9 },
            { name: '9:16', val: 9 / 16 },
            { name: '4:3', val: 4 / 3 },
            { name: '3:4', val: 3 / 4 },
            { name: '16:10', val: 16 / 10 },
            { name: '21:9', val: 21 / 9 },
            { name: '3:2', val: 3 / 2 },
            { name: '2:3', val: 2 / 3 },
            { name: '5:4', val: 5 / 4 }
          ];
          for (const s of standards) {
            if (Math.abs(ratio - s.val) < 0.04) return s.name;
          }
          const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
          const d = gcd(Math.round(width), Math.round(height));
          const sw = Math.round(width / d);
          const sh = Math.round(height / d);
          if (sw <= 25 && sh <= 25) return `${sw}:${sh}`;
          return `${ratio.toFixed(2)}:1`;
        };
        const ratioText = getRatio(w, h);
        if (ratioText) {
          const div2 = document.createElement('span');
          div2.style.color = 'rgba(255,255,255,0.2)'; div2.textContent = '|';
          const rCont = document.createElement('span');
          rCont.style.color = '#00ff88';
          rCont.style.fontWeight = '700';
          rCont.textContent = ratioText;
          badge.append(wCont, divider, hCont, div2, rCont);
        } else {
          badge.append(wCont, divider, hCont);
        }
        r.appendChild(badge);
      }
    };
    ov.onmouseup = onGlobalMouseUp;
    window.addEventListener("mouseup", onGlobalMouseUp, true);
    document.addEventListener("keydown", esc);
  }

  function initFontFinder() {
    ensureTranslations();
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

  window.__aioTools = { initColorPicker, initRuler, initFontFinder };
})();

