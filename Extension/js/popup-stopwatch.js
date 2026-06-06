import { trackEvent, getI18nMsg, currentLang, switchView, showToast } from './popup-core.js';

const swModal = document.getElementById("customModal");
let swInterval;
let swHistoryWriteQueue = Promise.resolve();
let stopwatchInitialized = false;
let swUiRafId = null;
let swUiActive = false;
let swLastUiTick = 0;

const swFormat = (ms) => {
    if (!Number.isFinite(ms)) return "00:00:00";
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600).toString().padStart(2, '0');
    const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

let swRefreshUIDebounceId = null;
const swRefreshUI = () => {
    if (swRefreshUIDebounceId) clearTimeout(swRefreshUIDebounceId);
    swRefreshUIDebounceId = setTimeout(() => {
        requestAnimationFrame(() => {
            chrome.storage.local.get(["isRunning", "startTime", "currentLaps"], (data) => {
                const timerEl = document.getElementById("timer");
                const statusEl = document.getElementById("status");
                const lapsList = document.getElementById("laps");
                if (!timerEl || !statusEl || !lapsList) return;
                const isRunning = data.isRunning === true;
                const startTime = Number.isFinite(data.startTime) ? data.startTime : 0;
                const currentLaps = Array.isArray(data.currentLaps) ? data.currentLaps : [];
                if (isRunning) {
                    timerEl.innerText = swFormat(Date.now() - startTime);
                    statusEl.innerText = getI18nMsg("swStatusLive", "LAJV U TOKU");
                    statusEl.style.color = "var(--danger)";
                } else {
                    timerEl.innerText = "00:00:00";
                    statusEl.innerText = getI18nMsg("swStatusReady", "SPREMAN");
                    statusEl.style.color = "var(--text-dim)";
                }
                while (lapsList.firstChild) lapsList.removeChild(lapsList.firstChild);
                if (currentLaps.length > 0) {
                    currentLaps.slice().reverse().forEach((lapMs, index) => {
                        const originalIndex = currentLaps.length - 1 - index;
                        const prevLap = originalIndex > 0 ? Number(currentLaps[originalIndex - 1]) : 0;
                        const lapDelta = Number.isFinite(lapMs) ? Math.max(0, lapMs - (Number.isFinite(prevLap) ? prevLap : 0)) : 0;
                        const lapContainer = document.createElement("div");
                        lapContainer.style.display = "flex";
                        lapContainer.style.width = "100%";
                        lapContainer.style.alignItems = "center";
                        lapContainer.style.justifyContent = "space-between";
                        lapContainer.style.padding = "2px 0";
                        const lapLi = document.createElement("span");
                        const lapTime = Number.isFinite(lapDelta) ? lapDelta : 0;
                        const lapIndex = originalIndex + 1;
                        lapLi.style.flex = "1";
                        const idxSpan = document.createElement('span');
                        idxSpan.textContent = `${lapIndex}: `;
                        const bold = document.createElement('b');
                        bold.textContent = swFormat(lapTime);
                        lapLi.appendChild(idxSpan);
                        lapLi.appendChild(bold);
                        lapContainer.appendChild(lapLi);
                        const undoBtn = document.createElement("button");
                        undoBtn.innerText = "✕";
                        undoBtn.className = "secondary icon-btn lap-undo-btn";
                        undoBtn.title = getI18nMsg("swUndoTitle", "Obriši ovaj momenat");
                        undoBtn.onclick = () => {
                            const newLaps = currentLaps.filter((_, i) => i !== originalIndex);
                            chrome.storage.local.set({ currentLaps: newLaps }, () => {
                                swRefreshUI();
                            });
                        };
                        lapContainer.appendChild(undoBtn);
                        const li = document.createElement("li");
                        li.appendChild(lapContainer);
                        lapsList.appendChild(li);
                    });
                } else {
                    const empty = document.createElement('div');
                    empty.className = 'empty-msg';
                    empty.textContent = getI18nMsg("swNoLaps", "Nema zabeleženih momenata");
                    lapsList.appendChild(empty);
                }
            });
        });
    }, 80);
};

let swRenderHistoryDebounceId = null;
const swRenderHistory = () => {
    if (swRenderHistoryDebounceId) clearTimeout(swRenderHistoryDebounceId);
    swRenderHistoryDebounceId = setTimeout(() => {
        requestAnimationFrame(() => {
            chrome.storage.local.get(["history"], (data) => {
                const historyList = document.getElementById("history-list");
                if (!historyList) return;
                while (historyList.firstChild) historyList.removeChild(historyList.firstChild);
                const history = Array.isArray(data.history) ? data.history : [];
                const limitedHistory = history.slice(-20);
                if (limitedHistory.length > 0) {
                    limitedHistory.slice().reverse().forEach((session, idx) => {
                        if (!session || typeof session !== "object") return;
                        const realIdx = history.length - idx;
                        const details = document.createElement("details");
                        const summary = document.createElement("summary");
                        const sessionTime = Number.isFinite(session.sessionStart) ? new Date(session.sessionStart) : new Date();
                        const sessionLaps = Array.isArray(session.laps) ? session.laps : [];
                        const sessionDurationMs = sessionLaps.length > 0 ? sessionLaps[sessionLaps.length - 1] : 0;
                        const endTime = new Date(sessionTime.getTime() + Math.max(0, sessionDurationMs));
                        const sessionDateStr = sessionTime.toLocaleDateString(currentLang);
                        const startTimeStr = sessionTime.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' });
                        const endTimeStr = endTime.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' });
                        const titleSpan = document.createElement('span');
                        titleSpan.textContent = `${getI18nMsg("swLiveTitlePrefix", "Lajv #")}${realIdx}`;
                        const small = document.createElement('small');
                        small.style.color = 'var(--text-dim)';
                        small.style.fontWeight = 'normal';
                        small.textContent = `${sessionDateStr} ${startTimeStr} - ${endTimeStr} | ${getI18nMsg("swDurationLabel", "Trajanje: ")}${swFormat(sessionDurationMs)}`;
                        summary.appendChild(titleSpan);
                        summary.appendChild(document.createTextNode(' '));
                        summary.appendChild(small);

                        details.addEventListener("click", function () {
                            if (!this.open) {
                                document.querySelectorAll("#history-list details").forEach(d => {
                                    if (d !== this) d.removeAttribute("open");
                                });
                            }
                        });

                        const contentDiv = document.createElement("div");
                        contentDiv.className = "session-content";
                        const ul = document.createElement("ul");
                        ul.style.listStyle = "none";
                        ul.style.padding = "0";
                        sessionLaps.forEach((lap, i) => {
                            const li = document.createElement("li");
                            li.style.display = "flex";
                            li.style.justifyContent = "space-between";
                            li.style.fontSize = "11px";
                            li.style.padding = "4px 0";
                            li.style.borderBottom = "1px solid rgba(255,255,255,0.03)";
                            const prevLap = i > 0 ? Number(sessionLaps[i - 1]) : 0;
                            const lapDelta = Number.isFinite(lap) ? Math.max(0, lap - (Number.isFinite(prevLap) ? prevLap : 0)) : 0;
                            const left = document.createElement('span');
                            left.style.color = 'var(--text-dim)';
                            left.textContent = `${getI18nMsg("swMomentLabel", "Momenat ")}${i + 1}`;
                            const rightBold = document.createElement('b');
                            rightBold.textContent = swFormat(lapDelta);
                            li.appendChild(left);
                            li.appendChild(document.createTextNode(' '));
                            li.appendChild(rightBold);
                            ul.appendChild(li);
                        });

                        const downloadBtn = document.createElement("button");
                        downloadBtn.innerText = getI18nMsg("swExportTxtBtn", "EKSPORTUJ KAO .TXT");
                        downloadBtn.className = "export-btn-mini";
                        downloadBtn.onclick = () => {
                            try {
                                const sessionDateFull = Number.isFinite(session.sessionStart) ? new Date(session.sessionStart).toLocaleString(currentLang) : new Date().toLocaleString(currentLang);
                                let txt = `${getI18nMsg("swLiveTitlePrefix", "LAJV #").toUpperCase()}${realIdx} | ${sessionDateFull}\n--------------------------\n`;
                                const exportLaps = Array.isArray(session.laps) ? session.laps : [];
                                txt += `${getI18nMsg("swTotalDurationPrefix", "UKUPNO TRAJANJE: ")}${swFormat(exportLaps.length > 0 ? exportLaps[exportLaps.length - 1] : 0)}\n\n`;
                                exportLaps.forEach((l, i) => {
                                    const prevLap = i > 0 ? Number(exportLaps[i - 1]) : 0;
                                    const lapDelta = Number.isFinite(l) ? Math.max(0, l - (Number.isFinite(prevLap) ? prevLap : 0)) : 0;
                                    txt += `${i + 1}. ${swFormat(lapDelta)}\n`;
                                });
                                const blob = new Blob([txt], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `lajv_${realIdx}.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                            } catch (err) {
                                // Silent fail
                            }
                        };

                        const copyBtn = document.createElement("button");
                        copyBtn.innerText = getI18nMsg("swCopyBtn", "KOPIRAJ U KLIPBORD");
                        copyBtn.className = "export-btn-mini";
                        copyBtn.style.backgroundColor = "var(--accent)";
                        copyBtn.style.color = "#000";
                        copyBtn.onclick = () => {
                            try {
                                const sessionDateFull = Number.isFinite(session.sessionStart) ? new Date(session.sessionStart).toLocaleString(currentLang) : new Date().toLocaleString(currentLang);
                                let txt = `${getI18nMsg("swLiveTitlePrefix", "LAJV #").toUpperCase()}${realIdx} | ${sessionDateFull}\n`;
                                const exportLaps = Array.isArray(session.laps) ? session.laps : [];
                                txt += `${getI18nMsg("swTotalDurationPrefix", "UKUPNO TRAJANJE: ")}${swFormat(exportLaps.length > 0 ? exportLaps[exportLaps.length - 1] : 0)}\n\n`;
                                exportLaps.forEach((l, i) => {
                                    const prevLap = i > 0 ? Number(exportLaps[i - 1]) : 0;
                                    const lapDelta = Number.isFinite(l) ? Math.max(0, l - (Number.isFinite(prevLap) ? prevLap : 0)) : 0;
                                    txt += `${i + 1}. ${swFormat(lapDelta)}\n`;
                                });
                                navigator.clipboard.writeText(txt).then(() => {
                                    copyBtn.innerText = getI18nMsg("swCopiedBtn", "✓ KOPIRANO");
                                    setTimeout(() => { copyBtn.innerText = getI18nMsg("swCopyBtn", "KOPIRAJ U KLIPBORD"); }, 2000);
                                }).catch(() => {
                                    // Silent fail
                                });
                            } catch (err) {
                                // Silent fail
                            }
                        };
                        contentDiv.appendChild(ul);
                        const actionButtons = document.createElement("div");
                        actionButtons.className = "session-actions";
                        actionButtons.appendChild(downloadBtn);
                        actionButtons.appendChild(copyBtn);
                        contentDiv.appendChild(actionButtons);
                        details.appendChild(summary);
                        details.appendChild(contentDiv);
                        historyList.appendChild(details);
                    });
                } else {
                    const noHist = document.createElement('div');
                    noHist.className = 'no-history';
                    noHist.textContent = getI18nMsg("swNoHistory", "Nema istorije lajvova");
                    historyList.appendChild(noHist);
                }
            });
        });
    }, 100);
};

export function initStopwatch() {
    if (stopwatchInitialized) return;
    stopwatchInitialized = true;

    const startUiTicker = () => {
        swUiActive = true;
        swLastUiTick = 0;
        const tick = (time) => {
            if (!swUiActive) return;
            if (time - swLastUiTick > 200) {
                swLastUiTick = time;
                swRefreshUI();
            }
            swUiRafId = requestAnimationFrame(tick);
        };
        swUiRafId = requestAnimationFrame(tick);
    };

    const stopUiTicker = () => {
        swUiActive = false;
        if (swUiRafId) cancelAnimationFrame(swUiRafId);
        swUiRafId = null;
    };

    document.getElementById("stopwatchBtn")?.addEventListener("click", () => {
        trackEvent("stopwatch_open");
        switchView("mainView", "stopwatchView");
        if (swInterval) clearInterval(swInterval);
        stopUiTicker();
        startUiTicker();
        swRenderHistory();
        swRefreshUI();
    });

    document.getElementById("swBackBtn")?.addEventListener("click", () => {
        trackEvent("stopwatch_back");
        switchView("stopwatchView", "mainView", true);
        if (swInterval) clearInterval(swInterval);
        stopUiTicker();
    });

    window.addEventListener("beforeunload", () => {
        if (swInterval) clearInterval(swInterval);
        stopUiTicker();
    }, { once: true });

    document.getElementById("start")?.addEventListener("click", () => {
        trackEvent("stopwatch_start");
        chrome.storage.local.get(["isRunning"], (data) => {
            if (data.isRunning === true) return;
            const now = Date.now();
            chrome.storage.local.set({ isRunning: true, startTime: now, currentLaps: [] }, swRefreshUI);
            chrome.runtime.sendMessage({ action: "sw_start_session" }).catch(() => { });
        });
    });

    document.getElementById("lap")?.addEventListener("click", () => {
        trackEvent("stopwatch_lap");
        chrome.runtime.sendMessage({ action: "manual_lap" });
    });

    document.getElementById("stop")?.addEventListener("click", () => {
        trackEvent("stopwatch_stop");
        chrome.storage.local.get(["isRunning", "startTime", "currentLaps", "history"], (data) => {
            if (data.isRunning !== true) return;
            const startTime = Number.isFinite(data.startTime) ? data.startTime : Date.now();
            const currentLaps = Array.isArray(data.currentLaps) ? data.currentLaps : [];
            const session = { sessionStart: startTime, laps: currentLaps };
            swHistoryWriteQueue = swHistoryWriteQueue.then(async () => {
                const latest = await chrome.storage.local.get(["isRunning", "history"]);
                if (latest.isRunning !== true) return;
                const latestHistory = Array.isArray(latest.history) ? latest.history : [];
                await chrome.storage.local.set({ isRunning: false, history: [...latestHistory, session], startTime: 0, currentLaps: [] });
            }).catch((err) => {
                // Silent fail
            });
            swHistoryWriteQueue.then(() => {
                swRefreshUI();
                swRenderHistory();
            });
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.shiftKey && (e.key.toLowerCase() === "l")) {
            const stopwatchView = document.getElementById("stopwatchView");
            const isStopwatchVisible = stopwatchView && stopwatchView.classList.contains("view-visible");
            if (isStopwatchVisible) {
                trackEvent("stopwatch_shortcut_lap");
                chrome.runtime.sendMessage({ action: "manual_lap" }).catch(() => { });
            }
        }
    });

    document.getElementById("clear-history")?.addEventListener("click", () => {
        trackEvent("stopwatch_clear_history_modal_open");
        if (swModal) swModal.classList.remove("hidden");
    });

    document.getElementById("cancelClear")?.addEventListener("click", () => {
        trackEvent("stopwatch_clear_history_modal_cancel");
        if (swModal) swModal.classList.add("hidden");
    });

    document.getElementById("confirmClear")?.addEventListener("click", () => {
        trackEvent("stopwatch_clear_history_confirm");
        if (!swModal) return;
        swHistoryWriteQueue = swHistoryWriteQueue.then(async () => {
            await chrome.storage.local.set({ history: [] });
        }).catch((err) => {
            // Silent fail
        });
        swHistoryWriteQueue.then(() => {
            swRenderHistory();
            swModal.classList.add("hidden");
            showToast(getI18nMsg("toastStopwatchCleared", "Istorija lajvova je obrisana!"), "success");
        });
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "update_ui") {
            swRefreshUI();
            swRenderHistory();
        }
    });
}
