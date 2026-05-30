// --- CORE UTILS & INITIALIZATION ---

export function trackEvent(eventName, eventData = {}) {
    try {
        const pageLocation = tab?.url || location.href;
        const pageTitle = tab?.title || document.title;
        chrome.runtime.sendMessage({
            action: "aio_track_event",
            eventName,
            eventData: {
                ...eventData,
                page_location: pageLocation,
                page_title: pageTitle
            }
        });
    } catch (err) {
        // Ignore errors
    }
}

export function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function getI18nMsg(key, defaultText) {
    if (window.i18nDict && window.i18nDict[key] && window.i18nDict[key].message) {
        return window.i18nDict[key].message;
    }
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage(key);
        if (msg) return msg;
    }
    return defaultText;
}

// Make getI18nMsg available globally as requested by popup.js specification
window.getI18nMsg = getI18nMsg;

export let tab = null;
export let host = null;
export let currentLang = 'sr';
export let elements = {};

export async function initCore() {
    const appLangData = await chrome.storage.local.get(['appLang']);
    currentLang = appLangData.appLang || 'sr';

    const rtlLangs = new Set(["ar", "he", "fa"]);
    if (rtlLangs.has(currentLang)) {
        document.documentElement.setAttribute("dir", "rtl");
    } else {
        document.documentElement.setAttribute("dir", "ltr");
    }

    // Fetch translations
    try {
        const res = await fetch(chrome.runtime.getURL(`_locales/${currentLang}/messages.json`));
        window.i18nDict = await res.json();
    } catch (e) {
        // Silent fail in production
    }

    // Apply translations
    if (window.i18nDict) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (window.i18nDict[key]) {
                const fullMessage = window.i18nDict[key].message;
                el.textContent = fullMessage;
                el.setAttribute('title', fullMessage);
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (window.i18nDict[key]) {
                if (el.isContentEditable) {
                    el.setAttribute('data-placeholder', window.i18nDict[key].message);
                } else {
                    el.setAttribute('placeholder', window.i18nDict[key].message);
                }
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (window.i18nDict[key]) {
                el.setAttribute('title', window.i18nDict[key].message);
            }
        });
    }

    // Query tab/host
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = tabs?.[0];
        const url = tab?.url || "";
        if (url && url.startsWith("http")) {
            try {
                host = new URL(url).hostname;
            } catch (e) {
                host = null;
            }
        }
    } catch (err) {
        host = null;
    }

    // Initialize elements
    elements.radioBtn = document.getElementById("radioBtn");
    elements.radioVol = document.getElementById("radioVol");
    elements.masterVol = document.getElementById("masterVol");
    elements.volText = document.getElementById("volText");
    elements.colorBtn = document.getElementById("colorBtn");
    elements.nightToggle = document.getElementById("nightToggle");
    elements.copyToggle = document.getElementById("copyToggle");
    elements.ytToggle = document.getElementById("ytToggle");
    elements.rulerBtn = document.getElementById("rulerBtn");
    elements.markerBtn = document.getElementById("markerBtn");
    elements.resetVolBtn = document.getElementById("resetVolBtn");
    elements.clearCacheBtn = document.getElementById("clearCacheBtn");
    elements.fontBtn = document.getElementById("fontBtn");
    elements.notesBtn = document.getElementById("notesBtn");
    elements.trackerBtn = document.getElementById("trackerBtn");
    elements.counterBtn = document.getElementById("counterBtn");
    elements.stopwatchBtn = document.getElementById("stopwatchBtn");
    elements.cookieModal = document.getElementById("cookieModal");
    elements.cookieToggle = document.getElementById("cookieToggle");
    elements.cookieWhitelistToggle = document.getElementById("cookieWhitelistToggle");
    elements.closeCookieModal = document.getElementById("closeCookieModal");
    elements.realClearBtn = document.getElementById("realClearBtn");
    elements.importRadioBtn = document.getElementById("importRadioBtn");
    elements.radioImportModal = document.getElementById("radioImportModal");
    elements.radioUrlInput = document.getElementById("radioUrlInput");
    elements.saveRadioUrlBtn = document.getElementById("saveRadioUrlBtn");
    elements.closeRadioModal = document.getElementById("closeRadioModal");
    elements.clearRadioInput = document.getElementById("clearRadioInput");
    elements.radioCardTitle = document.getElementById("radioCardTitle");
    elements.radioModalTitle = document.getElementById("radioModalTitle");

    // Restricted overlay for system pages
    if (!host) {
        document.body.classList.add("restricted-session");
        const mainView = document.getElementById("mainView");
        const overlay = document.createElement("div");
        overlay.className = "restricted-overlay";

        const content = document.createElement("div");
        content.className = "overlay-content";

        const lockGlow = document.createElement("div");
        lockGlow.className = "lock-glow";
        lockGlow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

        const p = document.createElement("p");
        p.textContent = getI18nMsg("systemPageTitle", "SISTEMSKA STRANICA");

        const span = document.createElement("span");
        span.textContent = getI18nMsg("systemPageDesc", "Alati za modifikaciju su onemogućeni");

        content.append(lockGlow, p, span);
        overlay.appendChild(content);
        mainView.appendChild(overlay);
    }

    // Inicijalni jezik i listener za promenu jezika
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', async (e) => {
            await chrome.storage.local.set({ appLang: e.target.value });
            window.location.reload();
        });
    }

    // --- GLOBAL TOOLTIP FOR SLIDERS ---
    const tooltip = document.createElement('div');
    tooltip.className = 'sliderTooltip';
    document.body.appendChild(tooltip);

    const sliders = document.querySelectorAll('.range-slider');
    sliders.forEach(slider => {
        const azuriraj = (e) => {
            const val = slider.value;
            const min = slider.min || 0;
            const max = slider.max || 100;
            const percent = (val - min) / (max - min);
            const rect = slider.getBoundingClientRect();
            const thumbWidth = 12;
            const offset = (rect.width - thumbWidth) * percent;
            const thumbCenter = rect.left + (thumbWidth / 2) + offset;
            const isOverThumb = e ? Math.abs(e.clientX - thumbCenter) < 15 : false;
            if (isOverThumb || (e && e.type === 'input')) {
                tooltip.textContent = val + '%';
                tooltip.style.opacity = '1';
                tooltip.style.left = thumbCenter + 'px';
                tooltip.style.top = (rect.top - 30) + 'px';
            } else {
                tooltip.style.opacity = '0';
            }
        }
        slider.addEventListener('mousemove', azuriraj);
        slider.addEventListener('input', azuriraj);
        slider.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
    });

    // --- STATE RESTORE ---
    let lastSentVolume = null;
    const stateIds = ["nightToggle", "ytToggle"];
    const keysToGet = [...stateIds, "global_vol"];
    if (host) {
        keysToGet.push(host);
    }
    chrome.storage.local.get(keysToGet, (res) => {
        if (chrome.runtime.lastError) return;
        stateIds.forEach(id => {
            if (elements[id] && res[id] !== undefined) elements[id].checked = res[id];
        });
        if (host) {
            if (elements.copyToggle) elements.copyToggle.checked = Boolean(res[host]);
        } else {
            if (elements.copyToggle) elements.copyToggle.disabled = true;
        }
        const globalVol = Number(res.global_vol);
        const savedVol = Number.isFinite(globalVol) ? globalVol : 100;
        if (elements.masterVol) {
            elements.masterVol.value = savedVol;
            lastSentVolume = savedVol;
            const volTextEl = document.getElementById("volText");
            if (volTextEl) volTextEl.textContent = savedVol + "%";
        }
    });

    // --- VOLUME MASTER LOGIC ---
    const applyVolume = (val) => {
        const numVal = Number(val);
        if (!Number.isFinite(numVal) || numVal === lastSentVolume) return;
        lastSentVolume = numVal;
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "setMasterVolume", value: numVal }).catch(() => { });
        }
        chrome.storage.local.set({ global_vol: numVal }).catch(() => { });
    };

    elements.masterVol?.addEventListener("input", (e) => {
        const val = e.target.value;
        const volTextEl = document.getElementById("volText");
        if (volTextEl) volTextEl.textContent = val + "%";
        applyVolume(val);
    });

    elements.masterVol?.addEventListener("change", (e) => {
        const val = parseInt(e.target.value);
        trackEvent("master_volume_change", { value: val });
        applyVolume(val);
    });

    elements.resetVolBtn?.addEventListener("click", () => {
        trackEvent("master_volume_reset");
        const vol = 100;
        if (elements.masterVol) {
            elements.masterVol.value = vol;
            const volTextEl = document.getElementById("volText");
            if (volTextEl) volTextEl.textContent = vol + "%";
            applyVolume(vol);
        }
    });

    // --- TOGGLES & TRIGGERS (Color picker, Night mode, Ruler, Marker, Cache, Font Finder) ---
    elements.colorBtn?.addEventListener("click", () => {
        trackEvent("color_picker_open");
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "toggleColorPicker" });
        }
        window.close();
    });

    elements.nightToggle?.addEventListener("change", (e) => {
        const isNight = e.target.checked;
        trackEvent(isNight ? "dark_mode_on" : "dark_mode_off");
        chrome.storage.local.set({ nightToggle: isNight });
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "setDarkMode", enabled: isNight }).catch(() => { });
        }
        showToast(isNight ? getI18nMsg("toastDarkModeOn", "Tamni režim aktiviran") : getI18nMsg("toastDarkModeOff", "Svetli režim aktiviran"), "success");
    });

    elements.copyToggle?.addEventListener("change", (e) => {
        const isCopy = e.target.checked;
        trackEvent(isCopy ? "enable_copy_on" : "enable_copy_off");
        if (host) {
            chrome.storage.local.set({ [host]: isCopy }).catch(() => { });
        }
        showToast(isCopy ? getI18nMsg("toastCopyOn", "Kopiranje omogućeno za ovaj sajt") : getI18nMsg("toastCopyOff", "Kopiranje onemogućeno"), "success");
    });

    elements.ytToggle?.addEventListener("change", (e) => {
        const isYtEnabled = e.target.checked;
        trackEvent(isYtEnabled ? "yt_dislike_on" : "yt_dislike_off");
        chrome.storage.local.set({ ytToggle: isYtEnabled }).catch(() => { });
        if (isYtEnabled && host && elements.masterVol) {
            const currentVol = Number(elements.masterVol.value);
            if (Number.isFinite(currentVol) && currentVol > 100) {
                applyVolume(currentVol);
            }
        }
        showToast(isYtEnabled ? getI18nMsg("toastYtOn", "YouTube Dislike prikazi omogućeni") : getI18nMsg("toastYtOff", "YouTube Dislike prikazi onemogućeni"), "success");
    });

    elements.rulerBtn?.addEventListener("click", () => {
        trackEvent("page_ruler_open");
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "toggleRuler" });
        }
        window.close();
    });

    elements.markerBtn?.addEventListener("click", () => {
        trackEvent("page_marker_open");
        if (tab?.id) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["marker_engine.js"] }, () => {
                if (chrome.runtime.lastError) return;
                chrome.tabs.sendMessage(tab.id, { action: "initMarker" });
                window.close();
            });
        }
    });

    elements.fontBtn?.addEventListener("click", () => {
        trackEvent("font_finder_click");
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "toggleFontFinder" });
        }
        window.close();
    });

    // Cookies and Cache Modal
    elements.clearCacheBtn?.addEventListener("click", (e) => {
        trackEvent("cookies_cache_open");
        e.preventDefault();
        if (elements.cookieModal) elements.cookieModal.classList.remove("hidden");
    });

    elements.closeCookieModal?.addEventListener("click", () => {
        if (elements.cookieModal) elements.cookieModal.classList.add("hidden");
    });

    const refreshCurrentTab = (delayMs = 400) => {
        if (!tab?.id || !tab.url?.startsWith("http")) return;
        setTimeout(() => chrome.tabs.reload(tab.id), delayMs);
    };

    elements.realClearBtn?.addEventListener("click", async () => {
        trackEvent("clear_site_data");
        if (!tab || !tab.url || !tab.url.startsWith("http")) {
            elements.realClearBtn.innerText = getI18nMsg("cacheNotSupported", "Nije podržano");
            setTimeout(() => elements.realClearBtn.innerText = getI18nMsg("cacheClearConfirm", "Obriši sve podatke sa ovog sajta"), 1500);
            return;
        }

        try {
            const hasPerm = await chrome.permissions.contains({ permissions: ["browsingData"] });
            if (!hasPerm) {
                const granted = await chrome.permissions.request({ permissions: ["browsingData"] });
                if (!granted) {
                    showToast(getI18nMsg("toastPermissionDenied", "Dozvola nije odobrena"), "error");
                    return;
                }
            }
        } catch (_) {
            showToast(getI18nMsg("toastPermissionDenied", "Dozvola nije odobrena"), "error");
            return;
        }
        const originalText = elements.realClearBtn.innerText;
        elements.realClearBtn.innerText = getI18nMsg("cacheClearing", "Brisanje...");
        chrome.runtime.sendMessage({ action: "clearSiteData", url: tab.url }, (response) => {
            if (chrome.runtime.lastError || !response?.ok) {
                elements.realClearBtn.innerText = getI18nMsg("cacheError", "Greška");
                setTimeout(() => {
                    elements.realClearBtn.innerText = originalText;
                }, 1200);
                return;
            }
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    try { sessionStorage.clear(); } catch (_) { }
                    try { localStorage.clear(); } catch (_) { }
                    try {
                        if (window.indexedDB && indexedDB.databases) {
                            const dbs = await indexedDB.databases();
                            await Promise.all((dbs || []).map((db) => new Promise((resolve) => {
                                if (!db?.name) return resolve();
                                try {
                                    const req = indexedDB.deleteDatabase(db.name);
                                    req.onsuccess = () => resolve();
                                    req.onerror = () => resolve();
                                    req.onblocked = () => resolve();
                                } catch (_) {
                                    resolve();
                                }
                            })));
                        }
                    } catch (_) { }
                    try {
                        if (window.caches && caches.keys) {
                            const keys = await caches.keys();
                            await Promise.all(keys.map((key) => caches.delete(key)));
                        }
                    } catch (_) { }
                    try {
                        if (navigator.serviceWorker?.getRegistrations) {
                            const regs = await navigator.serviceWorker.getRegistrations();
                            await Promise.all(regs.map((r) => r.unregister()));
                        }
                    } catch (_) { }
                }
            }).catch(() => { });
            elements.realClearBtn.innerText = getI18nMsg("cacheCleared", "Obrisano!");
            showToast(getI18nMsg("toastCacheCleared", "Svi podaci sa ovog sajta su obrisani!"), "success");
            setTimeout(() => {
                elements.realClearBtn.innerText = originalText;
                if (elements.cookieModal) elements.cookieModal.classList.add("hidden");
                refreshCurrentTab(0);
            }, 700);
        });
    });

    chrome.storage.local.get(["cookieBlock"], (res) => {
        if (elements.cookieToggle) elements.cookieToggle.checked = res.cookieBlock || false;
    });

    if (elements.cookieWhitelistToggle) {
        if (!host) {
            elements.cookieWhitelistToggle.disabled = true;
        }
        chrome.storage.local.get(["cookieWhitelist"], (res) => {
            const list = Array.isArray(res.cookieWhitelist) ? res.cookieWhitelist : [];
            if (host) elements.cookieWhitelistToggle.checked = list.includes(host);
        });

        elements.cookieWhitelistToggle.addEventListener("change", async (e) => {
            if (!host) return;
            const isEnabled = e.target.checked === true;
            try {
                const res = await chrome.storage.local.get(["cookieWhitelist"]);
                const list = Array.isArray(res.cookieWhitelist) ? res.cookieWhitelist : [];
                const next = isEnabled
                    ? Array.from(new Set([...list, host]))
                    : list.filter((item) => item !== host);
                await chrome.storage.local.set({ cookieWhitelist: next });
                showToast(isEnabled
                    ? getI18nMsg("toastCookieWhitelistOn", "Kolačići dozvoljeni za ovaj sajt")
                    : getI18nMsg("toastCookieWhitelistOff", "Kolačići blokirani za ovaj sajt"), "success");
                refreshCurrentTab();
            } catch (_) {
                showToast(getI18nMsg("toastCookieWhitelistError", "Greška pri promeni liste"), "error");
            }
        });
    }

    elements.cookieToggle?.addEventListener("change", async (e) => {
        const isBlocking = e.target.checked;
        trackEvent(isBlocking ? "cookie_blocker_on" : "cookie_blocker_off");
        try {
            await chrome.storage.local.set({ cookieBlock: isBlocking });
            showToast(isBlocking ? getI18nMsg("toastCookieOn", "Automatsko blokiranje kolačića je uključeno") : getI18nMsg("toastCookieOff", "Automatsko blokiranje kolačića je isključeno"), "success");
            refreshCurrentTab();
        } catch (err) {
            // Silent fail
        }
    });

    // What's New logic (Dynamic from updates.json)
    const whatsNewOverlay = document.getElementById("whatsNewOverlay");
    const closeWhatsNewBtn = document.getElementById("closeWhatsNewBtn");
    const currentVersion = chrome.runtime.getManifest().version;

    if (closeWhatsNewBtn && whatsNewOverlay) {
        closeWhatsNewBtn.addEventListener("click", () => {
            whatsNewOverlay.classList.add("hidden");
            chrome.storage.local.set({ whatsNewShownForVersion: currentVersion });
        });
    }

    chrome.storage.local.get(["whatsNewShownForVersion"], async (res) => {
        if (res.whatsNewShownForVersion !== currentVersion) {
            try {
                const response = await fetch("https://allinone.milanwebportal.com/updates.json");
                if (!response.ok) throw new Error("Network response was not ok");
                const updates = await response.json();

                let updateInfo = updates.find(u => u.verzija === currentVersion);
                if (!updateInfo && updates.length) {
                    updateInfo = updates.find(u => u.aktivno) || updates[0];
                }

                if (updateInfo) {
                    const titleEl = document.getElementById("whatsNewTitle");
                    const descEl = document.getElementById("whatsNewDesc");
                    const dateEl = document.getElementById("whatsNewDate");
                    const featuresEl = document.getElementById("whatsNewFeatures");

                    const lang = (currentLang === "sr" || currentLang === "en") ? currentLang : "en";
                    const translation = updateInfo[lang] || updateInfo["en"];

                    if (titleEl) {
                        const titlePrefix = lang === "sr" ? "ŠTA JE NOVO U VERZIJI" : "WHAT'S NEW IN VERSION";
                        titleEl.innerText = `${titlePrefix} ${updateInfo.verzija}`;
                    }
                    if (descEl) {
                        descEl.innerText = translation.naslov || "";
                    }
                    if (dateEl) {
                        dateEl.innerText = translation.datum || "";
                    }
                    if (featuresEl) {
                        featuresEl.innerText = translation.opis || "";
                    }

                    whatsNewOverlay?.classList.remove("hidden");
                }
            } catch (err) {
                const titleEl = document.getElementById("whatsNewTitle");
                const featuresEl = document.getElementById("whatsNewFeatures");
                const lang = (currentLang === "sr") ? "sr" : "en";

                if (titleEl) {
                    titleEl.innerText = lang === "sr" ? `ŠTA JE NOVO U VERZIJI ${currentVersion}` : `WHAT'S NEW IN VERSION ${currentVersion}`;
                }
                if (featuresEl) {
                    featuresEl.innerText = lang === "sr"
                        ? "Uspešno ste ažurirali ekstenziju! Posetite naš sajt da biste videli detaljan spisak izmena."
                        : "Extension successfully updated! Visit our website to see the detailed changelog.";
                }
                whatsNewOverlay?.classList.remove("hidden");
            }
        }
    });

    const setupKeyboardNavigation = () => {
        const clickableCards = document.querySelectorAll(".card.clickable");
        clickableCards.forEach((card) => {
            if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "0");
            card.setAttribute("role", "button");
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    card.click();
                }
            });
        });

        const isEditable = (el) => {
            if (!el) return false;
            const tag = el.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
        };

        const getActiveView = () => {
            return document.querySelector(".sub-view.view-visible") || document.getElementById("mainView");
        };

        const getFocusable = (root) => {
            if (!root) return [];
            const list = root.querySelectorAll("button, [href], input, select, textarea, [tabindex='0']");
            return Array.from(list).filter((el) => !el.disabled && el.offsetParent !== null);
        };

        document.addEventListener("keydown", (e) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) === -1) return;
            if (isEditable(e.target)) return;

            const root = getActiveView();
            const focusable = getFocusable(root);
            if (focusable.length === 0) return;

            const active = document.activeElement;
            const currentIndex = focusable.indexOf(active);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % focusable.length : 0;
            const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + focusable.length) % focusable.length : 0;

            e.preventDefault();
            if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                focusable[prevIndex].focus();
            } else {
                focusable[nextIndex].focus();
            }
        });
    };

    setupKeyboardNavigation();
}

// --- DYNAMIC UI FUNCTIONS ---

export function switchView(fromId, toId, isBack = false) {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    if (!fromEl || !toEl) return;

    if (!isBack) {
        // Forward: fromEl (mainView) -> toEl (subView)
        toEl.classList.remove("hidden", "view-hidden");
        toEl.classList.add("view-slide-right");

        // Force reflow
        toEl.offsetHeight;

        toEl.classList.remove("view-slide-right");
        toEl.classList.add("view-visible");
        fromEl.classList.add("view-slide-left");

        setTimeout(() => {
            fromEl.classList.add("view-hidden");
            // Focus textarea after transition is complete to prevent layout bounce
            if (toId === "notesView") {
                document.getElementById("noteArea")?.focus();
            } else if (toId === "counterView") {
                document.getElementById("counterArea")?.focus();
            }
        }, 300);
    } else {
        // Backward: fromEl (subView) -> toEl (mainView)
        toEl.classList.remove("hidden", "view-hidden");
        toEl.classList.add("view-slide-left");

        // Force reflow
        toEl.offsetHeight;

        toEl.classList.remove("view-slide-left");
        fromEl.classList.add("view-slide-right");
        fromEl.classList.remove("view-visible");

        setTimeout(() => {
            fromEl.classList.add("view-hidden");
            fromEl.classList.remove("view-slide-right");
        }, 300);
    }
}

export function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    // Limit to max 3 toasts
    const activeToasts = container.querySelectorAll(".toast:not(.toast-fade-out)");
    if (activeToasts.length >= 3) {
        const oldest = activeToasts[0];
        oldest.classList.add("toast-fade-out");
        setTimeout(() => oldest.remove(), 300);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else { // info
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#007bff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    // build toast content safely
    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast-icon';
    // iconSvg is a static SVG string defined above
    iconWrap.innerHTML = iconSvg;

    const msgWrap = document.createElement('span');
    msgWrap.className = 'toast-message';
    msgWrap.textContent = String(message || '');

    toast.appendChild(iconWrap);
    toast.appendChild(msgWrap);

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add("toast-fade-out");
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
}


