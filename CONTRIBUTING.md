# Contributing to All In One Extension

Thank you for your interest in contributing to **All In One Extension**! This document provides guidelines and best practices to ensure smooth collaboration, high code quality, and peak performance across our Chrome extension and web platform.

---

## Code of Conduct

We are dedicated to providing a friendly, respectful, and inclusive environment. Please treat all contributors, users, and community members with courtesy.

---

## Architecture Overview

All In One is structured into two primary components:

```
All In One/
├── Extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Extension manifest configuration
│   ├── popup.html & popup.js   # Extension popup interface and router
│   ├── js/                     # Modular background, content, and utility scripts
│   ├── css/                    # Popup and injected tool styles
│   ├── _locales/               # 55 localized translation bundles
│   └── tests/                  # Unit test suites (109 tests)
├── Website/                    # Official Web Platform & Edge Services
│   ├── index.html              # Marketing presentation and download landing
│   ├── netlify/functions/      # Serverless edge telemetry & health handlers
│   ├── src/ & public/          # Assets, styling, and client modules
│   └── tests/                  # Automated integration tests
└── README.md                   # Primary project documentation
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` LTS
- **npm**: `v10.x` or newer
- **Browser**: Any Chromium-based browser (Chrome, Edge, Brave, Opera, Arc)

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/milan-petkovski/All-In-One.git
   cd All-In-One
   ```

2. **Install dependencies**:
   ```bash
   npm --prefix Extension install
   npm --prefix Website install
   ```

3. **Load Extension in Developer Mode**:
   - Open your browser and navigate to `chrome://extensions/`
   - Enable **Developer mode** in the top right corner
   - Click **Load unpacked** and select the `Extension` directory

---

## Verification & Quality Commands

Always run verification commands before submitting changes:

| Scope | Command | Purpose |
| :--- | :--- | :--- |
| **Extension Tests** | `npm --prefix Extension test` | Runs the 109 automated unit tests |
| **Extension Lint** | `npm --prefix Extension run lint` | ESLint static code analysis |
| **Syntax Validation** | `npm --prefix Extension run check:js` | Node syntax checks on all JS modules |
| **Website Tests** | `npm --prefix Website test` | Runs automated Netlify function and API tests |
| **Website Build** | `npm --prefix Website run build` | Produces production Vite distribution |
| **Security Audit** | `npm --prefix Extension audit` | Verifies 0 vulnerabilities |

---

## Engineering Standards

- **Manifest V3 Compliance**: Adhere strictly to Chrome Web Store Manifest V3 guidelines.
- **Internationalization (i18n)**: All 55 locale files in `Extension/_locales/` must maintain 100% key parity with English master strings and use clean UTF-8 encoding without BOM.
- **No External CDN Dependencies**: Extension popup and content scripts must remain completely self-contained with zero runtime dependencies.
- **Zero Mojibake**: Ensure special characters and accented letters are strictly preserved across all translation bundles.

---

## Conventional Commits

We follow clean declarative commit conventions:

- `feat:` A new tool, feature, or locale addition
- `fix:` A bug fix or UI correction
- `perf:` Performance optimizations or memory reductions
- `docs:` Documentation updates
- `style:` Formatting or UI polish without logic changes
- `refactor:` Code restructuring without altering behavior
- `test:` Test additions or test framework enhancements
- `chore:` Dependency maintenance or configuration adjustments

---

## Pull Request Checklist

Before submitting your pull request, please verify:

- [ ] `npm --prefix Extension test` passes 100% (109/109 tests).
- [ ] `npm --prefix Extension run lint` and `check:js` pass with 0 errors.
- [ ] `npm --prefix Website test` passes all tests.
- [ ] `npm --prefix Website run build` succeeds cleanly.
- [ ] Both `Extension` and `Website` report 0 vulnerabilities in `npm audit`.
- [ ] All modified `_locales/*/messages.json` files are valid JSON in UTF-8 without BOM.
- [ ] No inline emojis in code logic or commit messages.

---

## ☕ The Story & Support

Hi! I am Milan, a 20-year-old student and web developer from Serbia. I built the All In One extension to help people boost their productivity with a clean, fast, and completely free tool.

I am committed to keeping this extension 100% free forever, with zero ads and zero popups. If this tool saves you time and you want to support my late night coding sessions, you can support my work:

💖 [Support my work via PayPal](https://paypal.me/milanwebportal)

Every donation means a lot and helps me maintain and improve the extension. Thank you!

---

_Thank you for contributing to All In One Extension!_

---

<p align="center">Made with ❤️ by <b>Milan Web Portal</b></p>
