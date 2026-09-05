# Extension

This directory contains the Chrome/Chromium browser extension (Manifest V3) for the **All In One** project.

## Structure of the `js/` Directory

| File                 | Role                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `popup-core.js`      | Central popup initializer: i18n, dark mode, volume, toast notifications, keyboard navigation |
| `popup.js`           | Main entry point — imports all modules and initializes components                            |
| `popup-settings.js`  | Settings panel — language selection, theme switcher, data export                             |
| `popup-notes.js`     | Notepad (rich-text markdown-ready editor)                                                    |
| `popup-counter.js`   | Interactive click counter                                                                    |
| `popup-radio.js`     | Radio IN — live audio streaming engine                                                       |
| `popup-stopwatch.js` | Precision stopwatch with session history and Kick.com integration                            |
| `popup-tracker.js`   | Project and task progress tracker                                                            |
| `popup-tech.js`      | Technology detector — DOM inspection + network stack analysis                                |
| `background.js`      | Service Worker — message bus, GA analytics tracking, clear-site-data, alarms                 |
| `content.js`         | Content script — dark mode injection, screen ruler, font finder, copy unlock                 |
| `marker_engine.js`   | Page marker / highlighter engine (injected on-demand)                                        |
| `offscreen.js`       | Offscreen document dedicated to audio playback (radio)                                       |
| `yt.js`              | YouTube content script — return YouTube dislike integration                                  |

## Running Tests

```bash
cd Extension
npm test
```

Tests run via the native Node.js test runner (`node:test`) — zero extra dependencies required.

## Linting

```bash
npm run lint          # Run ESLint validation
npm run lint:fix      # Automatically fix ESLint issues
```

## Syntax Check

Quick syntax validation across all JavaScript files without running the full linter:

```bash
npm run check:js
```

## Test Suite Structure

```
tests/
  mock-env.mjs              # createMockEnvironment — low-level DOM / Chrome API mock
  helpers/mock-env.mjs      # createExtensionTestEnv — dual-window simulation (popup + active tab)
  extension-smoke.test.mjs  # Manifest / package sync, locale integrity check
  runtime-behavior.test.mjs # Integration: core, radio, tech detector, stopwatch
  popup-core.test.mjs       # Unit: escapeHtml, getI18nMsg, switchView, showToast, initCore
  popup-counter.test.mjs    # Unit: click counter logic
  popup-notes.test.mjs      # Unit: notepad storage & actions
  popup-radio.test.mjs      # Unit: radio stream management
  popup-stopwatch.test.mjs  # Unit: start/stop/lap/history/formatting
  popup-tech.test.mjs       # Unit: tech detector engine, icon mappings
  popup-tracker.test.mjs    # Unit: project tracking logic
  translations.test.mjs     # Unit: locale key and completeness checks
  background-logic.test.mjs # Unit: background worker message handlers
  content-logic.test.mjs    # Unit: content script helper algorithms
  popup-js-smoke.test.mjs   # Smoke: popup.js wiring & popup-settings.js state handling
```

## Versioning

The version number must remain identical across `manifest.json` and `package.json`.
The CI test `"manifest and package metadata stay aligned"` automatically verifies this on every push.

---

## ☕ Author & Support

Crafted by **Milan Petkovski** &bull; [Milan Web Portal](https://milanwebportal.com)  
💖 [Support my work via PayPal](https://paypal.me/milanwebportal)
