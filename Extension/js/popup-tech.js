import { getI18nMsg, tab, switchView } from './popup-core.js';

const TECH_ICON_MAP = new Map([
    ["react", "<span class='tech-icon-badge tech-icon-react'>R</span>"],
    ["vue", "<span class='tech-icon-badge tech-icon-vue'>V</span>"],
    ["angular", "<span class='tech-icon-badge tech-icon-angular'>A</span>"],
    ["svelte", "<span class='tech-icon-badge tech-icon-svelte'>S</span>"],
    ["next", "<span class='tech-icon-badge tech-icon-next'>N</span>"],
    ["nuxt", "<span class='tech-icon-badge tech-icon-nuxt'>N</span>"],
    ["astro", "<span class='tech-icon-badge tech-icon-astro'>A</span>"],
    ["wordpress", "<span class='tech-icon-badge tech-icon-wp'>W</span>"],
    ["shopify", "<span class='tech-icon-badge tech-icon-shopify'>S</span>"],
    ["tailwind", "<span class='tech-icon-badge tech-icon-tailwind'>T</span>"],
    ["bootstrap", "<span class='tech-icon-badge tech-icon-bootstrap'>B</span>"],
    ["firebase", "<span class='tech-icon-badge tech-icon-firebase'>F</span>"],
    ["supabase", "<span class='tech-icon-badge tech-icon-supabase'>S</span>"]
]);

function getTechIconHtml(name) {
    const key = String(name || "").toLowerCase();
    for (const [token, html] of TECH_ICON_MAP.entries()) {
        if (key.includes(token)) return html;
    }
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
}

function showTechMessage(listContainer, loading, message) {
    if (loading) loading.style.display = "none";
    if (listContainer) {
        // create a safe message node instead of using innerHTML
        while (listContainer.firstChild) listContainer.removeChild(listContainer.firstChild);
        const msg = document.createElement('div');
        msg.style.color = 'var(--text-dim)';
        msg.style.textAlign = 'center';
        msg.textContent = String(message || '');
        listContainer.appendChild(msg);
    }
}

async function loadNetworkResults(url) {
    try {
        const hostname = new URL(url).hostname;
        const response = await chrome.runtime.sendMessage({
            action: "tech_resolve_network_info",
            hostname
        });
        return Array.isArray(response?.results) ? response.results : [];
    } catch (_) {
        return [];
    }
}

function getTechCatMap() {
    return {
        'Osnova': getI18nMsg('techCatBase', 'Osnova'),
        'Sistem': getI18nMsg('techCatSystem', 'Sistem'),
        'E Trgovina': getI18nMsg('techCatEcom', 'E Trgovina'),
        'Tehnologije': getI18nMsg('techCatTech', 'Tehnologije'),
        'Stilovi': getI18nMsg('techCatStyles', 'Stilovi'),
        'Baza Podataka': getI18nMsg('techCatDb', 'Baza Podataka'),
        'Backend': getI18nMsg('techCatBackend', 'Backend'),
        'Server': getI18nMsg('techCatServer', 'Server'),
        'Mreža': getI18nMsg('techCatNetwork', 'Mreža'),
        'Sigurnost': getI18nMsg('techCatSecurity', 'Sigurnost'),
        'Keširanje': getI18nMsg('techCatCaching', 'Keširanje'),
        'CDN': getI18nMsg('techCatCdn', 'CDN'),
        'Analitika': getI18nMsg('techCatAnalytics', 'Analitika'),
        'Reklame': getI18nMsg('techCatAds', 'Reklame'),
        'Plaćanje': getI18nMsg('techCatPayment', 'Plaćanje'),
        'Komunikacija': getI18nMsg('techCatComm', 'Komunikacija'),
        'Mediji': getI18nMsg('techCatMedia', 'Mediji'),
        'Build': getI18nMsg('techCatBuild', 'Build'),
        'SEO': getI18nMsg('techCatSeo', 'SEO'),
        'Statistika': getI18nMsg('techCatStats', 'Statistika'),
        'Alati': getI18nMsg('techCatTools', 'Alati')
    };
}

function getTechStatLabels() {
    return {
        dom: getI18nMsg('techStatDom', 'DOM'),
        images: getI18nMsg('techStatImages', 'Slike'),
        scripts: getI18nMsg('techStatScripts', 'Skripte'),
        links: getI18nMsg('techStatLinks', 'Linkovi'),
        css: getI18nMsg('techStatCss', 'CSS'),
        forms: getI18nMsg('techStatForms', 'Forme'),
        tables: getI18nMsg('techStatTables', 'Tabele'),
        svg: getI18nMsg('techStatSvg', 'SVG'),
        video: getI18nMsg('techStatVideo', 'Video'),
        audio: getI18nMsg('techStatAudio', 'Audio'),
        iframes: getI18nMsg('techStatIframes', 'Iframe')
    };
}

function renderTechResults(listContainer, loading, results) {
    if (loading) loading.style.display = "none";
    if (!listContainer) return;

    const resultCount = results.length;
    if (resultCount > 0) {
        const summary = document.createElement("div");
        summary.style.color = "var(--text-dim)";
        summary.style.fontSize = "11px";
        summary.style.marginBottom = "8px";
        summary.style.textAlign = "center";
        summary.textContent = `${getI18nMsg("techFoundPrefix", "Pronađeno: ")} ${resultCount} ${getI18nMsg("techItemsSuffix", "stavki")}`;
        listContainer.appendChild(summary);
    }

    const grouped = {};
    results.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });

    Object.entries(grouped).forEach(([category, items]) => {
        const groupTitle = document.createElement("div");
        groupTitle.className = "tech-group-title";
        groupTitle.textContent = category;
        groupTitle.style.marginTop = "18px";
        groupTitle.style.fontWeight = "bold";
        groupTitle.style.fontSize = "15px";
        groupTitle.style.color = "var(--accent, #00ff88)";
        listContainer.appendChild(groupTitle);

        items.forEach(item => {
            const el = document.createElement("div");
            el.className = "tech-item";
            const icon = document.createElement("div");
            icon.className = "tech-icon";
            icon.innerHTML = getTechIconHtml(item.name);
            const info = document.createElement("div");
            info.className = "tech-info";
            const name = document.createElement("span");
            name.className = "tech-name";
            name.textContent = String(item.name || "");
            info.appendChild(name);
            if (item.detail) {
                const detail = document.createElement("span");
                detail.className = "tech-detail";
                detail.textContent = String(item.detail);
                info.appendChild(detail);
            }
            el.appendChild(icon);
            el.appendChild(info);
            listContainer.appendChild(el);
        });
    });
}

export async function runTechScanner() {
    try {
        switchView("mainView", "techView");
        const listContainer = document.getElementById("techResultList");
        const loading = document.getElementById("techLoading");
        while (listContainer.firstChild) listContainer.removeChild(listContainer.firstChild);
        loading.style.display = "block";

        if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
            showTechMessage(listContainer, loading, getI18nMsg("techScannerUnavailable", "Skener nije dostupan na ovoj stranici."));
            return;
        }

        const networkResults = await loadNetworkResults(tab.url);

        const executeWithTimeout = (tabId, networkResults) => {
            return new Promise((resolve, reject) => {
                let isResolved = false;
                const timeoutId = setTimeout(() => {
                    if (!isResolved) {
                        isResolved = true;
                        reject(new Error("Scanner timeout: stranica je presporo odgovorila"));
                    }
                }, 8000);

                const techCatMap = getTechCatMap();
                const techStatLabels = getTechStatLabels();

                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    world: "ISOLATED",
                    func: async (foundLabel, noneFoundLabel, catMap, statLabels, networkResults) => {
                        const results = [];
                        const add = (category, name, detail = "") => {
                            if (!category || !name) return;
                            const translatedCat = catMap[category] || category;
                            results.push({ category: translatedCat, name, detail });
                        };
                        const getAttr = (el, attr) => (el?.getAttribute?.(attr) || "").toLowerCase();
                        const html = document.documentElement;
                        const scriptEls = Array.from(document.scripts);
                        const scripts = scriptEls.map(s => (s.src || '').toLowerCase()).filter(Boolean);
                        const inlineScripts = scriptEls.map(s => s.textContent || '').join('\n').toLowerCase();
                        const linkEls = Array.from(document.querySelectorAll('link'));
                        const links = linkEls.map(l => (l.href || '').toLowerCase()).filter(Boolean);
                        const metas = Array.from(document.querySelectorAll('meta'));
                        const getMetaByName = (name) => {
                            const el = metas.find(m => (m.getAttribute('name') || '').toLowerCase() === name.toLowerCase());
                            return el ? (el.getAttribute('content') || '') : '';
                        };

                        add('Osnova', 'HTML5');
                        add('Osnova', 'JavaScript');
                        if (document.characterSet) add('Osnova', document.characterSet);
                        if (window.location.protocol === 'https:') add('Osnova', 'HTTPS');
                        if (getMetaByName('viewport')) add('Osnova', 'Viewport');
                        if (getMetaByName('theme-color')) add('Osnova', 'Theme Color');
                        if (html.lang) add('Osnova', html.lang.toUpperCase());
                        if (document.querySelector('link[rel="manifest"]')) add('Osnova', 'PWA');
                        if (window.speechSynthesis) add('Osnova', 'Web Speech API');
                        if (window.WebGLRenderingContext) add('Osnova', 'WebGL');
                        if (window.caches) add('Osnova', 'Cache API');
                        if (navigator.serviceWorker) add('Osnova', 'Service Workers');
                        if (window.indexedDB) add('Osnova', 'IndexedDB');
                        if (window.WebAssembly) add('Osnova', 'WebAssembly');
                        if (window.RTCPeerConnection) add('Osnova', 'WebRTC');
                        if (navigator.geolocation) add('Osnova', 'Geolocation');

                        (Array.isArray(networkResults) ? networkResults : []).forEach((item) => {
                            add(item.category || 'Mreža', item.name || '', item.detail || '');
                        });

                        if (scripts.some(s => s.includes('cdnjs'))) add('CDN', 'CDNJS');
                        if (scripts.some(s => s.includes('jsdelivr'))) add('CDN', 'jsDelivr');
                        if (scripts.some(s => s.includes('unpkg'))) add('CDN', 'UNPKG');
                        if (links.some(l => l.includes('fonts.googleapis.com'))) add('CDN', 'Google Fonts');
                        if (links.some(l => l.includes('use.typekit.net'))) add('CDN', 'Adobe Fonts');
                        if (scripts.some(s => s.includes('stackpath.bootstrapcdn.com'))) add('CDN', 'BootstrapCDN');
                        if (scripts.some(s => s.includes('cloudflare'))) add('CDN', 'Cloudflare');
                        if (scripts.some(s => s.includes('fastly'))) add('CDN', 'Fastly');

                        add('Statistika', document.getElementsByTagName('*').length + ' ' + statLabels.dom);
                        add('Statistika', document.images.length + ' ' + statLabels.images);
                        add('Statistika', scriptEls.length + ' ' + statLabels.scripts);
                        add('Statistika', document.links.length + ' ' + statLabels.links);
                        add('Statistika', linkEls.filter(l => getAttr(l, 'rel') === 'stylesheet').length + ' ' + statLabels.css);
                        add('Statistika', document.forms.length + ' ' + statLabels.forms);
                        if (document.getElementsByTagName('table').length > 0) add('Statistika', document.getElementsByTagName('table').length + ' ' + statLabels.tables);
                        if (document.getElementsByTagName('svg').length > 0) add('Statistika', document.getElementsByTagName('svg').length + ' ' + statLabels.svg);
                        if (document.getElementsByTagName('video').length > 0) add('Statistika', document.getElementsByTagName('video').length + ' ' + statLabels.video);
                        if (document.getElementsByTagName('audio').length > 0) add('Statistika', document.getElementsByTagName('audio').length + ' ' + statLabels.audio);
                        if (document.getElementsByTagName('iframe').length > 0) add('Statistika', document.getElementsByTagName('iframe').length + ' ' + statLabels.iframes);

                        if (document.title) add('SEO', 'Title');
                        if (getMetaByName('description')) add('SEO', 'Description');
                        if (getMetaByName('keywords')) add('SEO', 'Keywords');
                        if (getMetaByName('robots')) add('SEO', 'Robots');
                        if (getMetaByName('author')) add('SEO', 'Author');
                        if (document.querySelector('link[rel="canonical"]')) add('SEO', 'Canonical');
                        if (document.querySelector('link[rel="alternate"][hreflang]')) add('SEO', 'Hreflang');
                        if (metas.some(m => m.getAttribute('property')?.startsWith('og:'))) add('SEO', 'Open Graph');
                        if (metas.some(m => getAttr(m, 'name').startsWith('twitter:'))) add('SEO', 'Twitter Cards');
                        if (document.querySelector('script[type="application/ld+json"]')) add('SEO', 'JSON LD');
                        if (document.querySelector('[itemscope]')) add('SEO', 'Microdata');
                        if (document.querySelector('h1')) add('SEO', 'H1 Tag');

                        try {
                            const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
                            const header = (name) => (response.headers.get(name) || '').toLowerCase();
                            const server = header('server');
                            const poweredBy = header('x-powered-by');
                            if (server.includes('nginx')) add('Server', 'Nginx');
                            if (server.includes('apache')) add('Server', 'Apache');
                            if (server.includes('litespeed')) add('Server', 'LiteSpeed');
                            if (server.includes('cloudflare')) add('Server', 'Cloudflare');
                            if (server.includes('varnish')) add('Server', 'Varnish');
                            if (server.includes('cowboy')) add('Server', 'Cowboy');
                            if (server.includes('iis')) add('Server', 'IIS');
                            if (server.includes('caddy')) add('Server', 'Caddy');
                            if (poweredBy.includes('php')) add('Backend', 'PHP');
                            if (poweredBy.includes('express')) add('Backend', 'Express.js');
                            if (poweredBy.includes('asp.net')) add('Backend', 'ASP.NET');
                            if (poweredBy.includes('laravel')) add('Backend', 'Laravel');
                            if (poweredBy.includes('next')) add('Backend', 'Next.js');
                            if (poweredBy.includes('django')) add('Backend', 'Django');
                            if (poweredBy.includes('ruby')) add('Backend', 'Ruby on Rails');
                            if (poweredBy.includes('python')) add('Backend', 'Python');
                            if (poweredBy.includes('java')) add('Backend', 'Java');
                            if (header('content-security-policy')) add('Sigurnost', 'CSP');
                            if (header('strict-transport-security')) add('Sigurnost', 'HSTS');
                            if (header('x-frame-options')) add('Sigurnost', 'X Frame Options');
                            if (header('x-content-type-options')) add('Sigurnost', 'X Content Type Options');
                            if (header('referrer-policy')) add('Sigurnost', 'Referrer Policy');
                            if (header('permissions-policy')) add('Sigurnost', 'Permissions Policy');
                            if (header('access-control-allow-origin')) add('Sigurnost', 'CORS');
                            if (header('cache-control')) add('Keširanje', 'Cache Control');
                            if (header('etag')) add('Keširanje', 'ETag');
                            if (header('cf-cache-status')) add('Keširanje', 'Cloudflare Cache');
                        } catch (e) { }

                        const generator = getMetaByName('generator').toLowerCase();
                        if (generator.includes('wordpress') || links.some(l => l.includes('wp-content'))) add('Sistem', 'WordPress');
                        if (generator.includes('joomla')) add('Sistem', 'Joomla');
                        if (generator.includes('wix')) add('Sistem', 'Wix');
                        if (generator.includes('drupal')) add('Sistem', 'Drupal');
                        if (html.hasAttribute('data-wf-site')) add('Sistem', 'Webflow');
                        if (generator.includes('ghost')) add('Sistem', 'Ghost');
                        if (generator.includes('squarespace')) add('Sistem', 'Squarespace');
                        if (generator.includes('weebly')) add('Sistem', 'Weebly');
                        if (window.contentful) add('Sistem', 'Contentful');

                        if (window.Shopify || scripts.some(s => s.includes('shopify'))) add('E Trgovina', 'Shopify');
                        if (document.querySelector('.woocommerce')) add('E Trgovina', 'WooCommerce');
                        if (window.Magento) add('E Trgovina', 'Magento');
                        if (generator.includes('prestashop')) add('E Trgovina', 'PrestaShop');
                        if (generator.includes('opencart')) add('E Trgovina', 'OpenCart');
                        if (window.Stripe) add('Plaćanje', 'Stripe');
                        if (window.paypal) add('Plaćanje', 'PayPal');

                        const nextBuild = window.__NEXT_DATA__?.buildId ? `Build ${window.__NEXT_DATA__.buildId}` : '';
                        if (document.querySelector('#__next') || window.next || window.__NEXT_DATA__) add('Tehnologije', 'Next.js', nextBuild);
                        if (document.querySelector('#___gatsby') || window.gatsby) add('Tehnologije', 'Gatsby');
                        const reactVer = window.React?.version ? `v${window.React.version}` : '';
                        if (window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || document.querySelector('[data-reactroot]')) add('Tehnologije', 'React', reactVer);
                        const vueVer = window.Vue?.version ? `v${window.Vue.version}` : '';
                        if (window.Vue || document.querySelector('[data-v-app]') || window.__VUE__) add('Tehnologije', 'Vue.js', vueVer);
                        const angularVer = document.querySelector('[ng-version]')?.getAttribute('ng-version');
                        if (window.angular || angularVer) add('Tehnologije', 'Angular', angularVer ? `v${angularVer}` : '');
                        if (window.Svelte || document.querySelector('[data-svelte-h]')) add('Tehnologije', 'Svelte');
                        if (window.__NUXT__ || document.querySelector('#__nuxt')) add('Tehnologije', 'Nuxt.js');
                        if (window.Remix || window.__remixContext) add('Tehnologije', 'Remix');
                        if (document.querySelector('astro-island') || window.Astro) add('Tehnologije', 'Astro');
                        if (window.Preact) add('Tehnologije', 'Preact');
                        const emberVer = window.Ember?.VERSION ? `v${window.Ember.VERSION}` : '';
                        if (window.Ember) add('Tehnologije', 'Ember.js', emberVer);
                        if (window.Meteor) add('Tehnologije', 'Meteor');

                        const jqVersion = window.jQuery?.fn?.jquery ? `v${window.jQuery.fn.jquery}` : '';
                        if (window.jQuery) add('Tehnologije', 'jQuery', jqVersion);
                        if (window._) add('Tehnologije', 'Lodash', window._.VERSION ? `v${window._.VERSION}` : '');
                        if (window.moment) add('Tehnologije', 'Moment.js', window.moment.version ? `v${window.moment.version}` : '');
                        if (window.axios) add('Tehnologije', 'Axios', window.axios.VERSION ? `v${window.axios.VERSION}` : '');
                        if (window.d3) add('Tehnologije', 'D3.js', window.d3.version ? `v${window.d3.version}` : '');
                        if (window.Chart) add('Tehnologije', 'Chart.js', window.Chart.version ? `v${window.Chart.version}` : '');
                        if (window.Swiper) add('Tehnologije', 'Swiper.js');
                        if (window.gsap) add('Tehnologije', 'GSAP', window.gsap.version ? `v${window.gsap.version}` : '');
                        if (window.THREE) add('Tehnologije', 'Three.js', window.THREE.REVISION ? `r${window.THREE.REVISION}` : '');
                        if (window.anime) add('Tehnologije', 'Anime.js', window.anime.version ? `v${window.anime.version}` : '');
                        if (window.PIXI) add('Tehnologije', 'PixiJS', window.PIXI.VERSION ? `v${window.PIXI.VERSION}` : '');
                        if (window.Alpine) add('Tehnologije', 'Alpine.js', window.Alpine.version ? `v${window.Alpine.version}` : '');
                        if (window.firebase) add('Baza Podataka', 'Firebase');
                        if (window.supabase) add('Baza Podataka', 'Supabase');
                        if (window.io) add('Tehnologije', 'Socket.io');

                        if (links.some(l => l.includes('tailwindcss')) || scripts.some(s => s.includes('tailwind')) || document.querySelector('[class*="tw-"]')) add('Stilovi', 'Tailwind CSS');
                        if (document.querySelector('[class*="shadcn"]') || document.querySelector('[data-radix-collection]')) add('Stilovi', 'Shadcn UI / Radix UI');
                        if (document.querySelector('[class*="daisy"]') || document.querySelector('[data-theme]')) add('Stilovi', 'DaisyUI');
                        if (document.querySelector('[class*="mantine-"]')) add('Stilovi', 'Mantine');
                        if (window.ChakraUI || document.querySelector('[class*="chakra-"]')) add('Stilovi', 'Chakra UI');
                        if (document.querySelector('[class*="flowbite"]')) add('Stilovi', 'Flowbite');
                        if (links.some(l => l.includes('bootstrap')) || scripts.some(s => s.includes('bootstrap'))) add('Stilovi', 'Bootstrap');
                        if (links.some(l => l.includes('bulma'))) add('Stilovi', 'Bulma');
                        if (links.some(l => l.includes('foundation'))) add('Stilovi', 'Foundation');
                        if (links.some(l => l.includes('materialize'))) add('Stilovi', 'Materialize');
                        if (document.querySelector('style[data-emotion]')) add('Stilovi', 'Emotion');
                        if (document.querySelector('style[data-styled]')) add('Stilovi', 'Styled Components');
                        if (links.some(l => l.includes('font-awesome') || l.includes('fontawesome'))) add('Stilovi', 'FontAwesome');
                        if (links.some(l => l.includes('bootstrap-icons'))) add('Stilovi', 'Bootstrap Icons');

                        if (window.Clerk || window.__clerk_js_version) add('Alati', 'Clerk Auth');
                        if (window.auth0) add('Alati', 'Auth0');
                        if (window.Sentry || window.__SENTRY__) add('Alati', 'Sentry');
                        if (window.posthog) add('Analitika', 'PostHog');
                        if (window.umami) add('Analitika', 'Umami');
                        if (window.fathom) add('Analitika', 'Fathom');
                        if (window.Stripe) add('Plaćanje', 'Stripe');
                        if (window.lemonSqueezy || window.LemonSqueezy) add('Plaćanje', 'Lemon Squeezy');

                        if (scripts.some(s => s.includes('vite') || inlineScripts.includes('@vite/client'))) add('Build', 'Vite');
                        if (scripts.some(s => s.includes('webpack') || inlineScripts.includes('webpackjsonp'))) add('Build', 'Webpack');
                        if (scripts.some(s => s.includes('parcel'))) add('Build', 'Parcel');
                        if (scripts.some(s => s.includes('rollup'))) add('Build', 'Rollup');
                        if (scripts.some(s => s.includes('babel'))) add('Build', 'Babel');

                        const gaMatch = inlineScripts.match(/(g-[a-z0-9]{4,}|ua-\d+-\d+)/i);
                        const gaId = gaMatch ? gaMatch[0].toUpperCase() : '';
                        if (window.ga || window.gtag || scripts.some(s => s.includes('google-analytics'))) add('Analitika', 'Google Analytics', gaId);
                        const fbMatch = inlineScripts.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/i);
                        const fbId = fbMatch ? fbMatch[1] : '';
                        if (window.fbq || scripts.some(s => s.includes('fbevents.js'))) add('Analitika', 'Meta Pixel', fbId);
                        if (window.hj || scripts.some(s => s.includes('hotjar'))) add('Analitika', 'Hotjar');
                        if (window.clarity || scripts.some(s => s.includes('clarity.ms'))) add('Analitika', 'Microsoft Clarity');
                        if (scripts.some(s => s.includes('plausible.io'))) add('Analitika', 'Plausible');
                        const gtmMatch = inlineScripts.match(/gtm-[a-z0-9]+/i);
                        const gtmId = gtmMatch ? gtmMatch[0].toUpperCase() : '';
                        if (window.google_tag_manager || scripts.some(s => s.includes('googletagmanager'))) add('Analitika', 'Google Tag Manager', gtmId);
                        if (window.Matomo || scripts.some(s => s.includes('matomo'))) add('Analitika', 'Matomo');
                        if (window.mixpanel) add('Analitika', 'Mixpanel');
                        if (window.analytics) add('Analitika', 'Segment');
                        if (scripts.some(s => s.includes('tiktok.com'))) add('Analitika', 'TikTok Pixel');
                        if (scripts.some(s => s.includes('snap.licdn.com'))) add('Analitika', 'LinkedIn Insight');

                        if (window.Intercom) add('Komunikacija', 'Intercom');
                        if (window.$crisp) add('Komunikacija', 'Crisp Chat');
                        if (window.Tawk_API) add('Komunikacija', 'Tawk.to');
                        if (window.zE) add('Komunikacija', 'Zendesk');
                        if (document.querySelector('iframe[src*="youtube.com"]')) add('Mediji', 'YouTube Player');
                        if (document.querySelector('iframe[src*="vimeo.com"]')) add('Mediji', 'Vimeo Player');
                        if (window.videojs) add('Mediji', 'Video.js');
                        if (scripts.some(s => s.includes('adsbygoogle'))) add('Reklame', 'Google AdSense');

                        const unique = [];
                        const seen = new Set();
                        results.forEach(r => {
                            const key = r.category + '|' + r.name;
                            if (!seen.has(key)) {
                                seen.add(key);
                                unique.push(r);
                            }
                        });
                        unique.sort((a, b) => {
                            const priority = [
                                catMap['Osnova'], catMap['Sistem'], catMap['E Trgovina'],
                                catMap['Tehnologije'], catMap['Stilovi'], catMap['Baza Podataka'],
                                catMap['Backend'], catMap['Server'], catMap['Mreža'],
                                catMap['Sigurnost'], catMap['Keširanje'], catMap['CDN'],
                                catMap['Analitika'], catMap['Reklame'], catMap['Plaćanje'],
                                catMap['Komunikacija'], catMap['Mediji'], catMap['Build'],
                                catMap['SEO'], catMap['Statistika'], catMap['Alati']
                            ];
                            const catA = priority.indexOf(a.category);
                            const catB = priority.indexOf(b.category);
                            if (catA !== catB) return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB);
                            return String(a.name).localeCompare(String(b.name));
                        });
                        return unique;
                    },
                    args: [getI18nMsg("techFoundPrefix", "Pronađeno: "), getI18nMsg("techNotFound", "Nije pronađeno."), techCatMap, techStatLabels, networkResults]
                }, (res) => {
                    if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeoutId);
                        loading.style.display = "none";
                        if (chrome.runtime.lastError) {
                            showTechMessage(listContainer, loading, getI18nMsg("techScannerFailed", "Skeniranje nije uspelo na ovoj stranici."));
                            resolve();
                            return;
                        }
                        if (res && res[0] && Array.isArray(res[0].result)) {
                            renderTechResults(listContainer, loading, res[0].result);
                        }
                        resolve();
                    }
                });
            });
        };

        try {
            if (tab?.id) {
                await executeWithTimeout(tab.id, networkResults);
            } else {
                showTechMessage(listContainer, loading, getI18nMsg("techScannerFailed", "Skeniranje nije uspelo na ovoj stranici."));
            }
        } catch (err) {
            showTechMessage(listContainer, loading, getI18nMsg("techScannerFailed", "Skeniranje nije uspelo na ovoj stranici."));
        }
    } catch (err) {
        // Silent fail
    }
}

document.getElementById("techBackBtn")?.addEventListener("click", () => {
    switchView("techView", "mainView", true);
});
