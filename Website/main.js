import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createIcons } from 'lucide';
import { siteIcons } from './js/icons.js';
import { initGA, trackEvent, trackWebVitals } from './js/analytics.js';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Initialize Analytics & Web Vitals
initGA('G-F52S6J4TZV');
trackWebVitals();

let updateData = [];
window.currentTranslations = {};
window.toggleLanguage = toggleLanguage;
window.applyLanguage = applyLanguage;

function renderLucideIcons() {
    try {
        createIcons({ icons: siteIcons });
    } catch (err) {
        console.warn('Lucide icons error:', err);
    }
}

/**
 * Primenjuje izabrani jezik na celu stranicu
 */
export async function applyLanguage(lang) {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang === 'sr' ? 'sr' : 'en';

    try {
        const response = await fetch(`/${lang}.json`);
        if (!response.ok) throw new Error("Neuspesno ucitavanje JSON prevoda");
        
        const translations = await response.json();
        window.currentTranslations = translations;

        // Tekstualni prevodi
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (translations[key]) {
                if (el.tagName === "META") {
                    el.setAttribute("content", translations[key]);
                } else if (el.tagName === "TITLE") {
                    document.title = translations[key];
                } else {
                    el.innerHTML = translations[key];
                }
            }
        });

        // Placeholder prevodi za inpute i textarea
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (translations[key]) {
                element.setAttribute('placeholder', translations[key]);
            }
        });

        // Prevodi za linkove (href)
        document.querySelectorAll('[data-i18n-href]').forEach(element => {
            const key = element.getAttribute('data-i18n-href');
            if (translations[key]) {
                element.setAttribute('href', translations[key]);
            }
        });

        // Dugme za promenu jezika
        const nextLang = lang === 'sr' ? 'EN' : 'SR';
        document.querySelectorAll('#lang-text, [data-lang-text]').forEach(el => {
            el.textContent = nextLang;
        });

        // Lokalizacija datuma
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const locale = lang === 'sr' ? 'sr-Latn-RS' : 'en-US';
        const danas = new Date().toLocaleString(locale, options);
        document.querySelectorAll('.trenutni-datum').forEach(el => {
            el.textContent = danas;
        });

        // Ponovo iscrtaj azuriranja ako postoji kontejner
        if (document.getElementById('update-container')) {
            renderUpdates(lang);
        }

        // Osvezi ikonice
        renderLucideIcons();

        window.dispatchEvent(new CustomEvent('languageLoaded', { detail: lang }));
    } catch (error) {
        console.error('Greska pri ucitavanju prevoda:', error);
    }
}

/**
 * Menja jezik izmedju SR i EN (Toggle)
 */
export function toggleLanguage() {
    const currentLang = localStorage.getItem("lang") || "en";
    const newLang = currentLang === "sr" ? "en" : "sr";
    trackEvent('website_lang', { from: currentLang, to: newLang });
    applyLanguage(newLang);
}

/**
 * Dinamicko iscrtavanje liste azuriranja
 */
function renderUpdates(lang) {
    const container = document.getElementById('update-container');
    if (!container || !Array.isArray(updateData) || updateData.length === 0) return;

    container.innerHTML = '';
    let prosaoAktivni = false;
    
    updateData.forEach((item) => {
        const isAktivno = item.aktivno === true;
        if (isAktivno) prosaoAktivni = true;

        const isIspod = !isAktivno && prosaoAktivni;
        const card = document.createElement('div');
        card.className = `relative flex flex-col md:flex-row items-center mb-24 group`;

        const dot = document.createElement('div');
        dot.className = `absolute left-6 md:left-1/2 w-6 h-6 rounded-full -translate-x-1/2 z-20 ${isAktivno ? 'bg-darkpanel border-4 border-brand shadow-[0_0_20px_#00ff88]' : 'bg-gray-200 border-4 border-white'}`;
        card.appendChild(dot);

        const leftSide = document.createElement('div');
        leftSide.className = "w-full md:w-1/2 md:pr-16 md:text-right pl-16 md:pl-0 flex flex-col md:items-end mt-2";
        
        if (isAktivno) {
            const activeBadge = document.createElement('span');
            activeBadge.className = "bg-brand/10 text-brand font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-[0.2em] border border-brand/20";
            activeBadge.textContent = window.currentTranslations['upd_dyn_active'] || 'Active';
            leftSide.appendChild(activeBadge);
        }

        const versionWrapper = document.createElement('div');
        versionWrapper.className = "relative inline-block mt-4";
        const versionH2 = document.createElement('h2');
        versionH2.className = "text-6xl md:text-7xl font-black text-darkpanel tracking-tighter leading-none transition-transform duration-500 group-hover:scale-105 md:origin-right origin-left";
        
        const vSpan = document.createElement('span');
        vSpan.className = "text-gray-600 text-4xl md:text-5xl mr-1 font-bold";
        vSpan.textContent = 'v';
        versionH2.appendChild(vSpan);
        versionH2.appendChild(document.createTextNode(item.verzija));
        versionWrapper.appendChild(versionH2);
        leftSide.appendChild(versionWrapper);

        const dateWrapper = document.createElement('div');
        dateWrapper.className = "flex items-center gap-4 mt-4 transition-opacity duration-500";
        const line = document.createElement('div');
        line.className = "h-px w-12 bg-gradient-to-r from-transparent to-gray-400 hidden md:block";
        const dateP = document.createElement('p');
        dateP.className = "text-gray-700 font-extrabold text-[11px] uppercase tracking-[0.3em]";
        dateP.textContent = item[lang]?.datum || '';
        dateWrapper.append(line, dateP);
        leftSide.appendChild(dateWrapper);

        card.appendChild(leftSide);

        const rightSide = document.createElement('div');
        rightSide.className = "w-full md:w-1/2 md:pl-16 pl-16 mt-6 md:mt-0 transition-all duration-500 hover:translate-x-1";
        
        const contentBox = document.createElement('div');
        contentBox.className = "bg-[#1e1e24] p-9 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/5 relative overflow-hidden group-hover:border-brand/40 transition-all duration-500";
        
        const innerContent = document.createElement('div');
        innerContent.className = "relative z-10 text-left";

        const header = document.createElement('div');
        header.className = "flex items-center gap-3 mb-6";
        const iconWrap = document.createElement('div');
        iconWrap.className = "w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner";
        const iconI = document.createElement('i');
        iconI.setAttribute('data-lucide', isAktivno ? 'zap' : 'package');
        iconI.className = `w-5 h-5 ${isAktivno ? 'text-brand' : 'text-gray-400'}`;
        iconWrap.appendChild(iconI);
        
        const titleWrap = document.createElement('div');
        const h3 = document.createElement('h3');
        h3.className = "text-white font-black text-lg uppercase tracking-tight italic leading-tight";
        h3.textContent = item[lang]?.naslov || '';
        const subP = document.createElement('p');
        subP.className = "text-brand text-[9px] font-black uppercase tracking-widest";
        subP.textContent = window.currentTranslations['upd_dyn_stable'] || 'Stable Release';
        titleWrap.append(h3, subP);
        header.append(iconWrap, titleWrap);
        innerContent.appendChild(header);

        const descBox = document.createElement('div');
        descBox.className = "bg-white/5 rounded-[1.5rem] p-5 border border-white/5 shadow-inner";
        const descP = document.createElement('p');
        descP.className = "text-gray-200 leading-relaxed font-medium text-[14px]";
        descP.textContent = item[lang]?.opis || '';
        descBox.appendChild(descP);
        innerContent.appendChild(descBox);

        const footer = document.createElement('div');
        footer.className = "mt-6 flex items-center justify-between";
        const footLeft = document.createElement('div');
        footLeft.className = "flex items-center gap-2 text-gray-400";
        const pulse = document.createElement('span');
        pulse.className = "w-1.5 h-1.5 rounded-full bg-brand animate-pulse";
        const footText = document.createElement('span');
        footText.className = "text-[9px] font-black uppercase tracking-widest italic";
        footText.textContent = window.currentTranslations['upd_dyn_system'] || 'All In One System';
        footLeft.append(pulse, footText);
        
        const footIcon = document.createElement('i');
        footIcon.setAttribute('data-lucide', 'shield-check');
        footIcon.className = "w-4 h-4 text-gray-600 group-hover:text-brand transition-colors";
        
        footer.append(footLeft, footIcon);
        innerContent.appendChild(footer);

        contentBox.appendChild(innerContent);
        rightSide.appendChild(contentBox);
        card.appendChild(rightSide);

        container.appendChild(card);
    });
    renderLucideIcons();
}

/**
 * Pametna detekcija pocetnog jezika
 */
async function detectInitialLanguage() {
    const saved = localStorage.getItem("lang");
    if (saved) return saved;

    try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            const balkanCountries = ['RS', 'BA', 'HR', 'ME', 'MK'];
            if (balkanCountries.includes(data.country_code)) {
                return 'sr';
            }
        }
    } catch {
        // Fallback na jezik browsera
    }

    return navigator.language?.startsWith("sr") ? "sr" : "en";
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ucitaj azuriranja
    try {
        const response = await fetch('/updates.json');
        if (response.ok) {
            updateData = await response.json();
        }
    } catch (error) {
        console.warn('Greska pri ucitavanju azuriranja:', error);
    }

    // 2. Primeni jezik
    const langToUse = await detectInitialLanguage();
    await applyLanguage(langToUse);

    // 3. Prikaz najnovije verzije
    const latestVersionLink = document.querySelector('[data-latest-version]');
    if (latestVersionLink && Array.isArray(updateData) && updateData.length) {
        const latestUpdate = updateData.find(item => item.aktivno) || updateData[0];
        const normalizedVersion = String(latestUpdate.verzija).replace(/^v/i, '');
        latestVersionLink.textContent = `v${normalizedVersion}`;
        latestVersionLink.setAttribute('aria-label', `Verzija v${normalizedVersion}`);
    }

    // 4. Delegate klikove za data-ga-event
    document.addEventListener('click', (e) => {
        const trackable = e.target.closest('[data-ga-event]');
        if (trackable) {
            const eventName = trackable.getAttribute('data-ga-event');
            const location = trackable.getAttribute('data-ga-location');
            trackEvent(eventName, location ? { location } : {});
        }
    });

    // 5. Dugme za promenu jezika
    document.addEventListener('click', (e) => {
        const langBtn = e.target.closest('#lang-switch, [data-lang-switch]') || (e.target.closest('button')?.querySelector('#lang-text') ? e.target.closest('button') : null);
        if (langBtn) {
            e.preventDefault();
            toggleLanguage();
        }
    });

    const closeUpdateBtn = document.getElementById('closeUpdateBtn');
    if (closeUpdateBtn) {
        closeUpdateBtn.addEventListener('click', () => window.close());
    }

    // 6. Scroll Progress & Back to Top
    const backToTop = document.getElementById('backToTop');
    const progressRing = document.getElementById('progressRing');

    if (progressRing && backToTop) {
        const radius = progressRing.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;

        progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        progressRing.style.strokeDashoffset = circumference;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) : 0;

            progressRing.style.strokeDashoffset = circumference - (scrollPercent * circumference);

            if (scrollTop > 400) {
                backToTop.classList.remove('opacity-0', 'pointer-events-none');
                backToTop.classList.add('opacity-100', 'pointer-events-auto');
            } else {
                backToTop.classList.add('opacity-0', 'pointer-events-none');
                backToTop.classList.remove('opacity-100', 'pointer-events-auto');
            }
        }, { passive: true });

        backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // 7. GSAP Animacije (komandni centar & timeline)
    const cards = gsap.utils.toArray('.card');
    if (cards.length > 0 && document.getElementById('komandni-centar')) {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: "#komandni-centar",
                start: "top top",
                end: "+=3000",
                pin: true,
                scrub: 1.5,
                pinSpacing: true
            }
        });

        cards.forEach((card, index) => {
            if (index === 0) {
                tl.to(card, { scale: 0.95, opacity: 0.8, duration: 1 }, 0.5);
                return;
            }
            tl.to(card, { y: 0, ease: "power2.out", duration: 1.5 }, (index - 0.5) * 1.2);
            if (index < cards.length - 1) {
                tl.to(card, { scale: 0.95, opacity: 0.8, duration: 1 }, index * 1.2 + 0.5);
            }
        });
    }

    // Elitni radnik (Floating items)
    const floatingItems = gsap.utils.toArray('.floating-item');
    if (floatingItems.length > 0 && document.getElementById('target-audience')) {
        floatingItems.forEach((item, i) => {
            gsap.to(item, {
                y: "-=20",
                x: i % 2 === 0 ? "+=10" : "-=10",
                duration: 2 + i,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });
            gsap.to(item, {
                scrollTrigger: {
                    trigger: "#target-audience",
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 2
                },
                y: i % 2 === 0 ? -100 : 100,
                rotation: i % 2 === 0 ? 10 : -10,
                ease: "none"
            });
        });

        if (document.getElementById('nucleus')) {
            gsap.to('#nucleus', {
                scrollTrigger: {
                    trigger: "#target-audience",
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1
                },
                rotation: 360,
                scale: 1.2,
                ease: "none"
            });
        }
    }

    // Timeline koraci
    const steps = gsap.utils.toArray('.timeline-item');
    if (steps.length > 0 && document.getElementById('workflow-timeline')) {
        steps.forEach((step) => {
            const number = step.querySelector('.step-number');
            gsap.from(step, {
                scrollTrigger: {
                    trigger: step,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                },
                y: 50,
                opacity: 0,
                duration: 1,
                ease: "power3.out"
            });

            if (number) {
                gsap.to(number, {
                    scrollTrigger: {
                        trigger: step,
                        start: "top 60%",
                        toggleActions: "play none none reverse"
                    },
                    color: "#00ff88",
                    opacity: 0.15,
                    scale: 1.1,
                    duration: 0.8
                });
            }
        });
    }

    // 8. Feedback Forma (Uninstall stranica)
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const btn = document.getElementById('btnTekst');
            if (btn) {
                btn.innerText = window.currentTranslations['uni_btn_sending'] || 'Slanje...';
                btn.disabled = true;
            }

            fetch("https://formsubmit.co/ajax/contact@milanwebportal.com", {
                method: "POST",
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(this).entries()))
            })
            .then(response => {
                if (response.ok) {
                    trackEvent('website_feedback', { status: 'success' });
                    document.getElementById('formSection')?.classList.add('hidden');
                    document.getElementById('hvalaPoruka')?.classList.remove('hidden');
                } else throw new Error();
            })
            .catch(() => {
                alert(window.currentTranslations['uni_alert_error'] || 'Greska pri slanju.');
                if (btn) {
                    btn.innerText = window.currentTranslations['uni_form_btn'] || 'Posalji';
                    btn.disabled = false;
                }
            });
        });
    }

    // Inicijalno iscrtavanje Lucide ikonica
    renderLucideIcons();
});
