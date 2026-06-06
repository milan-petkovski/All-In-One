import { initCore, showToast, getI18nMsg } from './popup-core.js';

const loadedModules = {};
const initializedModules = new Set();

async function lazyLoadModule(path, initName) {
    let mod = loadedModules[path];
    if (!mod) {
        mod = await import(path);
        loadedModules[path] = mod;
    }
    if (initName && !initializedModules.has(path) && typeof mod[initName] === 'function') {
        try { mod[initName](); initializedModules.add(path); } catch (e) { /* swallow init errors */ }
    }
    return mod;
}

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicijalizacija core-a
    await initCore();

    // 2. Postavi privremene "lazy" ulovače koji na prvi klik učitaju modul,
    //    pozovu inicijalizator i potom ponovo izvrše klik da aktiviraju novu logiku.
    const loadingModules = new Set();
    const attachLazy = (elementId, modulePath, initName = 'init') => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const handler = async (e) => {
            e.preventDefault();
            if (loadingModules.has(modulePath)) return; // already loading
            loadingModules.add(modulePath);

            const originalTarget = e.target instanceof Element ? e.target : el;

            try {
                await lazyLoadModule(modulePath, initName);
                // Dispatch a synthetic click on the original target so module handlers run
                try {
                    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
                    originalTarget.dispatchEvent(ev);
                } catch (_) {
                    // fallback to clicking the element itself
                    try { el.click(); } catch (_) { }
                }
            } catch (err) {
                try { showToast(getI18nMsg('toastModuleLoadError', 'Greška pri učitavanju modula'), 'error'); } catch (_) { }
                console.error('Module load error', modulePath, err);
            } finally {
                loadingModules.delete(modulePath);
            }
        };
        el.addEventListener('click', handler);
    };

    // Lazy-load moduli na prvi interakciju
    attachLazy('radioBtn', './popup-radio.js', 'initRadio');
    attachLazy('importRadioBtn', './popup-radio.js', 'initRadio');
    attachLazy('notesBtn', './popup-notes.js', 'initNotes');
    attachLazy('trackerBtn', './popup-tracker.js', 'initTracker');
    attachLazy('counterBtn', './popup-counter.js', 'initCounter');
    attachLazy('stopwatchBtn', './popup-stopwatch.js', 'initStopwatch');
    attachLazy('settingsBtn', './popup-settings.js', 'initSettings');

    // Tech scanner stays dynamic on click (original behaviour)
    document.getElementById("techBtn")?.addEventListener("click", async () => {
        const { runTechScanner } = await import('./popup-tech.js');
        runTechScanner();
    });

    // PREFETCH / WARM: initialize radio UI quickly and warm-cache other modules
    const prefetchModules = async () => {
        try {
            // Radio: initialize so volume/play state is visible immediately
            await lazyLoadModule('./popup-radio.js', 'initRadio');

            // Warm other heavy modules (don't call their init yet to keep startup light)
            const warmPaths = ['./popup-notes.js', './popup-tracker.js', './popup-counter.js', './popup-stopwatch.js', './popup-settings.js'];
            warmPaths.forEach(p => import(p).then(m => { loadedModules[p] = m; }).catch(() => { }));
        } catch (e) {
            // ignore prefetch errors
        }
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => prefetchModules(), { timeout: 2000 });
    } else {
        setTimeout(prefetchModules, 1200);
    }
});