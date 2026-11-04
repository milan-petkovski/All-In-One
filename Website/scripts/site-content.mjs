/**
 * Centralni SEO / AEO / GEO sadrzaj sajta.
 * Jedan izvor istine za: meta tagove, JSON-LD, vidljivi FAQ i llms.txt.
 * Koristi ga scripts/postbuild.mjs pri prerenderu EN (/) i SR (/sr/) verzija.
 */

export const SITE = {
    origin: 'https://allinone.milanwebportal.com',
    name: 'All In One',
    storeUrl: 'https://chromewebstore.google.com/detail/hmkcbieabcldlndhjeemggokhlebjoem',
    storeReviewsUrl: 'https://chromewebstore.google.com/detail/all-in-one/hmkcbieabcldlndhjeemggokhlebjoem/reviews',
    orgId: 'https://milanwebportal.com/#organization',
    personId: 'https://milanwebportal.com/#milan-petkovski',
    twitter: '@milanwebportal',
    github: 'https://github.com/milan-petkovski/All-In-One',
    langs: {
        en: { code: 'en', htmlLang: 'en', ogLocale: 'en_US', prefix: '', og: 'og-en.jpg', label: 'English' },
        sr: { code: 'sr', htmlLang: 'sr-Latn', ogLocale: 'sr_RS', prefix: '/sr', og: 'og-sr.jpg', label: 'Srpski' }
    }
};

export const PAGES = {
    index: {
        path: '/',
        file: 'index.html',
        type: 'home',
        en: {
            title: 'All In One: 15 Free Chrome Tools in One Extension',
            description:
                'Free Chrome extension with 15 tools in one: color picker, page ruler, font finder, dark mode, 1000% volume booster, time tracker and more. No sign-up.',
            keywords:
                'chrome extension, productivity extension, color picker, page ruler, font finder, dark mode extension, volume booster, webtime tracker, enable copy, website technology checker, clear cache and cookies, return youtube dislike, all in one extension',
            ogAlt: 'All In One Chrome extension popup with 15 productivity tools'
        },
        sr: {
            title: 'All In One: 15 besplatnih alata u jednoj Chrome ekstenziji',
            description:
                'Besplatna Chrome ekstenzija sa 15 alata: color picker, lenjir, font finder, dark mode, pojačivač zvuka do 1000%, praćenje vremena i još mnogo toga.',
            keywords:
                'chrome ekstenzija, ekstenzija za produktivnost, color picker, page ruler, font finder, dark mode ekstenzija, pojačivač zvuka, webtime tracker, enable copy, tehnologije sajta, brisanje keša i kolačića, return youtube dislike, all in one ekstenzija',
            ogAlt: 'All In One Chrome ekstenzija sa 15 alata za produktivnost'
        }
    },
    privacy: {
        path: '/privacy',
        file: 'privacy.html',
        type: 'legal',
        en: {
            title: 'Privacy Policy | All In One Chrome Extension',
            description:
                'All In One processes your notes, settings and time statistics locally in your browser. No personal data is collected, sold or shared. Read the full policy.',
            keywords: 'all in one privacy policy, chrome extension privacy, local data processing',
            ogAlt: 'All In One privacy policy'
        },
        sr: {
            title: 'Politika privatnosti | All In One Chrome ekstenzija',
            description:
                'All In One beleške, podešavanja i statistiku vremena obrađuje lokalno u tvom pretraživaču. Lični podaci se ne prikupljaju, ne prodaju i ne dele.',
            keywords: 'all in one politika privatnosti, privatnost chrome ekstenzije, lokalna obrada podataka',
            ogAlt: 'All In One politika privatnosti'
        }
    }
};

export const FAQ = {
    en: [
        {
            q: 'What is the All In One extension?',
            a: 'All In One is a free Chrome extension that combines 15 everyday tools in one popup: Radio IN, Volume Booster up to 1000%, Color Picker, Dark Mode, Page Ruler, Enable Copy, Page Marker, Site Technologies, Cookies and Cache cleaner, Font Finder, Character Counter, Stopwatch, Smart Notes, Webtime Tracker and Return YouTube Dislike.'
        },
        {
            q: 'Is All In One really free?',
            a: 'Yes. All In One is 100% free. There are no subscriptions, no premium plans, no ads and no registration. Every tool is available right after installation.'
        },
        {
            q: 'Which browsers does All In One support?',
            a: 'It works on every Chromium based browser: Google Chrome, Microsoft Edge, Brave, Opera, Opera GX, Vivaldi and Arc, on Windows, macOS and Linux. Install it from the Chrome Web Store.'
        },
        {
            q: 'How do I install and pin All In One?',
            a: 'Open the Chrome Web Store page and click Add to Chrome. Then click the puzzle icon in the top right corner of your browser and pin All In One. Click its icon any time to open the tools. The whole setup takes under a minute.'
        },
        {
            q: 'Does All In One collect my personal data?',
            a: 'No. Notes, time tracking statistics and settings are stored locally on your device. The extension has no access to your passwords or private sessions and never sells or shares your data. Anonymous technical statistics (Google Analytics 4) are used only to improve stability and performance.'
        },
        {
            q: 'Can I boost the volume above 100% in Chrome?',
            a: 'Yes. The Volume tool raises the sound of any tab up to 1000%, far above the normal browser limit. Use it carefully to protect your hearing.'
        },
        {
            q: 'How do I bring back the YouTube dislike counter?',
            a: 'Turn on Return YouTube Dislike inside the All In One popup. It restores the dislike count under videos on YouTube automatically, using the public Return YouTube Dislike API.'
        },
        {
            q: 'How do I find the font or color used on a website?',
            a: 'Open All In One and choose Font Finder, then hover over any text to see its font. Choose Color Picker and click anywhere on the page to copy the exact HEX color code.'
        },
        {
            q: 'Does All In One work on mobile phones?',
            a: 'No. All In One is a desktop browser extension and mobile browsers do not support Chrome extensions. Use a Windows, macOS or Linux computer.'
        },
        {
            q: 'Which languages does All In One support?',
            a: 'The extension and the Chrome Web Store listing support 55 languages. The interface automatically follows your browser language.'
        }
    ],
    sr: [
        {
            q: 'Šta je All In One ekstenzija?',
            a: 'All In One je besplatna Chrome ekstenzija koja objedinjuje 15 svakodnevnih alata u jednom prozoru: Radio IN, pojačivač zvuka do 1000%, Color Picker, Dark Mode, Page Ruler, Enable Copy, Page Marker, Tehnologije sajta, brisanje keša i kolačića, Font Finder, brojač karaktera, štopericu, pametne beleške, Webtime Tracker i Return YouTube Dislike.'
        },
        {
            q: 'Da li je All In One zaista besplatan?',
            a: 'Da. All In One je 100% besplatan. Nema pretplate, premium planova, reklama ni registracije. Svi alati su dostupni odmah po instalaciji.'
        },
        {
            q: 'Na kojim pretraživačima radi All In One?',
            a: 'Radi na svim Chromium pretraživačima: Google Chrome, Microsoft Edge, Brave, Opera, Opera GX, Vivaldi i Arc, na Windows, macOS i Linux sistemima. Instalira se sa Chrome Web Store prodavnice.'
        },
        {
            q: 'Kako se instalira i pin-uje All In One?',
            a: 'Otvori stranicu na Chrome Web Store prodavnici i klikni na Dodaj u Chrome. Zatim klikni na ikonicu slagalice u gornjem desnom uglu pretraživača i pin-uj All In One. Klikni na njegovu ikonicu kad god ti zatreba neki alat. Podešavanje traje manje od minuta.'
        },
        {
            q: 'Da li All In One prikuplja lične podatke?',
            a: 'Ne. Beleške, statistika praćenja vremena i podešavanja čuvaju se lokalno na tvom uređaju. Ekstenzija nema pristup lozinkama ni privatnim sesijama i nikada ne prodaje niti deli tvoje podatke. Anonimna tehnička statistika (Google Analytics 4) koristi se samo za poboljšanje stabilnosti i performansi.'
        },
        {
            q: 'Mogu li da pojačam zvuk iznad 100% u Chrome pretraživaču?',
            a: 'Da. Alat Zvuk pojačava zvuk bilo kog taba do 1000%, daleko iznad standardnog ograničenja pretraživača. Koristi ga oprezno da bi zaštitio sluh.'
        },
        {
            q: 'Kako da vratim brojač nesviđanja na YouTube-u?',
            a: 'Uključi opciju Return YouTube Dislike u All In One prozoru. Ona automatski vraća broj nesviđanja ispod video snimaka na YouTube-u, uz pomoć javnog Return YouTube Dislike API-ja.'
        },
        {
            q: 'Kako da saznam koji font ili boja se koriste na sajtu?',
            a: 'Otvori All In One i izaberi Font Finder, pa pređi mišem preko bilo kog teksta da vidiš koji je font. Izaberi Color Picker i klikni bilo gde na stranici da kopiraš tačan HEX kod boje.'
        },
        {
            q: 'Da li All In One radi na mobilnom telefonu?',
            a: 'Ne. All In One je ekstenzija za desktop pretraživače, a mobilni pretraživači ne podržavaju Chrome ekstenzije. Potreban ti je Windows, macOS ili Linux računar.'
        },
        {
            q: 'Koje jezike podržava All In One?',
            a: 'Ekstenzija i njena stranica na Chrome Web Store prodavnici podržavaju 55 jezika. Interfejs automatski prati jezik tvog pretraživača.'
        }
    ]
};

export const FEATURES = {
    en: [
        'Radio IN: listen to radio from the popup without opening new tabs',
        'Volume Booster: raise the sound of any tab up to 1000%',
        'Color Picker: pick and copy the exact HEX color from any page',
        'Dark Mode: force a dark theme on any website',
        'Page Ruler: measure any element in pixels',
        'Enable Copy: bypass right click and text selection blocks',
        'Page Marker: draw, write and highlight directly on the screen',
        'Site Technologies: see what a website is built with',
        'Cookies and Cache: clear them for the current site and hide cookie banners',
        'Font Finder: identify the font of any text by hovering',
        'Character Counter: count selected words and characters',
        'Stopwatch: mark moments during a live stream with one shortcut',
        'Smart Notes: notes with smart math and date helpers',
        'Webtime Tracker: see how much time you spend on each domain',
        'Return YouTube Dislike: restore the dislike counter on YouTube'
    ],
    sr: [
        'Radio IN: slušaj radio iz prozora ekstenzije bez otvaranja novih tabova',
        'Pojačivač zvuka: pojačaj zvuk bilo kog taba do 1000%',
        'Color Picker: izaberi i kopiraj tačan HEX kod boje sa bilo koje stranice',
        'Dark Mode: forsiraj tamnu temu na bilo kom sajtu',
        'Page Ruler: izmeri bilo koji element u pikselima',
        'Enable Copy: zaobiđi blokadu desnog klika i selekcije teksta',
        'Page Marker: crtaj, piši i podvlači direktno po ekranu',
        'Tehnologije sajta: saznaj u čemu je sajt napravljen',
        'Kolačići i keš: obriši ih za trenutni sajt i sakrij cookie banere',
        'Font Finder: prepoznaj font bilo kog teksta prelaskom miša',
        'Brojač karaktera: prebroj selektovane reči i karaktere',
        'Štoperica: zabeleži trenutke tokom lajva jednom prečicom',
        'Pametne beleške: beleške sa pametnom matematikom i datumima',
        'Webtime Tracker: prati koliko vremena provodiš na svakom domenu',
        'Return YouTube Dislike: vrati brojač nesviđanja na YouTube-u'
    ]
};

/** Kratak odgovor za AEO/GEO blok (vidljiv na stranici + llms.txt). */
export const TLDR = {
    en: 'All In One is a free browser extension for Chrome, Edge, Brave, Opera and other Chromium browsers. It bundles 15 productivity tools for developers, designers and creators in one popup: color picker, page ruler, font finder, dark mode, volume booster up to 1000%, webtime tracker, smart notes, cookie cleaner and more. No account, no ads, and your data stays on your device.',
    sr: 'All In One je besplatna ekstenzija za Chrome, Edge, Brave, Operu i druge Chromium pretraživače. Objedinjuje 15 alata za produktivnost developera, dizajnera i kreatora u jednom prozoru: color picker, lenjir, font finder, dark mode, pojačivač zvuka do 1000%, webtime tracker, pametne beleške, brisanje kolačića i još mnogo toga. Bez naloga, bez reklama, a tvoji podaci ostaju na tvom uređaju.'
};

export const HOWTO = {
    en: {
        name: 'How to install the All In One Chrome extension',
        description: 'Install All In One in three steps and start using 15 productivity tools right away.',
        steps: [
            ['Install the extension', 'Open the Chrome Web Store page of All In One and click Add to Chrome. It is free and installs in under 30 seconds.'],
            ['Pin it for quick access', 'Click the puzzle icon in the top right corner of the browser and pin All In One to the toolbar.'],
            ['Click and use', 'Click the All In One icon any time and pick the tool you need. No ads and no popups.']
        ]
    },
    sr: {
        name: 'Kako instalirati All In One Chrome ekstenziju',
        description: 'Instaliraj All In One u tri koraka i odmah počni da koristiš 15 alata za produktivnost.',
        steps: [
            ['Instaliraj ekstenziju', 'Otvori All In One na Chrome Web Store prodavnici i klikni Dodaj u Chrome. Besplatno je i instalira se za manje od 30 sekundi.'],
            ['Pin-uj za brz pristup', 'Klikni na ikonicu slagalice u gornjem desnom uglu pretraživača i pin-uj All In One na traku sa alatima.'],
            ['Klikni i koristi', 'Klikni na ikonicu All In One kada god ti zatreba i izaberi alat. Bez reklama i bez iskačućih prozora.']
        ]
    }
};

const abs = (p) => `${SITE.origin}${p}`;

export function pageUrl(pageKey, lang) {
    const page = PAGES[pageKey];
    const prefix = SITE.langs[lang].prefix;
    if (page.path === '/') return abs(prefix ? `${prefix}/` : '/');
    return abs(`${prefix}${page.path}`);
}

/**
 * Gradi JSON-LD @graph za stranicu.
 * @param {'index'|'privacy'} pageKey
 * @param {'en'|'sr'} lang
 * @param {{version?: string, dateModified?: string}} ctx
 */
export function buildJsonLd(pageKey, lang, ctx = {}) {
    const page = PAGES[pageKey];
    const seo = page[lang];
    const url = pageUrl(pageKey, lang);
    const webSiteId = `${SITE.origin}/#website`;
    const appId = `${SITE.origin}/#software`;

    const graph = [
        {
            '@type': 'WebSite',
            '@id': webSiteId,
            name: SITE.name,
            url: `${SITE.origin}/`,
            description: PAGES.index[lang].description,
            inLanguage: ['en', 'sr-Latn'],
            publisher: { '@id': SITE.orgId }
        },
        {
            '@type': 'Organization',
            '@id': SITE.orgId,
            name: 'Milan Web Portal',
            url: 'https://milanwebportal.com',
            logo: {
                '@type': 'ImageObject',
                url: abs('/icon-512.png'),
                width: 512,
                height: 512
            },
            founder: { '@id': SITE.personId },
            contactPoint: {
                '@type': 'ContactPoint',
                email: 'contact@milanwebportal.com',
                contactType: 'customer support',
                availableLanguage: ['English', 'Serbian']
            },
            sameAs: ['https://github.com/milan-petkovski', 'https://linkedin.com/in/milan--petkovski', SITE.github]
        },
        {
            '@type': 'Person',
            '@id': SITE.personId,
            name: 'Milan Petkovski',
            url: 'https://milanwebportal.com',
            jobTitle: 'Founder and Software Engineer',
            worksFor: { '@id': SITE.orgId }
        }
    ];

    if (pageKey === 'index') {
        graph.push(
            {
                '@type': 'WebPage',
                '@id': `${url}#webpage`,
                url,
                name: seo.title,
                description: seo.description,
                inLanguage: SITE.langs[lang].htmlLang,
                isPartOf: { '@id': webSiteId },
                about: { '@id': appId },
                primaryImageOfPage: { '@type': 'ImageObject', url: abs(`/images/${SITE.langs[lang].og}`), width: 1200, height: 630 },
                ...(ctx.dateModified ? { dateModified: ctx.dateModified } : {})
            },
            {
                '@type': 'SoftwareApplication',
                '@id': appId,
                name: SITE.name,
                alternateName: 'All In One Browser Extension',
                url: `${SITE.origin}/`,
                downloadUrl: SITE.storeUrl,
                installUrl: SITE.storeUrl,
                image: abs('/icon-512.png'),
                screenshot: [abs('/Branding/EN/1.png'), abs('/Branding/EN/2.png'), abs('/Branding/EN/3.png')],
                description: PAGES.index.en.description,
                applicationCategory: 'BrowserApplication',
                applicationSubCategory: 'Productivity',
                operatingSystem: 'Windows, macOS, Linux, ChromeOS',
                browserRequirements: 'Requires Google Chrome, Microsoft Edge, Brave, Opera, Opera GX, Vivaldi or Arc',
                ...(ctx.version ? { softwareVersion: ctx.version } : {}),
                featureList: FEATURES.en,
                inLanguage: ['en', 'sr-Latn'],
                isAccessibleForFree: true,
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                    availability: 'https://schema.org/InStock'
                },
                author: { '@id': SITE.personId },
                creator: { '@id': SITE.orgId },
                publisher: { '@id': SITE.orgId },
                aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: '5.0',
                    bestRating: '5',
                    worstRating: '1',
                    ratingCount: '10'
                }
            },
            {
                '@type': 'FAQPage',
                '@id': `${url}#faq`,
                inLanguage: SITE.langs[lang].htmlLang,
                mainEntity: FAQ[lang].map((item) => ({
                    '@type': 'Question',
                    name: item.q,
                    acceptedAnswer: { '@type': 'Answer', text: item.a }
                }))
            },
            {
                '@type': 'HowTo',
                '@id': `${url}#howto`,
                name: HOWTO[lang].name,
                description: HOWTO[lang].description,
                totalTime: 'PT2M',
                estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
                step: HOWTO[lang].steps.map(([name, text], i) => ({
                    '@type': 'HowToStep',
                    position: i + 1,
                    name,
                    text,
                    ...(i === 0 ? { url: SITE.storeUrl } : {})
                }))
            }
        );
    } else {
        graph.push({
            '@type': 'WebPage',
            '@id': `${url}#webpage`,
            url,
            name: seo.title,
            description: seo.description,
            inLanguage: SITE.langs[lang].htmlLang,
            isPartOf: { '@id': webSiteId }
        });
    }

    graph.push({
        '@type': 'BreadcrumbList',
        itemListElement:
            pageKey === 'index'
                ? [{ '@type': 'ListItem', position: 1, name: SITE.name, item: url }]
                : [
                      { '@type': 'ListItem', position: 1, name: SITE.name, item: pageUrl('index', lang) },
                      { '@type': 'ListItem', position: 2, name: seo.title.split('|')[0].trim(), item: url }
                  ]
    });

    return { '@context': 'https://schema.org', '@graph': graph };
}
