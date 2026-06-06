import { trackEvent, getI18nMsg, switchView, showToast } from './popup-core.js';

let counterView = null;
let counterBackBtn = null;
let counterArea = null;
let charCount = null;
let wordCount = null;
let lineCount = null;
let clearCounterModal = null;

function countGraphemes(str) {
    const cleaned = str.replace(/[\r\n\t]/g, '').trimEnd();
    if (cleaned === '') return 0;
    if (typeof Intl.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        let count = 0;
        for (const seg of segmenter.segment(cleaned)) count++;
        return count;
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

const updateCounts = (text = "") => {
    if (!charCount || !wordCount || !lineCount) return;
    const normalized = String(text);
    charCount.textContent = String(countGraphemes(normalized));
    wordCount.textContent = String(countWords(normalized));
    lineCount.textContent = String(countLines(normalized));
};

const getSavedCounterText = (callback) => {
    chrome.storage.local.get(["aio_counter_text"], (res) => {
        callback(res.aio_counter_text || "");
    });
};

const setSavedCounterText = (text) => {
    chrome.storage.local.set({ aio_counter_text: text });
};

const clearSavedCounterText = () => {
    chrome.storage.local.remove("aio_counter_text");
};

export function initCounter() {
    counterView = document.getElementById("counterView");
    counterBackBtn = document.getElementById("counterBackBtn");
    counterArea = document.getElementById("counterArea");
    charCount = document.getElementById("charCount");
    wordCount = document.getElementById("wordCount");
    lineCount = document.getElementById("lineCount");
    clearCounterModal = document.getElementById("clearCounterModal");

    // Initialization and Legacy LocalStorage Migration
    if (counterArea) {
        counterArea.setAttribute("maxlength", "1000000");
        let legacyText = null;
        try {
            legacyText = localStorage.getItem("aio_counter_text");
        } catch (_) { }

        if (legacyText !== null) {
            chrome.storage.local.set({ aio_counter_text: legacyText }, () => {
                try {
                    localStorage.removeItem("aio_counter_text");
                } catch (_) { }
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
}
