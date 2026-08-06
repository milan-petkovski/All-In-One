import { trackEvent, escapeHtml, getI18nMsg, switchView, showToast } from './popup-core.js';

const trackerList = document.getElementById("trackerList");
const trackerDate = document.getElementById("trackerDate");
const trackerMode = document.getElementById("trackerMode");
const trackerDatePrikaz = document.getElementById("trackerDatePrikaz");
const trackerFileInput = document.getElementById("importTrackerFile");

let trackerRefreshQueue = Promise.resolve();
let renderStatsDebounceId = null;
let trackerDataCache = null;
let trackerDataPromise = null;
const faviconCache = new Map();
const faviconInFlight = new Map();

function invalidateTrackerCache() {
    trackerDataCache = null;
    trackerDataPromise = null;
}

function loadTrackerData() {
    if (trackerDataCache) return Promise.resolve(trackerDataCache);
    if (!trackerDataPromise) {
        trackerDataPromise = new Promise((resolve) => {
            chrome.storage.local.get(["tracker_index"], (indexRes) => {
                const keys = Array.isArray(indexRes.tracker_index) && indexRes.tracker_index.length > 0
                    ? indexRes.tracker_index
                    : null;
                chrome.storage.local.get(keys || null, (items) => {
                    trackerDataCache = items || {};
                    trackerDataPromise = null;
                    resolve(trackerDataCache);
                });
            });
        });
    }
    return trackerDataPromise;
}

async function forceTrackerTickAndRender() {
    trackerRefreshQueue = trackerRefreshQueue.then(async () => {
        let domain = "";
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.url?.startsWith("http")) {
                domain = new URL(activeTab.url).hostname;
            }
        } catch {
            domain = "";
        }
        // Send a message and wait for background confirmation. Use callback wrapper to be reliable across browsers.
        const sendMessageAsync = (msg) => new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(msg, (res) => {
                    if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
                    resolve(res || { ok: false });
                });
            } catch (err) {
                resolve({ ok: false, error: String(err?.message || err) });
            }
        });

        let response = { ok: false };
        try {
            response = await sendMessageAsync({ action: "tracker_force_tick", domain });
        } catch {
            response = { ok: false };
        }

        // Always refresh UI from storage, but return whether background confirmed a refresh
        invalidateTrackerCache();
        renderStats();
        return response.ok === true;
    }).catch(() => {
        // Silent fail
    });
    return trackerRefreshQueue;
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function debouncedRenderStats() {
    clearTimeout(renderStatsDebounceId);
    renderStatsDebounceId = setTimeout(() => {
        requestAnimationFrame(renderStats);
    }, 50);
}

function getUtf8ByteLength(value) {
    try {
        return new TextEncoder().encode(String(value || "")).length;
    } catch {
        return unescape(encodeURIComponent(String(value || ""))).length;
    }
}

function resolveFavicon(domain, imgEl) {
    if (!domain || !imgEl) return;
    if (faviconCache.has(domain)) {
        imgEl.src = faviconCache.get(domain);
        return;
    }

    if (faviconInFlight.has(domain)) return;
    faviconInFlight.set(domain, true);

    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    fetch(faviconUrl)
        .then((res) => res.blob())
        .then((blob) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(blob);
        }))
        .then((dataUrl) => {
            if (dataUrl) {
                faviconCache.set(domain, dataUrl);
                if (imgEl.isConnected) imgEl.src = dataUrl;
            }
        })
        .catch(() => { })
        .finally(() => {
            faviconInFlight.delete(domain);
        });
}

function renderStats() {
    if (!trackerDataCache) {
        loadTrackerData().then(() => renderStats());
        return;
    }

    const today = new Date();
    let selDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (trackerDate?.value && typeof trackerDate.value === "string") {
        const parts = trackerDate.value.split('-').map(Number);
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n > 0)) {
            const [yyyy, mm, dd] = parts;
            if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                selDate = new Date(yyyy, mm - 1, dd);
            }
        } else if (parts.length === 2 && parts.every((n) => Number.isFinite(n) && n > 0)) {
            const [yyyy, mm] = parts;
            if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12) {
                selDate = new Date(yyyy, mm - 1, 1);
            }
        }
    }
    const mode = trackerMode.value;

    let storageQuery = null;
    if (mode === "day" || mode === "month") {
        const yyyy = selDate.getFullYear();
        const mm = selDate.getMonth() + 1;
        storageQuery = [];
        for (let d = 1; d <= 31; d++) {
            storageQuery.push(`tracker_${yyyy}_${mm}_${d}`);
        }
    }

    const items = trackerDataCache || {};
    const scopeItems = storageQuery
        ? Object.fromEntries(Object.entries(items).filter(([key]) => storageQuery.includes(key)))
        : items;

    {
        const selKey = `tracker_${selDate.getFullYear()}_${selDate.getMonth() + 1}_${selDate.getDate()}`;
        const selMonthPrefix = `tracker_${selDate.getFullYear()}_${selDate.getMonth() + 1}_`;
        const listTotals = {};
        let listTotalSec = 0;
        let totalMonth = 0;
        let totalAll = 0;
        let activeDays = 0;
        let activeDaysInMonth = 0;

        for (const key in scopeItems) {
            if (!key.startsWith("tracker_")) continue;
            if (!scopeItems[key] || typeof scopeItems[key] !== "object") continue;
            let daySum = 0;
            for (const dom in scopeItems[key]) {
                const sec = Number(scopeItems[key][dom]);
                if (Number.isFinite(sec) && sec > 0) daySum += sec;
            }
            if (daySum > 0) {
                activeDays++;
            }
            totalAll += daySum;
            if (key.startsWith(selMonthPrefix)) {
                totalMonth += daySum;
                if (daySum > 0) activeDaysInMonth++;
            }
            const shouldInclude = (mode === "day" && key === selKey) ||
                (mode === "month" && key.startsWith(selMonthPrefix)) ||
                (mode === "all");
            if (shouldInclude) {
                listTotalSec += daySum;
                for (const dom in scopeItems[key]) {
                    const sec = Number(scopeItems[key][dom]);
                    if (!Number.isFinite(sec) || sec <= 0) continue;
                    listTotals[dom] = (listTotals[dom] || 0) + sec;
                }
            }
        }

        let secondBoxValue, avgValue;
        const statBox2 = document.getElementById("statBox2");
        const trackerDateWrapper = document.getElementById("trackerDateWrapper");
        if (mode === "all") {
            avgValue = Math.floor(totalAll / (activeDays || 1));
            if (statBox2) statBox2.classList.add("hidden");
            if (trackerDateWrapper) trackerDateWrapper.classList.add("hidden");
        } else if (mode === "month") {
            avgValue = Math.floor(totalMonth / (activeDaysInMonth || 1));
            if (statBox2) statBox2.classList.add("hidden");
            if (trackerDateWrapper) trackerDateWrapper.classList.remove("hidden");
        } else {
            secondBoxValue = totalMonth;
            avgValue = Math.floor(totalMonth / (activeDaysInMonth || 1));
            if (statBox2) statBox2.classList.remove("hidden");
            if (trackerDateWrapper) trackerDateWrapper.classList.remove("hidden");
        }

        document.getElementById("statTotal").textContent = formatTime(listTotalSec);
        if (secondBoxValue !== undefined && statBox2) {
            document.getElementById("statMonth").textContent = formatTime(secondBoxValue);
        }
        document.getElementById("statAvg").textContent = formatTime(avgValue);

        const isCurrentMonth = selDate.getMonth() === today.getMonth() && selDate.getFullYear() === today.getFullYear();
        const isToday = selDate.toDateString() === today.toDateString();
        const label = document.getElementById("statTotalLabel");
        if (mode === "day") {
            label.textContent = isToday ? getI18nMsg("trackerToday", "Danas") : getI18nMsg("trackerThatDay", "Taj dan");
        } else if (mode === "month") {
            label.textContent = isCurrentMonth ? getI18nMsg("trackerThisMonth", "Ovaj mesec") : getI18nMsg("trackerSelectedMonth", "Izabrani mesec");
        } else {
            label.textContent = getI18nMsg("trackerTotal", "Ukupno");
        }

        const monthLabel = document.getElementById("statMonthLabel");
        if (monthLabel && mode === "day") {
            monthLabel.textContent = isCurrentMonth ? getI18nMsg("trackerThisMonthShort", "Ovaj mesec") : getI18nMsg("trackerThatMonth", "Taj mesec");
        }

        const avgLabel = document.getElementById("statAvgLabel");
        if (avgLabel) {
            if (mode === "all") {
                avgLabel.textContent = getI18nMsg("trackerAvgTotal", "Prosek");
            } else {
                avgLabel.textContent = getI18nMsg("trackerAvgThisMonth", "Prosek (mesec)");
            }
        }

        const sorted = Object.entries(listTotals).sort((a, b) => b[1] - a[1]);
        const query = (document.getElementById("trackerSearch")?.value || "").toLowerCase().trim();
        const filtered = sorted.filter(([domain]) => {
            return domain.toLowerCase().includes(query);
        });
        trackerList.innerHTML = filtered.length ? "" : `<div class='empty-msg'>${getI18nMsg("trackerNoData", "Nema podataka za ovaj period")}</div>`;
        filtered.forEach(([domain, sec]) => {
            const percent = ((sec / listTotalSec) * 100).toFixed(1);
            const item = document.createElement("div");
            item.className = "tracker-item";
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; position:relative; z-index:2; align-items:center;">
                    <span style="font-weight:bold; max-width:60%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                        <img data-domain="${domain}" width="16" height="16" style="border-radius:2px; display:inline-block; vertical-align:middle;" alt="">
                        ${escapeHtml(domain)}
                    </span>
                    <span style="color:var(--accent); font-family:monospace;">${formatTime(sec)}</span>
                </div>
                <div class="tracker-bar" style="width: ${percent}%"></div>
            `;
            trackerList.appendChild(item);

            const imgEl = item.querySelector("img[data-domain]");
            if (imgEl) resolveFavicon(domain, imgEl);
        });
    }
}

export function initTracker() {
    // Otvaranje trackera
    document.getElementById("trackerBtn")?.addEventListener("click", () => {
        trackEvent("tracker_open");
        const trackerView = document.getElementById("trackerView");
        if (!trackerView) return;
        switchView("mainView", "trackerView");
        const d = new Date();
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        trackerDate.type = "date";
        trackerDate.value = iso;
        trackerDate.max = iso;
        trackerDatePrikaz.value = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
        trackerMode.value = "day";
        const searchInput = document.getElementById("trackerSearch");
        if (searchInput) searchInput.value = "";
        invalidateTrackerCache();
        forceTrackerTickAndRender();
    });

    document.getElementById("trackerSearch")?.addEventListener("input", () => {
        debouncedRenderStats();
    });

    trackerDate?.addEventListener("change", (e) => {
        trackEvent("tracker_date_change", { value: e.target.value });
        const parts = e.target.value.split("-");
        if (trackerDate.type === "month") {
            trackerDatePrikaz.value = `${parts[1]}.${parts[0]}.`;
        } else {
            trackerDatePrikaz.value = `${parts[2]}.${parts[1]}.${parts[0]}.`;
        }
        debouncedRenderStats();
    });

    trackerMode?.addEventListener("change", (e) => {
        const mode = e.target.value;
        trackEvent("tracker_mode_change", { mode: mode });
        if (mode === "all") {
            debouncedRenderStats();
            return;
        }
        const currentVal = trackerDate.value;
        const parts = currentVal ? currentVal.split('-') : [];
        if (mode === "month") {
            trackerDate.type = "month";
            if (parts.length >= 2) {
                trackerDate.value = `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
                trackerDatePrikaz.value = `${String(parts[1]).padStart(2, '0')}.${parts[0]}.`;
            } else {
                const d = new Date();
                trackerDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                trackerDatePrikaz.value = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
            }
        } else {
            trackerDate.type = "date";
            if (parts.length === 2) {
                trackerDate.value = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
                trackerDatePrikaz.value = `01.${String(parts[1]).padStart(2, '0')}.${parts[0]}.`;
            } else if (parts.length === 3) {
                trackerDatePrikaz.value = `${String(parts[2]).padStart(2, '0')}.${String(parts[1]).padStart(2, '0')}.${parts[0]}.`;
            } else {
                const d = new Date();
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                trackerDate.value = iso;
                trackerDatePrikaz.value = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
            }
        }
        debouncedRenderStats();
    });

    trackerDatePrikaz?.addEventListener("click", () => {
        trackEvent("tracker_date_picker_open");
        if (trackerDate?.showPicker) trackerDate.showPicker();
        else trackerDate?.click();
    });

    let lastRefreshConfirmedAt = 0;
    const REFRESH_COOLDOWN_MS = 5000; // match heartbeat interval to prevent spam

    document.getElementById("trackerRefreshBtn")?.addEventListener("click", async () => {
        trackEvent("tracker_refresh");
        const btn = document.getElementById("trackerRefreshBtn");

        // Prevent spam: if we had a confirmed refresh recently, ignore click silently
        if (Date.now() - lastRefreshConfirmedAt < REFRESH_COOLDOWN_MS) {
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.classList.add("spinning");
        }
        try {
            const ok = await forceTrackerTickAndRender();
            const icon = document.getElementById("trackerRefreshBtn");
            if (ok) {
                lastRefreshConfirmedAt = Date.now();
                if (icon) {
                    icon.style.color = "var(--accent)";
                    setTimeout(() => icon.style.color = "", 500);
                }
                showToast(getI18nMsg("toastTrackerRefreshed", "Podaci su osveženi!"), "success");
            } else {
                // No confirmed refresh: do not show toast to avoid spam. UI already refreshed from storage.
            }
        } catch (err) {
            console.error('tracker refresh click error', err);
            showToast(getI18nMsg("toastTrackerError", "Greška pri osvežavanju"), "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove("spinning");
            }
        }
    });

    document.getElementById("trackerBackBtn")?.addEventListener("click", () => {
        trackEvent("tracker_back");
        switchView("trackerView", "mainView", true);
    });

    // EXPORT
    document.getElementById("exportTrackerBtn")?.addEventListener("click", () => {
        trackEvent("tracker_export");
        chrome.storage.local.get(["tracker_index"], (indexRes) => {
            const indexKeys = Array.isArray(indexRes.tracker_index) && indexRes.tracker_index.length > 0
                ? indexRes.tracker_index
                : null;

            chrome.storage.local.get(indexKeys || null, (items) => {
                const trackerData = {};
                const MAX_TRACKER_EXPORT_BYTES = 10 * 1024 * 1024;
                let accumulatedBytes = 0;
                for (const key in items) {
                    if (key.startsWith("tracker_")) {
                        const jsonChunk = JSON.stringify(items[key]);
                        const chunkBytes = getUtf8ByteLength(jsonChunk);
                        if (accumulatedBytes + chunkBytes > MAX_TRACKER_EXPORT_BYTES) {
                            break;
                        }
                        trackerData[key] = items[key];
                        accumulatedBytes += chunkBytes;
                    }
                }
                if (Object.keys(trackerData).length === 0) return;
                const blob = new Blob([JSON.stringify(trackerData, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `AllInOne_Tracker_Backup.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(getI18nMsg("toastTrackerExported", "Tracker podaci su uspešno izvezeni!"), "success");
            });
        });
    });

    // IMPORT
    trackerFileInput?.addEventListener("change", (e) => {
        trackEvent("tracker_import_confirm");
        const file = e.target.files[0];
        if (!file) return;
        const MAX_TRACKER_IMPORT_BYTES = 10 * 1024 * 1024;
        if (file.size > MAX_TRACKER_IMPORT_BYTES) {
            showToast(getI18nMsg("toastTrackerImportError", "Greška pri uvozu tracker podataka!"), "error");
            e.target.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const raw = String(event.target?.result || "{}");
                const parsed = JSON.parse(raw);
                const data = {};
                Object.keys(parsed || {}).forEach((key) => {
                    if (key.startsWith("tracker_") && parsed[key] && typeof parsed[key] === "object") {
                        const cleanDay = {};
                        Object.keys(parsed[key]).forEach((domain) => {
                            const sec = Number(parsed[key][domain]);
                            const normalizedDomain = String(domain || "").trim().toLowerCase();
                            const isValidDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(normalizedDomain)
                                && normalizedDomain.length <= 255;
                            if (isValidDomain && Number.isFinite(sec) && sec > 0) {
                                cleanDay[normalizedDomain] = Math.floor(sec);
                            }
                        });
                        if (Object.keys(cleanDay).length > 0) {
                            data[key] = cleanDay;
                        }
                    }
                });
                if (Object.keys(data).length === 0) {
                    showToast(getI18nMsg("toastTrackerImportError", "Greška pri uvozu tracker podataka!"), "error");
                    return;
                }
                const index = Object.keys(data);
                chrome.storage.local.set({ ...data, tracker_index: index }, () => {
                    chrome.runtime.sendMessage({ action: "tracker_clear_cache" }).catch(() => { });
                    invalidateTrackerCache();
                    renderStats();
                    showToast(getI18nMsg("toastTrackerImported", "Tracker podaci su uspešno uvezeni!"), "success");
                });
            } catch {
                showToast(getI18nMsg("toastTrackerImportError", "Greška pri uvozu tracker podataka!"), "error");
            }
        };
        reader.readAsText(file);
    });

    document.getElementById("importTrackerBtn")?.addEventListener("click", () => {
        trackEvent("tracker_import_open");
        trackerFileInput.click();
    });
}
