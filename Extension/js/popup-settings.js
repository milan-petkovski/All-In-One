import { trackEvent, switchView } from './popup-core.js';

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
