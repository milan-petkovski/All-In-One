# Extension

Ovaj folder sadrzi Chrome/Chromium ekstenziju (Manifest V3) za **All In One** projekat.

## Struktura `js/` foldera

| Fajl | Uloga |
|------|-------|
| `popup-core.js` | Centralni inicijalizator popupa: i18n, dark mode, volume, toast, keyboard nav |
| `popup.js` | Entry point — importuje sve module, inicijalizuje |
| `popup-settings.js` | Panel sa podesavanjima — jezici, tema, eksport |
| `popup-notes.js` | Beleznik (rich-text editor) |
| `popup-counter.js` | Brojac klikova |
| `popup-radio.js` | Radio IN — streaming audio |
| `popup-stopwatch.js` | Stopwatch sa istorijom sesija i Kick.com integracijom |
| `popup-tracker.js` | Tracker projekata i zadataka |
| `popup-tech.js` | Skener tehnologija — DOM inspekcija + mreza |
| `background.js` | Service Worker — poruke, GA tracking, clear-site-data, alarmi |
| `content.js` | Content script — dark mode, ruler, font finder, copy unlock |
| `marker_engine.js` | Page marker/highlighter (injektuje se po potrebi) |
| `offscreen.js` | Offscreen document za audio (radio) |
| `yt.js` | YouTube content script — dislike prikaz |

## Pokretanje testova

```bash
cd Extension
npm test
```

Testovi koriste Node.js built-in test runner (`node:test`) — nema potrebe za instalacijom.

## Lint

```bash
npm run lint          # ESLint provera
npm run lint:fix      # ESLint auto-fix
```

## Syntax check

Brza provera ispravnosti svih JS fajlova bez lintinga:

```bash
npm run check:js
```

## Struktura testova

```
tests/
  mock-env.mjs              # createMockEnvironment — niska DOM/Chrome simulacija
  helpers/mock-env.mjs      # createExtensionTestEnv — dva-prozorska simulacija (popup + page)
  extension-smoke.test.mjs  # Manifest/package sinhronizacija, locale provjera
  runtime-behavior.test.mjs # Integracija: core, radio, tech, stopwatch
  popup-core.test.mjs       # Unit: escapeHtml, getI18nMsg, switchView, showToast, initCore
  popup-counter.test.mjs    # Unit: brojac
  popup-notes.test.mjs      # Unit: beleznik
  popup-radio.test.mjs      # Unit: radio
  popup-stopwatch.test.mjs  # Unit: start/stop/lap/history/format
  popup-tech.test.mjs       # Unit: tech scanner, icon map
  popup-tracker.test.mjs    # Unit: tracker projekata
  translations.test.mjs     # Unit: locale provjera
  background-logic.test.mjs # Unit: background message handlers
  content-logic.test.mjs    # Unit: content script helper logika
  popup-js-smoke.test.mjs   # Smoke: popup.js wiring i popup-settings.js logika
```

## Verzija

Verzija mora biti ista u `manifest.json` i `package.json`.
CI test `"manifest and package metadata stay aligned"` automatski proverava ovo na svakom push-u.
