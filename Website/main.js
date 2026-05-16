import { updateData } from './updates.js';
import { trackEvent, trackWebVitals } from './js/analytics.js';

// Initialize Analytics & Performance Monitoring
trackWebVitals();
trackEvent('session_start', { 
    platform: 'web',
    version: '2026.1.5',
    resolution: `${window.innerWidth}x${window.innerHeight}`
});

// Expose functions to window for HTML event handlers (onclick)
window.toggleLanguage = toggleLanguage;
window.applyLanguage = applyLanguage;

// Globalni objekat za prevode
window.currentTranslations = {};

/**
 * Primenjuje izabrani jezik na celu stranicu
 */
async function applyLanguage(lang) {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang === 'sr' ? 'sr_RS' : 'en';

    try {
        const response = await fetch(`/${lang}.json`);
        if (!response.ok) throw new Error("Neuspešno učitavanje JSON-a");
        
        const translations = await response.json();
        window.currentTranslations = translations;

        // Osnovni prevodi elemenata (tekst unutar tagova)
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

        // Update teksta na toggle dugmetu (prikazuje suprotan jezik od trenutnog)
        const langText = document.getElementById("lang-text");
        if (langText) {
            langText.textContent = lang === "sr" ? "EN" : "SR";
        }

        // Lokalizacija datuma
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const locale = lang === 'sr' ? 'sr-Latn-RS' : 'en-US';
        const danas = new Date().toLocaleString(locale, options);
        document.querySelectorAll('.trenutni-datum').forEach(el => {
            el.textContent = danas;
        });

        // Ako postoji kontejner za ažuriranja, ponovo ga iscrtaj
        if (document.getElementById('update-container')) {
            renderUpdates(lang);
        }

        // Ponovna inicijalizacija Lucide ikonica (obavezno jer innerHTML briše SVG)
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Javljamo ostalim skriptama da je jezik učitan
        window.dispatchEvent(new CustomEvent('languageLoaded', { detail: lang }));

    } catch (error) {
        console.error('Greška pri učitavanju prevoda:', error);
    }
}

/**
 * Menja jezik između SR i EN (Toggle)
 */
function toggleLanguage() {
    const currentLang = localStorage.getItem("lang") || "en";
    const newLang = currentLang === "sr" ? "en" : "sr";
    trackEvent('language_change', { from: currentLang, to: newLang });
    applyLanguage(newLang);
}

/**
 * Dinamičko iscrtavanje liste ažuriranja
 */
function renderUpdates(lang) {
    const container = document.getElementById('update-container');
    if (!container || typeof updateData === 'undefined') return;

    container.innerHTML = '';
    let prosaoAktivni = false;
    
    updateData.forEach((item) => {
        const isAktivno = item.aktivno === true;
        if (isAktivno) prosaoAktivni = true;

        const isIspod = !isAktivno && prosaoAktivni;
        const card = document.createElement('div');
        card.className = `relative flex flex-col md:flex-row items-center mb-24 ${isIspod ? "group opacity-60 hover:opacity-100 transition-all duration-500" : "group"}`;

        // Kreiramo tacku na vremenskoj liniji
        const dot = document.createElement('div');
        dot.className = `absolute left-6 md:left-1/2 w-6 h-6 rounded-full -translate-x-1/2 z-20 ${isAktivno ? 'bg-darkpanel border-4 border-brand shadow-[0_0_20px_#00ff88]' : 'bg-gray-200 border-4 border-white'}`;
        card.appendChild(dot);

        // Leva strana (Verzija i Datum)
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
        const versionH3 = document.createElement('h3');
        versionH3.className = "text-6xl md:text-7xl font-black text-darkpanel tracking-tighter leading-none transition-transform duration-500 group-hover:scale-105 md:origin-right origin-left";
        
        const vSpan = document.createElement('span');
        vSpan.className = "text-gray-300 text-4xl md:text-5xl mr-1 font-bold";
        vSpan.textContent = 'v';
        versionH3.appendChild(vSpan);
        versionH3.appendChild(document.createTextNode(item.verzija));
        versionWrapper.appendChild(versionH3);
        leftSide.appendChild(versionWrapper);

        const dateWrapper = document.createElement('div');
        dateWrapper.className = "flex items-center gap-4 mt-4 opacity-60 group-hover:opacity-100 transition-opacity duration-500";
        const line = document.createElement('div');
        line.className = "h-px w-12 bg-gradient-to-r from-transparent to-gray-400 hidden md:block";
        const dateP = document.createElement('p');
        dateP.className = "text-gray-500 font-extrabold text-[11px] uppercase tracking-[0.3em]";
        dateP.textContent = item[lang].datum;
        dateWrapper.append(line, dateP);
        leftSide.appendChild(dateWrapper);

        card.appendChild(leftSide);

        // Desna strana (Kartica sa opisom)
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
        iconI.className = `w-5 h-5 ${isAktivno ? 'text-brand' : 'text-gray-500'}`;
        iconWrap.appendChild(iconI);
        
        const titleWrap = document.createElement('div');
        const h4 = document.createElement('h4');
        h4.className = "text-white font-black text-lg uppercase tracking-tight italic leading-tight";
        h4.textContent = item[lang].naslov;
        const subP = document.createElement('p');
        subP.className = "text-brand text-[9px] font-black uppercase tracking-widest opacity-80";
        subP.textContent = window.currentTranslations['upd_dyn_stable'] || 'Stable Release';
        titleWrap.append(h4, subP);
        header.append(iconWrap, titleWrap);
        innerContent.appendChild(header);

        const descBox = document.createElement('div');
        descBox.className = "bg-white/5 rounded-[1.5rem] p-5 border border-white/5 shadow-inner";
        const descP = document.createElement('p');
        descP.className = "text-gray-300 leading-relaxed font-medium text-[14px]";
        descP.textContent = item[lang].opis;
        descBox.appendChild(descP);
        innerContent.appendChild(descBox);

        const footer = document.createElement('div');
        footer.className = "mt-6 flex items-center justify-between";
        const footLeft = document.createElement('div');
        footLeft.className = "flex items-center gap-2 text-gray-500";
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * PAMETNA DETEKCIJA POČETNOG JEZIKA
 */
async function detectInitialLanguage() {
    // 1. Proveri da li korisnik već ima sačuvan izbor u browseru
    const saved = localStorage.getItem("lang");
    if (saved) return saved;

    // 2. Proveri državu preko IP adrese
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            const country = data.country_code;

            // Lista EX-YU država za koje forsiramo srpski/regionalni prevod
            const balkanCountries = ['RS', 'BA', 'HR', 'ME', 'MK']; 
            
            if (balkanCountries.includes(country)) {
                return 'sr';
            }
        }
    } catch (e) {
        console.warn("IP detekcija nije dostupna, prelazim na podešavanja browsera.");
    }

    // 3. Zadnja opcija: Jezik browsera (ako je browser na srpskom, stavi srpski, inače engleski)
    return navigator.language.startsWith("sr") ? "sr" : "en";
}

/**
 * GLAVNA INICIJALIZACIJA
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Odredi jezik i primeni ga
    const langToUse = await detectInitialLanguage();
    applyLanguage(langToUse);

    // Inicijalizuj ikonice
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Verzija u navigaciji
    const latestVersionLink = document.querySelector('[data-latest-version]');
    if (latestVersionLink && typeof updateData !== 'undefined' && updateData.length) {
        const latestUpdate = updateData.find(item => item.aktivno) || updateData[0];
        const normalizedVersion = String(latestUpdate.verzija).replace(/^v/i, '');
        latestVersionLink.textContent = `v${normalizedVersion}`;
    }

    // Detekcija mobilnih uređaja
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const mobileBlocker = document.getElementById('mobile-blocker');
    if (isMobile && mobileBlocker) {
        mobileBlocker.classList.remove('hidden');
        mobileBlocker.classList.add('flex');
    }

    // Scroll Progress & Back to Top
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
        });

        backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // GSAP Animacije (ako su biblioteke učitane)
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Komandni centar (Pinned cards stacking)
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
                    // Prva karta lagano nestaje/skalira se kad druga dolazi
                    tl.to(card, { scale: 0.95, opacity: 0.8, duration: 1 }, 0.5);
                    return;
                }
                
                // Ostale karte dolaze odozdo
                tl.to(card, { 
                    y: 0, 
                    ease: "power2.out", 
                    duration: 1.5 
                }, (index - 0.5) * 1.2);

                if (index < cards.length - 1) {
                    // Karta koja je trenutno tu se blago povlači nazad
                    tl.to(card, { scale: 0.95, opacity: 0.8, duration: 1 }, index * 1.2 + 0.5);
                }
            });
        }

        // Elitni radnik (Floating items parallax & move)
        const floatingItems = gsap.utils.toArray('.floating-item');
        if (floatingItems.length > 0 && document.getElementById('target-audience')) {
            floatingItems.forEach((item, i) => {
                // Početna nasumična pozicija za lebdenje
                gsap.to(item, {
                    y: "-=20",
                    x: i % 2 === 0 ? "+=10" : "-=10",
                    duration: 2 + i,
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut"
                });

                // Scroll animacija - parallax efekat
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

            // Nucleus spin
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

        // Tri koraka do produktivnosti (Timeline steps)
        const steps = gsap.utils.toArray('.timeline-item');
        if (steps.length > 0 && document.getElementById('workflow-timeline')) {
            steps.forEach((step, i) => {
                const number = step.querySelector('.step-number');
                const icon = step.querySelector('.inline-flex');

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
                        color: "#00ff88", // Menja se u brand boju kad je u fokusu
                        opacity: 0.15,
                        scale: 1.1,
                        duration: 0.8
                    });
                }
            });
        }
    }

    // Feedback Forma (Uninstall stranica)
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
                    trackEvent('feedback_submitted', { status: 'success' });
                    document.getElementById('formSection')?.classList.add('hidden');
                    document.getElementById('hvalaPoruka')?.classList.remove('hidden');
                } else throw new Error();
            })
            .catch(() => {
                alert(window.currentTranslations['uni_alert_error'] || 'Greška.');
                if (btn) {
                    btn.innerText = window.currentTranslations['uni_form_btn'] || 'Pošalji';
                    btn.disabled = false;
                }
            });
        });
    }
});