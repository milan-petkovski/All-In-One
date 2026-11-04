import { trackEvent, switchView, getI18nMsg, showToast } from './popup-core.js';

export function initSettings() {
    document.getElementById("settingsBtn")?.addEventListener("click", () => {
        trackEvent("settings_open");
        switchView("mainView", "settingsView");
    });

    document.getElementById("settingsBackBtn")?.addEventListener("click", () => {
        trackEvent("settings_back");
        switchView("settingsView", "mainView", true);
    });

    const verNum = document.getElementById("verNum");
    if (verNum && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
        verNum.innerText = chrome.runtime.getManifest().version;
    }

    document.getElementById("exportAllSettingsBtn")?.addEventListener("click", () => {
        trackEvent("settings_export_all");
        chrome.storage.local.get(null, (allData) => {
            const dataToExport = {
                app: "All In One",
                version: (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.()?.version) || "1.6.0",
                exported_at: new Date().toISOString(),
                data: allData || {}
            };
            const jsonStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const now = new Date();
            const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
            a.download = `AllInOne_Backup_${dateStr}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(getI18nMsg("toastAllSettingsExported", "Sva podešavanja i podaci su uspešno izvezeni!"), "success");
        });
    });

    document.getElementById("donateBtn")?.addEventListener("click", () => {
        trackEvent("donate_click");
        chrome.tabs.create({ url: "https://paypal.me/milanwebportal" });
    });

    document.getElementById("webBtn")?.addEventListener("click", () => {
        trackEvent("website_click");
        chrome.tabs.create({ url: "https://allinone.milanwebportal.com" });
    });

    document.getElementById("portalBtn")?.addEventListener("click", () => {
        trackEvent("milanwebportal_click");
        chrome.tabs.create({ url: "https://milanwebportal.com" });
    });

    document.getElementById("rateBtn")?.addEventListener("click", () => {
        trackEvent("rate_click");
        chrome.tabs.create({ url: "https://chromewebstore.google.com/detail/all-in-one/hmkcbieabcldlndhjeemggokhlebjoem/reviews" });
    });

    document.getElementById("privacyLink")?.addEventListener("click", (e) => {
        trackEvent("privacy_click");
        e.preventDefault();
        chrome.tabs.create({ url: "https://allinone.milanwebportal.com/privacy" });
    });

}
