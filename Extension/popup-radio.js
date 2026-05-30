import { elements, trackEvent, getI18nMsg, showToast } from './popup-core.js';

const playSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const pauseSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
export function updateRadioTitle(url) {
    const isCustom = url && url.trim();
    const titleText = isCustom
        ? getI18nMsg("radioTitleCustom", "Radio")
        : getI18nMsg("radioTitle", "Radio IN");
    if (elements.radioCardTitle) {
        elements.radioCardTitle.textContent = titleText;
    }
    if (elements.radioModalTitle) {
        elements.radioModalTitle.textContent = titleText;
    }
}

export function initRadio() {
    let currentCustomUrl = "";
    let radioPlaying = false;
    chrome.storage.local.get(['customRadioUrl'], (res) => {
        currentCustomUrl = res.customRadioUrl || "";
        updateRadioTitle(currentCustomUrl);
    });

    chrome.runtime.sendMessage({ action: "getRadioStatus" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && elements.radioBtn) {
            radioPlaying = response.playing === true;
            elements.radioBtn.innerHTML = radioPlaying ? pauseSvg : playSvg;
            if (elements.radioVol) elements.radioVol.value = response.volume;
        }
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.playing && elements.radioBtn) {
            radioPlaying = changes.playing.newValue === true;
            elements.radioBtn.innerHTML = radioPlaying ? pauseSvg : playSvg;
        }
    });

    let volumeSaveTimer = null;
    const persistVolume = (value) => {
        if (volumeSaveTimer) clearTimeout(volumeSaveTimer);
        volumeSaveTimer = setTimeout(() => {
            chrome.storage.local.set({ volume: value }).catch(() => { });
        }, 120);
    };

    elements.radioVol?.addEventListener("input", () => {
        const val = parseInt(elements.radioVol.value);
        chrome.runtime.sendMessage({ action: "setRadioVolume", value: val });
        persistVolume(val);
    });

    elements.radioVol?.addEventListener("change", () => {
        const val = parseInt(elements.radioVol.value);
        trackEvent("radio_volume_change", { value: val });
        chrome.storage.local.set({ volume: val }).catch(() => { });
    });

    elements.radioBtn?.addEventListener("click", () => {
        trackEvent(radioPlaying ? "radio_pause" : "radio_play");
        chrome.runtime.sendMessage({ action: "toggleRadio" }, (res) => {
            if (chrome.runtime.lastError) return;
            if (res) {
                radioPlaying = res.playing === true;
                elements.radioBtn.innerHTML = radioPlaying ? pauseSvg : playSvg;
            }
        });
    });

    const presetBtns = document.querySelectorAll(".preset-btn");
    presetBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const url = btn.getAttribute("data-url") || "";
            if (elements.radioUrlInput) {
                elements.radioUrlInput.value = url;
            }
            presetBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const storePromise = url === ""
                ? chrome.storage.local.remove(["customRadioUrl"]).catch(() => { })
                : chrome.storage.local.set({ customRadioUrl: url }).catch(() => { });

            storePromise.then(() => {
                currentCustomUrl = url;
                if (elements.radioImportModal) {
                    elements.radioImportModal.classList.add("hidden");
                }
                updateRadioTitle(url);
                showToast(getI18nMsg("toastRadioSaved", "URL radio stanice je sačuvan!"), "success");
                const currentVol = elements.radioVol ? parseInt(elements.radioVol.value) : 30;
                chrome.runtime.sendMessage({ action: "playCustomUrl", url: url, volume: currentVol }, (res) => {
                    if (chrome.runtime.lastError || !res?.ok) {
                        showToast(getI18nMsg("toastRadioPlayError", "Radio trenutno ne može da se pokrene."), "error");
                        return;
                    }
                    radioPlaying = true;
                    if (elements.radioBtn) elements.radioBtn.innerHTML = pauseSvg;
                });
            });
        });
    });

    elements.radioUrlInput?.addEventListener("input", () => {
        const val = elements.radioUrlInput.value.trim();
        presetBtns.forEach(btn => {
            const bUrl = btn.getAttribute("data-url") || "";
            if (bUrl === val) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    });

    elements.importRadioBtn?.addEventListener("click", () => {
        trackEvent("radio_import_click");
        chrome.storage.local.get(['customRadioUrl'], (res) => {
            const currentUrl = res.customRadioUrl || "";
            currentCustomUrl = currentUrl;
            if (elements.radioUrlInput) {
                elements.radioUrlInput.value = currentUrl;
            }

            presetBtns.forEach(btn => {
                const bUrl = btn.getAttribute("data-url") || "";
                if (bUrl === currentUrl) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            });

            if (elements.radioImportModal) {
                elements.radioImportModal.classList.remove("hidden");
            }
        });
    });

    elements.closeRadioModal?.addEventListener("click", () => {
        if (elements.radioImportModal) {
            elements.radioImportModal.classList.add("hidden");
        }
    });

    elements.clearRadioInput?.addEventListener("click", () => {
        if (elements.radioUrlInput) {
            elements.radioUrlInput.value = "";
            elements.radioUrlInput.focus();
        }
    });

    elements.saveRadioUrlBtn?.addEventListener("click", () => {
        const url = String(elements.radioUrlInput?.value || "").trim();
        if (url !== "") {
            const lowerUrl = url.toLowerCase();
            if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
                showToast(getI18nMsg("toastInvalidRadioUrl", "Nevažeći URL! URL mora početi sa http:// ili https://"), "error");
                return;
            }
        }

        const storePromise = url === ""
            ? chrome.storage.local.remove(["customRadioUrl"]).catch(() => { })
            : chrome.storage.local.set({ customRadioUrl: url }).catch(() => { });

        storePromise.then(() => {
            currentCustomUrl = url;
            if (elements.radioImportModal) {
                elements.radioImportModal.classList.add("hidden");
            }
            updateRadioTitle(url);
            showToast(getI18nMsg("toastRadioSaved", "URL radio stanice je sačuvan!"), "success");
            const currentVol = elements.radioVol ? parseInt(elements.radioVol.value) : 30;
            chrome.runtime.sendMessage({ action: "playCustomUrl", url: url, volume: currentVol }, (res) => {
                if (chrome.runtime.lastError || !res?.ok) {
                    showToast(getI18nMsg("toastRadioPlayError", "Radio trenutno ne može da se pokrene."), "error");
                    return;
                }
                radioPlaying = true;
                if (elements.radioBtn) elements.radioBtn.innerHTML = pauseSvg;
            });
        });
    });
}
