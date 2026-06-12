import { trackEvent, getI18nMsg, currentLang, switchView, showToast } from './popup-core.js';

const swModal = document.getElementById("customModal");
let swInterval;
let swKickCheckInterval = null;
let swHistoryWriteQueue = Promise.resolve();
let stopwatchInitialized = false;
let swUiRafId = null;
let swUiActive = false;
let swLastUiTick = 0;
let kickEditMode = false; // when true, user is editing channel — don't auto-snap back to synced mode
let lastRenderedLapsJson = "";

const swFormat = (ms) => {
    if (!Number.isFinite(ms)) return "00:00:00";
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600).toString().padStart(2, '0');
    const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

let swRefreshUIDebounceId = null;

// Switches kick-sync-container between input mode and synced mode
const swUpdateKickUI = (kickChannel) => {
    const inputMode = document.getElementById("kickInputMode");
    const syncedMode = document.getElementById("kickSyncedMode");
    const channelLabel = document.getElementById("kickChannelLabel");
    const startBtn = document.getElementById("start");
    const isSynced = typeof kickChannel === "string" && kickChannel.trim() !== "";

    if (inputMode) inputMode.style.display = isSynced ? "none" : "flex";
    if (syncedMode) syncedMode.style.display = isSynced ? "flex" : "none";
    if (channelLabel && isSynced) channelLabel.textContent = kickChannel;
    if (startBtn) {
        if (isSynced) startBtn.classList.add("hidden-start");
        else startBtn.classList.remove("hidden-start");
    }
};

const swRefreshUI = () => {
    if (swRefreshUIDebounceId) clearTimeout(swRefreshUIDebounceId);
    swRefreshUIDebounceId = setTimeout(() => {
        requestAnimationFrame(() => {
            chrome.storage.local.get(["isRunning", "startTime", "currentLaps", "kickChannel"], (data) => {
                const timerEl = document.getElementById("timer");
                const statusEl = document.getElementById("status");
                const lapsList = document.getElementById("laps");
                if (!timerEl || !statusEl || !lapsList) return;
                const isRunning = data.isRunning === true;
                const startTime = Number.isFinite(data.startTime) ? data.startTime : 0;
                const currentLaps = Array.isArray(data.currentLaps) ? data.currentLaps : [];

                // Skip kick UI update when user is actively editing the channel name
                if (!kickEditMode) swUpdateKickUI(data.kickChannel);

                if (isRunning) {
                    timerEl.innerText = swFormat(Date.now() - startTime);
                    statusEl.innerText = getI18nMsg("swStatusLive", "LAJV U TOKU");
                    statusEl.style.color = "var(--danger)";
                } else {
                    timerEl.innerText = "00:00:00";
                    statusEl.innerText = getI18nMsg("swStatusReady", "SPREMAN");
                    statusEl.style.color = "var(--text-dim)";
                }

                const currentLapsJson = JSON.stringify(currentLaps);
                if (currentLapsJson !== lastRenderedLapsJson) {
                    lastRenderedLapsJson = currentLapsJson;
                    while (lapsList.firstChild) lapsList.removeChild(lapsList.firstChild);
                    if (currentLaps.length > 0) {
                        currentLaps.slice().reverse().forEach((lapMs, index) => {
                            const originalIndex = currentLaps.length - 1 - index;
                            const lapIndex = originalIndex + 1;

                            const row = document.createElement("div");
                            row.className = "lap-flat-row";

                            const nameSpan = document.createElement("span");
                            nameSpan.className = "lap-flat-name";
                            nameSpan.textContent = `Momenat ${lapIndex}`;

                            const timeSpan = document.createElement("b");
                            timeSpan.className = "lap-flat-time";
                            timeSpan.textContent = swFormat(Number.isFinite(lapMs) ? lapMs : 0);

                            const removeBtn = document.createElement("button");
                            removeBtn.className = "lap-x-btn";
                            removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                            removeBtn.title = "Ukloni momenat";
                            removeBtn.onclick = (e) => {
                                e.stopPropagation();
                                const newLaps = currentLaps.filter((_, i) => i !== originalIndex);
                                chrome.storage.local.set({ currentLaps: newLaps }, swRefreshUI);
                            };

                            row.appendChild(nameSpan);
                            row.appendChild(timeSpan);
                            row.appendChild(removeBtn);

                            const li = document.createElement("li");
                            li.appendChild(row);
                            lapsList.appendChild(li);
                        });
                    } else {
                        const empty = document.createElement("div");
                        empty.className = "lap-empty-state";
                        empty.textContent = getI18nMsg("swNoLaps", "Nema zabeleženih momenata");
                        lapsList.appendChild(empty);
                    }
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
                        const sessionDateStr = sessionTime.toLocaleDateString(currentLang, { day: '2-digit', month: '2-digit', year: '2-digit' });

                        const titleSpan = document.createElement('span');
                        const sessionTitle = (typeof session.channelName === 'string' && session.channelName.trim())
                            ? session.channelName.toUpperCase()
                            : `${getI18nMsg("swLiveTitlePrefix", "Lajv #")}${realIdx}`;
                        titleSpan.textContent = sessionTitle;

                        const rightContainer = document.createElement('div');
                        rightContainer.style.display = 'flex';
                        rightContainer.style.alignItems = 'center';
                        rightContainer.style.gap = '8px';
                        rightContainer.style.flexShrink = '0';

                        const dateSpan = document.createElement('span');
                        dateSpan.style.color = 'var(--text-dim)';
                        dateSpan.style.fontWeight = 'normal';
                        dateSpan.style.fontSize = '10px';
                        const sessionDurationStr = swFormat(sessionDurationMs);
                        dateSpan.textContent = `${sessionDateStr} (${sessionDurationStr})`;

                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'history-del-btn';
                        deleteBtn.title = getI18nMsg("swDeleteSessionTooltip", "Obriši ovaj lajv");
                        deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                        
                        deleteBtn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            swHistoryWriteQueue = swHistoryWriteQueue.then(async () => {
                                const latest = await chrome.storage.local.get(["history"]);
                                const latestHistory = Array.isArray(latest.history) ? latest.history : [];
                                const originalIndex = realIdx - 1;
                                const newHistory = latestHistory.filter((_, i) => i !== originalIndex);
                                await chrome.storage.local.set({ history: newHistory });
                            }).catch(() => {});
                            swHistoryWriteQueue.then(() => {
                                swRenderHistory();
                                showToast("Lajv obrisan iz istorije.", "success");
                            });
                        };

                        rightContainer.appendChild(dateSpan);
                        rightContainer.appendChild(deleteBtn);

                        summary.appendChild(titleSpan);
                        summary.appendChild(rightContainer);

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
                            const left = document.createElement('span');
                            left.style.color = 'var(--text-dim)';
                            left.textContent = `${getI18nMsg("swMomentLabel", "Momenat ")}${i + 1}`;
                            const rightBold = document.createElement('b');
                            rightBold.textContent = swFormat(Number.isFinite(lap) ? lap : 0);
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
                                const sessionTime = Number.isFinite(session.sessionStart) ? new Date(session.sessionStart) : new Date();
                                const sessionDateFull = sessionTime.toLocaleDateString(currentLang);
                                const currentSessionTitle = (typeof session.channelName === 'string' && session.channelName.trim())
                                    ? session.channelName.toUpperCase()
                                    : `${getI18nMsg("swLiveTitlePrefix", "LAJV #").toUpperCase()}${realIdx}`;
                                let txt = `${currentSessionTitle} | ${sessionDateFull}\n--------------------------\n`;
                                const exportLaps = Array.isArray(session.laps) ? session.laps : [];
                                txt += `${getI18nMsg("swTotalDurationPrefix", "UKUPNO TRAJANJE: ")}${swFormat(exportLaps.length > 0 ? exportLaps[exportLaps.length - 1] : 0)}\n\n`;
                                exportLaps.forEach((l, i) => {
                                    txt += `${i + 1}. ${swFormat(Number.isFinite(l) ? l : 0)}\n`;
                                });
                                const blob = new Blob([txt], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                const d = sessionTime.getDate().toString().padStart(2, '0');
                                const m = (sessionTime.getMonth() + 1).toString().padStart(2, '0');
                                const y = sessionTime.getFullYear();
                                const dateFormatted = `${d}.${m}.${y}`;

                                const cleanName = (typeof session.channelName === 'string' && session.channelName.trim())
                                    ? `lajv_${session.channelName.trim().toLowerCase()}_${dateFormatted}`
                                    : `lajv_${realIdx}_${dateFormatted}`;
                                a.download = `${cleanName}.txt`;
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
                                const sessionTime = Number.isFinite(session.sessionStart) ? new Date(session.sessionStart) : new Date();
                                const sessionDateFull = sessionTime.toLocaleDateString(currentLang);
                                const currentSessionTitle = (typeof session.channelName === 'string' && session.channelName.trim())
                                    ? session.channelName.toUpperCase()
                                    : `${getI18nMsg("swLiveTitlePrefix", "LAJV #").toUpperCase()}${realIdx}`;
                                let txt = `${currentSessionTitle} | ${sessionDateFull}\n`;
                                const exportLaps = Array.isArray(session.laps) ? session.laps : [];
                                txt += `${getI18nMsg("swTotalDurationPrefix", "UKUPNO TRAJANJE: ")}${swFormat(exportLaps.length > 0 ? exportLaps[exportLaps.length - 1] : 0)}\n\n`;
                                exportLaps.forEach((l, i) => {
                                    txt += `${i + 1}. ${swFormat(Number.isFinite(l) ? l : 0)}\n`;
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

// Helper: perform kick sync
const doKickSync = (channelSlug) => {
    const syncBtn = document.getElementById("syncKickBtn");
    if (!channelSlug) {
        showToast("Unesi ispravno ime kanala", "error");
        return;
    }
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerText = "Čekaj...";
    }
    try {
        chrome.runtime.sendMessage({ action: "sync_kick_live", channelSlug });
    } catch (err) {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerText = "Sinhronizuj";
        }
        showToast("Greška pri slanju poruke", "error");
    }
};

// Helper: full reset (stop session + clear kickChannel)
const doFullReset = () => {
    const kickInput = document.getElementById("kickChannelInput");
    chrome.storage.local.get(["isRunning", "startTime", "currentLaps", "history", "kickChannel"], (data) => {
        const isRunning = data.isRunning === true;
        const startTime = Number.isFinite(data.startTime) ? data.startTime : Date.now();
        const currentLaps = Array.isArray(data.currentLaps) ? data.currentLaps : [];
        const channelName = typeof data.kickChannel === 'string' && data.kickChannel.trim() ? data.kickChannel : null;

        if (isRunning) {
            const hasLaps = currentLaps.length > 0;
            swHistoryWriteQueue = swHistoryWriteQueue.then(async () => {
                const updates = {
                    isRunning: false,
                    startTime: 0,
                    currentLaps: [],
                    kickChannel: ""
                };
                if (hasLaps) {
                    const session = { sessionStart: Date.now(), laps: currentLaps, ...(channelName && { channelName }) };
                    const latest = await chrome.storage.local.get(["history"]);
                    const latestHistory = Array.isArray(latest.history) ? latest.history : [];
                    updates.history = [...latestHistory, session];
                }
                await chrome.storage.local.set(updates);
            }).catch(() => { });
            swHistoryWriteQueue.then(() => {
                kickEditMode = false;
                if (kickInput) kickInput.value = "";
                swUpdateKickUI("");
                swRefreshUI();
                swRenderHistory();
                if (hasLaps) {
                    showToast("Sinhronizacija je prekinuta i strim je sačuvan.", "success");
                } else {
                    showToast("Sinhronizacija sa Kick-om je prekinuta.", "success");
                }
            });
        } else {
            chrome.storage.local.set({ isRunning: false, startTime: 0, currentLaps: [], kickChannel: "" }, () => {
                kickEditMode = false;
                if (kickInput) kickInput.value = "";
                swUpdateKickUI("");
                swRefreshUI();
                swRenderHistory();
                showToast("Sinhronizacija sa Kick-om je prekinuta.", "success");
            });
        }
    });
};

export function initStopwatch() {
    if (stopwatchInitialized) return;
    stopwatchInitialized = true;

    // Build kick-sync-container with two modes: input mode + synced mode
    const timerEl = document.getElementById("timer");
    if (timerEl) {
        const kickSyncContainer = document.createElement("div");
        kickSyncContainer.className = "kick-sync-container";

        // --- Input mode ---
        const inputMode = document.createElement("div");
        inputMode.id = "kickInputMode";
        inputMode.style.display = "flex";
        inputMode.style.gap = "6px";
        inputMode.style.width = "100%";
        inputMode.style.alignItems = "center";

        const kickInput = document.createElement("input");
        kickInput.type = "text";
        kickInput.id = "kickChannelInput";
        kickInput.placeholder = "Unesi Kick korisničko ime";

        const syncBtn = document.createElement("button");
        syncBtn.id = "syncKickBtn";
        syncBtn.innerText = "Sinhronizuj";

        inputMode.appendChild(kickInput);
        inputMode.appendChild(syncBtn);

        // --- Synced mode ---
        const syncedMode = document.createElement("div");
        syncedMode.id = "kickSyncedMode";
        syncedMode.style.display = "none";
        syncedMode.style.gap = "8px";
        syncedMode.style.width = "100%";
        syncedMode.style.alignItems = "center";

        const channelLabel = document.createElement("span");
        channelLabel.id = "kickChannelLabel";

        const changeBtn = document.createElement("button");
        changeBtn.id = "kickChangeBtn";
        changeBtn.title = "Promeni kanal";
        changeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

        syncedMode.appendChild(channelLabel);
        syncedMode.appendChild(changeBtn);

        kickSyncContainer.appendChild(inputMode);
        kickSyncContainer.appendChild(syncedMode);
        timerEl.parentNode.insertBefore(kickSyncContainer, timerEl);

        // Load persisted channel
        chrome.storage.local.get(["kickChannel"], (res) => {
            const saved = res && res.kickChannel ? res.kickChannel : "";
            if (saved) kickInput.value = saved;
            swUpdateKickUI(saved);
        });

        // Sync on button click
        syncBtn.addEventListener("click", () => {
            doKickSync(kickInput.value.trim());
        });

        // Sync on Enter key
        kickInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                doKickSync(kickInput.value.trim());
            }
        });

        // Promeni — switch to edit mode (stops active session, saves to history, and opens edit mode)
        changeBtn.addEventListener("click", () => {
            chrome.storage.local.get(["isRunning", "startTime", "currentLaps", "history", "kickChannel"], (data) => {
                const oldChannel = data.kickChannel || "";
                const isRunning = data.isRunning === true;
                const startTime = Number.isFinite(data.startTime) ? data.startTime : Date.now();
                const currentLaps = Array.isArray(data.currentLaps) ? data.currentLaps : [];
                const channelName = typeof oldChannel === 'string' && oldChannel.trim() ? oldChannel : null;

                if (isRunning) {
                    const hasLaps = currentLaps.length > 0;
                    swHistoryWriteQueue = swHistoryWriteQueue.then(async () => {
                        const updates = {
                            isRunning: false,
                            startTime: 0,
                            currentLaps: [],
                            kickChannel: ""
                        };
                        if (hasLaps) {
                            const session = { sessionStart: Date.now(), laps: currentLaps, ...(channelName && { channelName }) };
                            const latest = await chrome.storage.local.get(["history"]);
                            const latestHistory = Array.isArray(latest.history) ? latest.history : [];
                            updates.history = [...latestHistory, session];
                        }
                        await chrome.storage.local.set(updates);
                    }).catch(() => { });
                    swHistoryWriteQueue.then(() => {
                        kickEditMode = true;
                        if (kickInput) kickInput.value = oldChannel;
                        swUpdateKickUI("");
                        swRefreshUI();
                        swRenderHistory();
                        if (hasLaps) {
                            showToast("Stari strim je sačuvan, možete promeniti kanal.", "success");
                        } else {
                            showToast("Možete promeniti kanal.", "success");
                        }
                    });
                } else {
                    chrome.storage.local.set({ isRunning: false, startTime: 0, currentLaps: [], kickChannel: "" }, () => {
                        kickEditMode = true;
                        if (kickInput) kickInput.value = oldChannel;
                        swUpdateKickUI("");
                        swRefreshUI();
                        swRenderHistory();
                    });
                }
            });
        });

        // Reset / Prekini button in header
        const resetSyncBtn = document.getElementById("swResetSyncBtn");
        if (resetSyncBtn) {
            resetSyncBtn.addEventListener("click", () => {
                const isHovered = resetSyncBtn.matches(':hover');
                const icon = resetSyncBtn.querySelector('.icon-refresh');
                resetSyncBtn.disabled = true;
                
                if (icon) {
                    // If hovered, rotate to 720deg (from 360deg). If not hovered, rotate to 360deg (from 0deg).
                    // This ensures exactly one 360-degree rotation (360deg delta) in both cases.
                    icon.style.transform = isHovered ? 'rotate(720deg)' : 'rotate(360deg)';
                }
                
                setTimeout(() => {
                    if (icon) {
                        icon.classList.add("no-transition");
                        icon.style.transform = "";
                    }
                    resetSyncBtn.disabled = false;
                    if (icon) {
                        icon.offsetHeight; // force reflow
                        icon.classList.remove("no-transition");
                    }
                }, 600);
                doFullReset();
            });
        }
    }

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

        // Force check immediately upon opening
        chrome.runtime.sendMessage({ action: "check_kick_status", force: true }).catch(() => {});

        // Then check every 30 seconds
        if (swKickCheckInterval) clearInterval(swKickCheckInterval);
        swKickCheckInterval = setInterval(() => {
            chrome.runtime.sendMessage({ action: "check_kick_status", force: false }).catch(() => {});
        }, 30000);
    };

    const stopUiTicker = () => {
        swUiActive = false;
        if (swUiRafId) cancelAnimationFrame(swUiRafId);
        swUiRafId = null;
        if (swKickCheckInterval) {
            clearInterval(swKickCheckInterval);
            swKickCheckInterval = null;
        }
    };

    document.getElementById("stopwatchBtn")?.addEventListener("click", () => {
        trackEvent("stopwatch_open");
        lastRenderedLapsJson = "";
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
        doFullReset();
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
        } else if (msg.action === "sync_kick_response") {
            const syncBtn = document.getElementById("syncKickBtn");
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerText = "Sinhronizuj";
            }
            if (msg.isLive) {
                // Save old session to history (with channel name), then clear laps for new stream
                chrome.storage.local.get(["isRunning", "startTime", "currentLaps", "history", "kickChannel"], (res) => {
                    const oldLaps = Array.isArray(res.currentLaps) ? res.currentLaps : [];
                    const oldStart = Number.isFinite(res.startTime) ? res.startTime : 0;
                    const saveOld = oldLaps.length > 0;
                    const prevChannel = typeof res.kickChannel === 'string' && res.kickChannel.trim() ? res.kickChannel : null;

                    swHistoryWriteQueue = swHistoryWriteQueue.then(async () => {
                        const latest = await chrome.storage.local.get(["history"]);
                        const latestHistory = Array.isArray(latest.history) ? latest.history : [];
                        const updates = { currentLaps: [] };
                        if (saveOld) {
                             const oldSession = { sessionStart: Date.now(), laps: oldLaps, ...(prevChannel && { channelName: prevChannel }) };
                            updates.history = [...latestHistory, oldSession];
                        }
                        await chrome.storage.local.set(updates);
                    }).catch(() => { });

                    swHistoryWriteQueue.then(() => {
                        kickEditMode = false;
                        swUpdateKickUI(msg.kickChannel || res.kickChannel || "");
                        showToast("Uspešno sinhronizovano sa Kick lajvom!", "success");
                        swRefreshUI();
                        if (saveOld) swRenderHistory();
                    });
                });
            } else {
                showToast(msg.error || "Došlo je do greške", "error");
            }
        }
    });

    // Click outside #kickInputMode while in edit mode → snap back to synced mode
    document.addEventListener("click", (e) => {
        if (!kickEditMode) return;
        const inputMode = document.getElementById("kickInputMode");
        if (inputMode && !inputMode.contains(e.target)) {
            chrome.storage.local.get(["kickChannel"], (res) => {
                const ch = res && res.kickChannel ? res.kickChannel : "";
                if (ch) {
                    // Has a synced channel — go back to synced display
                    kickEditMode = false;
                    swUpdateKickUI(ch);
                } else {
                    // No channel synced yet — just stay in input mode
                    kickEditMode = false;
                }
            });
        }
    });
}
