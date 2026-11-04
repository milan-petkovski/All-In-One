import { trackEvent, getI18nMsg, switchView, showToast } from './popup-core.js';

let counterView = null;
let counterBackBtn = null;
let counterArea = null;
let charCount = null;
let wordCount = null;
let lineCount = null;
let readingTime = null;
let seoHint = null;
let clearCounterModal = null;

function countGraphemes(str) {
    const cleaned = str.replace(/[\r\n\t]/g, '').trimEnd();
    if (cleaned === '') return 0;
    if (typeof Intl.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return [...segmenter.segment(cleaned)].length;
    } else {
        return Array.from(cleaned).length;
    }
}

function countWords(str) {
    return (str.match(/[\p{L}\p{N}]+/gu) || []).length;
}

function countLines(str) {
    if (str === "") return 0;
    const lines = str.replace(/\r\n/g, '\n').split('\n');
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.length === 0 ? 1 : lines.length;
}

function calculateReadingTime(words) {
    if (words <= 0) return "0 min";
    if (words < 100) return "< 1 min";
    const minutes = Math.ceil(words / 200);
    return `${minutes} min`;
}

function updateSeoHint(chars) {
    if (!seoHint) return;
    if (chars === 0) {
        seoHint.textContent = "";
        return;
    }
    if (chars >= 50 && chars <= 60) {
        seoHint.innerHTML = `<span class="counter-seo-badge">SEO Title: Optimalno (${chars}/60)</span>`;
    } else if (chars >= 140 && chars <= 160) {
        seoHint.innerHTML = `<span class="counter-seo-badge">Meta Opis: Optimalno (${chars}/160)</span>`;
    } else if (chars > 60 && chars <= 70) {
        seoHint.innerHTML = `<span class="counter-seo-badge warning">SEO Title: Blizu limita (${chars}/60)</span>`;
    } else if (chars > 160 && chars <= 175) {
        seoHint.innerHTML = `<span class="counter-seo-badge warning">Meta Opis: Blizu limita (${chars}/160)</span>`;
    } else {
        seoHint.textContent = "";
    }
}

const updateCounts = (text = "") => {
    if (!charCount || !wordCount || !lineCount) return;
    const normalized = String(text);
    const chars = countGraphemes(normalized);
    const words = countWords(normalized);
    const lines = countLines(normalized);
    charCount.textContent = String(chars);
    wordCount.textContent = String(words);
    lineCount.textContent = String(lines);
    if (readingTime) {
        readingTime.textContent = calculateReadingTime(words);
    }
    updateSeoHint(chars);
};

let counterSaveTimeout = null;
let pendingCounterText = null;
let counterSaveIndicator = null;
let counterIndicatorTimeout = null;

const showCounterSaveIndicator = () => {
    if (!counterSaveIndicator) return;
    if (counterIndicatorTimeout) clearTimeout(counterIndicatorTimeout);
    counterSaveIndicator.style.opacity = "1";
    counterIndicatorTimeout = setTimeout(() => {
        if (counterSaveIndicator) counterSaveIndicator.style.opacity = "0";
    }, 1200);
};

const flushCounterSave = () => {
    if (pendingCounterText !== null) {
        chrome.storage.local.set({ aio_counter_text: pendingCounterText }, () => {
            showCounterSaveIndicator();
        });
        pendingCounterText = null;
    }
    if (counterSaveTimeout) {
        clearTimeout(counterSaveTimeout);
        counterSaveTimeout = null;
    }
};

const getSavedCounterText = (callback) => {
    chrome.storage.local.get(["aio_counter_text"], (res) => {
        callback(res.aio_counter_text || "");
    });
};

const setSavedCounterText = (text, immediate = false) => {
    pendingCounterText = text;
    if (counterSaveTimeout) clearTimeout(counterSaveTimeout);
    if (immediate) {
        flushCounterSave();
        return;
    }
    counterSaveTimeout = setTimeout(() => {
        flushCounterSave();
    }, 250);
};

const clearSavedCounterText = () => {
    pendingCounterText = null;
    if (counterSaveTimeout) {
        clearTimeout(counterSaveTimeout);
        counterSaveTimeout = null;
    }
    chrome.storage.local.remove("aio_counter_text");
};

export function initCounter() {
    counterView = document.getElementById("counterView");
    counterBackBtn = document.getElementById("counterBackBtn");
    counterArea = document.getElementById("counterArea");
    charCount = document.getElementById("charCount");
    wordCount = document.getElementById("wordCount");
    lineCount = document.getElementById("lineCount");
    readingTime = document.getElementById("readingTime");
    seoHint = document.getElementById("seoHint");
    clearCounterModal = document.getElementById("clearCounterModal");
    counterSaveIndicator = document.getElementById("counterSaveIndicator");

    // Initialization and Legacy LocalStorage Migration
    if (counterArea) {
        counterArea.setAttribute("maxlength", "1000000");
        let legacyText = null;
        try {
            legacyText = localStorage.getItem("aio_counter_text");
        } catch {}

        if (legacyText !== null) {
            chrome.storage.local.set({ aio_counter_text: legacyText }, () => {
                try {
                    localStorage.removeItem("aio_counter_text");
                } catch {}
            });
            counterArea.value = legacyText;
            updateCounts(legacyText);
        } else {
            getSavedCounterText((savedText) => {
                counterArea.value = savedText;
                updateCounts(savedText);
            });
        }
    }

    document.getElementById("counterBtn")?.addEventListener("click", () => {
        trackEvent("character_counter_open");
        if (!counterView) return;
        switchView("mainView", "counterView");
    });

    counterArea?.addEventListener("change", (e) => {
        const val = e.target.value;
        updateCounts(val);
        setSavedCounterText(val);
    });

    counterBackBtn?.addEventListener("click", () => {
        trackEvent("counter_view_back");
        if (counterView) {
            switchView("counterView", "mainView", true);
        }
    });

    let counterInputDebounce;
    counterArea?.addEventListener("input", (e) => {
        if (counterInputDebounce) clearTimeout(counterInputDebounce);
        counterInputDebounce = setTimeout(() => {
            trackEvent("counter_input");
        }, 2000);
        const val = e.target.value;
        updateCounts(val);
        setSavedCounterText(val);
    });

    counterArea?.addEventListener("paste", (e) => {
        const text = (e.clipboardData || window.clipboardData).getData("text/plain");
        const currentLength = (counterArea.value || "").length;
        const incomingLength = text.length;
        if (currentLength + incomingLength > 1000000) {
            showToast(getI18nMsg("counterTooLarge", "Tekst prelazi maksimalni limit od 1M karaktera!"), "error");
        }
    });

    document.getElementById("counterClearBtn")?.addEventListener("click", () => {
        trackEvent("counter_clear_open");
        if (clearCounterModal) clearCounterModal.classList.remove("hidden");
    });

    document.getElementById("cancelClearCounter")?.addEventListener("click", () => {
        trackEvent("counter_clear_modal_cancel");
        if (clearCounterModal) clearCounterModal.classList.add("hidden");
    });

    document.getElementById("confirmClearCounter")?.addEventListener("click", () => {
        trackEvent("counter_clear_confirm");
        if (counterArea) {
            counterArea.value = "";
            updateCounts("");
            clearSavedCounterText();
        }
        if (clearCounterModal) clearCounterModal.classList.add("hidden");
        showToast(getI18nMsg("toastCounterCleared", "Tekst brojača je obrisan!"), "success");
    });

    const counterCopyBtn = document.getElementById("counterCopyBtn");
    if (counterCopyBtn) {
        const copyIcon = counterCopyBtn.innerHTML;
        const successIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00ff88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        counterCopyBtn.addEventListener("click", () => {
            const text = counterArea?.value || "";
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                trackEvent("counter_text_copy");
                counterCopyBtn.innerHTML = successIcon;
                showToast(getI18nMsg("toastCounterCopied", "Tekst je kopiran u klipbord!"), "success");

                setTimeout(() => {
                    counterCopyBtn.innerHTML = copyIcon;
                }, 1500);
            }).catch(() => { });
        });
    }

    window.addEventListener("pagehide", () => flushCounterSave());
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushCounterSave();
    });
}
