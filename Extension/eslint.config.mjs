export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        Audio: "readonly",
        AudioContext: "readonly",
        Blob: "readonly",
        DOMParser: "readonly",
        Element: "readonly",
        FileReader: "readonly",
        HTMLMediaElement: "readonly",
        Image: "readonly",
        MediaMetadata: "readonly",
        MouseEvent: "readonly",
        MutationObserver: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        TextEncoder: "readonly",
        URL: "readonly",
        caches: "readonly",
        cancelAnimationFrame: "readonly",
        chrome: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        crypto: "readonly",
        document: "readonly",
        fetch: "readonly",
        globalThis: "readonly",
        indexedDB: "readonly",
        localStorage: "readonly",
        location: "readonly",
        navigator: "readonly",
        requestAnimationFrame: "readonly",
        requestIdleCallback: "readonly",
        self: "readonly",
        sessionStorage: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "prefer-const": "warn",
      "no-console": ["warn", { "allow": ["warn", "error", "info", "log", "debug"] }]
    }
  }
];
