import { trackEvent, escapeHtml, getI18nMsg, currentLang, tab, switchView, showToast } from './popup-core.js';

let clearModal = null;
let noteArea = null;
let saveIndicator = null;
const MAX_NOTES_CHARS = 1000000;
let saveTimeout;
let notesSaveQueue = Promise.resolve();
const notesTrustedTypesPolicy = window.trustedTypes?.createPolicy
    ? window.trustedTypes.createPolicy("aio-notes-html", {
        createHTML: (html) => sanitizeNotesHtml(html)
    })
    : null;

function getSafeHttpUrl(rawUrl = "") {
    try {
        const u = new URL(rawUrl);
        return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
    } catch {
        return null;
    }
}

/**
 * Sanitizes persisted/imported note HTML to a small, predictable formatting set.
 * @param {string} rawHtml
 * @returns {string}
 */
function sanitizeNotesHtml(rawHtml = "") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    const allowedTags = new Set(["B", "I", "A", "BR", "DIV", "SPAN", "UL", "OL", "LI", "P"]);

    const sanitizeNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.textContent || "");
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return document.createTextNode("");
        }

        const tag = node.tagName.toUpperCase();
        if (!allowedTags.has(tag)) {
            return document.createTextNode(node.textContent || "");
        }

        const clean = document.createElement(tag);

        if (tag === "A") {
            const href = node.getAttribute("href") || "";
            if (href.startsWith("https://") || href.startsWith("http://")) {
                clean.setAttribute("href", href);
                clean.setAttribute("target", "_blank");
                clean.setAttribute("rel", "noopener noreferrer");
            }
        }

        if (tag === "B" || tag === "SPAN") {
            const style = node.getAttribute("style");
            if (style && (style.includes("color: var(--accent)") || style.includes("color:var(--accent)"))) {
                clean.setAttribute("style", "color: var(--accent);");
            }
        }

        Array.from(node.childNodes).forEach((child) => {
            clean.appendChild(sanitizeNode(child));
        });

        return clean;
    };

    const root = document.createElement("div");
    Array.from(doc.body.childNodes).forEach((child) => {
        root.appendChild(sanitizeNode(child));
    });

    return root.innerHTML;
}

function setNoteAreaHtml(rawHtml = "") {
    if (!noteArea) return;
    const safeHtml = sanitizeNotesHtml(rawHtml);
    noteArea.innerHTML = notesTrustedTypesPolicy
        ? notesTrustedTypesPolicy.createHTML(safeHtml)
        : safeHtml;
}

function persistNotesHtml(safeHtml) {
    notesSaveQueue = notesSaveQueue.then(async () => {
        await chrome.storage.local.set({ "mojeBeleske": safeHtml });
    }).catch((err) => {
        // Silent fail
    });
    return notesSaveQueue;
}

function getUtf8ByteLength(value) {
    try {
        return new TextEncoder().encode(String(value || "")).length;
    } catch {
        return unescape(encodeURIComponent(String(value || ""))).length;
    }
}

function showSaveIndicator(text = getI18nMsg("notesSaved", "Sačuvano"), isError = false) {
    if (!saveIndicator) return;
    saveIndicator.textContent = text;
    saveIndicator.style.color = isError ? "#ff7a7a" : "var(--accent)";
    saveIndicator.style.opacity = "1";
    const hideIndicator = () => {
        saveIndicator.style.opacity = "0";
        if (isError) {
            saveIndicator.textContent = getI18nMsg("notesSaved", "Sačuvano");
            saveIndicator.style.color = "var(--accent)";
        }
    };
    let rafId = null;
    setTimeout(() => {
        rafId = requestAnimationFrame(hideIndicator);
    }, 1200);
}

function saveNotes(immediate = false) {
    if (!noteArea) return;
    const commit = () => {
        const safeHtml = sanitizeNotesHtml(noteArea.innerHTML || "");
        if (noteArea.innerHTML !== safeHtml) {
            setNoteAreaHtml(safeHtml);
        }
        if (safeHtml.length > MAX_NOTES_CHARS) {
            showSaveIndicator(getI18nMsg("notesTooLarge", "Prevelika beleška"), true);
            return;
        }
        persistNotesHtml(safeHtml);
        showSaveIndicator();
    };
    clearTimeout(saveTimeout);
    if (immediate) {
        commit();
        return;
    }
    saveTimeout = setTimeout(commit, 300);
}

function getSafeRange(container) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!container || !container.contains(range.commonAncestorContainer)) return null;
    return range;
}

function moveCaretAfter(node) {
    if (!node) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

function insertFragmentAtCursor(container, fragment, lastNode) {
    if (!container) return;
    container.focus();
    const range = getSafeRange(container) || (() => {
        const r = document.createRange();
        r.selectNodeContents(container);
        r.collapse(false);
        return r;
    })();

    range.deleteContents();
    range.insertNode(fragment);
    moveCaretAfter(lastNode || container.lastChild);
}

function insertHtmlAtCursor(container, html) {
    const safeHtml = sanitizeNotesHtml(html);
    const temp = document.createElement("div");
    temp.innerHTML = safeHtml;
    const fragment = document.createDocumentFragment();
    let lastNode = null;
    while (temp.firstChild) {
        lastNode = temp.firstChild;
        fragment.appendChild(temp.firstChild);
    }
    insertFragmentAtCursor(container, fragment, lastNode);
}

function insertTextAtCursor(container, text) {
    const safeText = String(text || "");
    const textNode = document.createTextNode(safeText);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(textNode);
    insertFragmentAtCursor(container, fragment, textNode);
}

function appendToNotes(content, isHTML = false) {
    if (!noteArea) return;
    if (isHTML) {
        insertHtmlAtCursor(noteArea, content);
    } else {
        insertTextAtCursor(noteArea, content + " ");
    }
    saveNotes();
}

function updateNotesCount() {
    if (!noteArea) return;
    const indicator = document.getElementById("saveIndicator");
    if (indicator) {
        const savedText = getI18nMsg("savedIndicator", "Sačuvano");
        indicator.textContent = savedText;
    }
}

let selectionMarkerId = 0;

function saveSelection(container) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!container || !container.contains(range.commonAncestorContainer)) return null;

    const id = `aio-sel-${selectionMarkerId++}`;
    const start = document.createElement("span");
    const end = document.createElement("span");
    start.id = `${id}-start`;
    end.id = `${id}-end`;
    start.style.display = "none";
    end.style.display = "none";

    const collapsed = range.collapsed;
    range.insertNode(end);
    range.insertNode(start);

    if (collapsed) {
        end.remove();
    }

    sel.removeAllRanges();
    return { id, collapsed };
}

function restoreSelection(container, marker) {
    if (!marker || !container) return;
    const start = document.getElementById(`${marker.id}-start`);
    const end = marker.collapsed ? null : document.getElementById(`${marker.id}-end`);
    if (!start) return;

    const range = document.createRange();
    if (end) {
        range.setStartAfter(start);
        range.setEndBefore(end);
    } else {
        range.setStartAfter(start);
        range.collapse(true);
    }

    start.remove();
    if (end) end.remove();

    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
}

function applyCalculatorInTextNodes(container, regex) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    let replaced = false;
    nodes.forEach((textNode) => {
        const text = textNode.nodeValue || "";
        if (!regex.test(text)) return;
        regex.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        text.replace(regex, (match, a, op, b, offset) => {
            const prefix = text.slice(lastIndex, offset);
            if (prefix) frag.appendChild(document.createTextNode(prefix));

            const n1 = parseFloat(a);
            const n2 = parseFloat(b);
            let r = 0;
            if (op === '+') r = n1 + n2;
            else if (op === '-') r = n1 - n2;
            else if (op === '*') r = n1 * n2;
            else if (op === '/') r = n2 !== 0 ? n1 / n2 : 0;
            r = Math.round(r * 100) / 100;

            frag.appendChild(document.createTextNode(match + " "));
            const bold = document.createElement("b");
            bold.style.color = "var(--accent)";
            bold.textContent = String(r);
            frag.appendChild(bold);
            frag.appendChild(document.createTextNode(" "));

            lastIndex = offset + match.length;
            replaced = true;
            return match;
        });

        const suffix = text.slice(lastIndex);
        if (suffix) frag.appendChild(document.createTextNode(suffix));
        textNode.parentNode.replaceChild(frag, textNode);
    });

    return replaced;
}

export function initNotes() {
    clearModal = document.getElementById("clearNotesModal");
    noteArea = document.getElementById("noteArea");
    saveIndicator = document.getElementById("saveIndicator");

    if (!noteArea) return;

    // Učitavanje beleški
    chrome.storage.local.get("mojeBeleske", (res) => {
        if (res.mojeBeleske) {
            const safeHtml = sanitizeNotesHtml(res.mojeBeleske);
            setNoteAreaHtml(safeHtml);
            if (safeHtml !== res.mojeBeleske) {
                chrome.storage.local.set({ "mojeBeleske": safeHtml });
            }
        }
    });

    // Navigacija
    document.getElementById("notesBtn")?.addEventListener("click", () => {
        trackEvent("smart_notes_click");
        switchView("mainView", "notesView");
        updateNotesCount();
    });

    document.getElementById("backBtn")?.addEventListener("click", () => {
        trackEvent("notes_back");
        saveNotes(true);
        switchView("notesView", "mainView", true);
    });

    // Modal logika za brisanje
    document.getElementById("notesClearBtn")?.addEventListener("click", () => {
        trackEvent("notes_clear_opened");
        if (clearModal) clearModal.classList.remove("hidden");
    });

    document.getElementById("cancelClearNotes")?.addEventListener("click", () => {
        trackEvent("notes_clear_cancelled");
        if (clearModal) clearModal.classList.add("hidden");
    });

    document.getElementById("confirmClearNotes")?.addEventListener("click", () => {
        trackEvent("notes_cleared");
        clearTimeout(saveTimeout);
        setNoteAreaHtml("");
        persistNotesHtml("");
        updateNotesCount();
        if (clearModal) clearModal.classList.add("hidden");
        showToast(getI18nMsg("toastNotesCleared", "Sve beleške su obrisane!"), "success");
    });

    noteArea.addEventListener("input", () => {
        const calcRegex = /(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*=(?!\s*<b)/g;
        if (calcRegex.test(noteArea.innerText)) {
            calcRegex.lastIndex = 0;
            const marker = saveSelection(noteArea);
            applyCalculatorInTextNodes(noteArea, calcRegex);
            restoreSelection(noteArea, marker);
        }
        updateNotesCount();
        saveNotes();
    });

    noteArea.addEventListener("blur", () => {
        saveNotes(true);
    });

    // Čist paste
    noteArea.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text/plain");
        const currentLength = (noteArea.innerHTML || "").length;
        const incomingLength = text.length;
        if (currentLength + incomingLength > MAX_NOTES_CHARS) {
            showSaveIndicator(getI18nMsg("notesTooLarge", "Prevelika beleška"), true);
            return;
        }
        insertTextAtCursor(noteArea, text);
    });

    // Otvaranje linkova
    noteArea.addEventListener("click", (e) => {
        if (e.target.tagName === "A") {
            e.preventDefault();
            const safeHref = getSafeHttpUrl(e.target.href || "");
            if (safeHref) chrome.tabs.create({ url: safeHref });
        }
    });

    // Akciona dugmad (Grab Text, URL, Date)
    document.getElementById("grabTextBtn")?.addEventListener("click", async () => {
        trackEvent("notes_grab_text");
        try {
            if (!tab?.url || !tab.url.startsWith("http")) return;
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString()
            }, (res) => {
                if (res?.[0]?.result) {
                    appendToNotes(`<i>"${escapeHtml(res[0].result.trim())}"</i>`, true);
                }
            });
        } catch (err) {
            // Silent fail
        }
    });

    document.getElementById("addUrlBtn")?.addEventListener("click", async () => {
        trackEvent("notes_add_url");
        try {
            if (tab) {
                const safeHref = getSafeHttpUrl(tab.url || "");
                const safeTitle = escapeHtml(tab.title || safeHref || getI18nMsg("notesLinkText", "Link"));
                if (safeHref) appendToNotes(`<a href="${safeHref}">${safeTitle}</a>`, true);
            }
        } catch (err) {
            // Silent fail
        }
    });

    document.getElementById("addDateBtn")?.addEventListener("click", () => {
        trackEvent("notes_add_date");
        const now = new Date();
        const str = `${now.toLocaleDateString(currentLang)} ${now.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}`;
        appendToNotes(`<b>${str}</b>`, true);
    });

    // EXPORT i IMPORT
    document.getElementById("exportNotesBtn")?.addEventListener("click", () => {
        trackEvent("notes_export");
        const blob = new Blob([noteArea.innerHTML], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `beleske_backup.html`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(getI18nMsg("toastNotesExported", "Beleške uspešno izvezene!"), "success");
    });

    document.getElementById("importNotesBtn")?.addEventListener("click", () => {
        trackEvent("notes_import_open");
        document.getElementById("importFileInput")?.click();
    });

    document.getElementById("importFileInput")?.addEventListener("change", (e) => {
        trackEvent("notes_import_confirm");
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            showToast(getI18nMsg("notesTooLarge", "Prevelika beleška"), "error");
            e.target.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = String(event.target.result || "");
                if (content.length > MAX_NOTES_CHARS) {
                    showToast(getI18nMsg("notesTooLarge", "Prevelika beleška"), "error");
                    e.target.value = "";
                    return;
                }
                setNoteAreaHtml(content);
                saveNotes();
                showToast(getI18nMsg("toastNotesImported", "Beleške uspešno uvezene!"), "success");
            } catch (err) {
                showToast(getI18nMsg("toastNotesImportError", "Greška pri uvozu beleški!"), "error");
            }
            e.target.value = "";
        };
        reader.onerror = () => {
            showToast(getI18nMsg("toastNotesImportError", "Greška pri uvozu beleški!"), "error");
        };
        reader.readAsText(file);
    });

    const notesCopyBtn = document.getElementById("notesCopyBtn");
    if (notesCopyBtn) {
        const copyIcon = notesCopyBtn.innerHTML;
        const successIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00ff88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        notesCopyBtn.addEventListener("click", () => {
            const text = noteArea?.innerText || "";
            if (!text) return;

            navigator.clipboard.writeText(text).then(() => {
                trackEvent("notes_text_copy");
                notesCopyBtn.innerHTML = successIcon;
                showToast(getI18nMsg("toastNotesCopied", "Tekst je kopiran u klipbord!"), "success");

                setTimeout(() => {
                    notesCopyBtn.innerHTML = copyIcon;
                }, 1500);
            }).catch(() => { });
        });
    }
}
