export default [
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        Audio: "readonly",
        AudioContext: "readonly",
        Blob: "readonly",
        DOMParser: "readonly",
        FileReader: "readonly",
        MediaMetadata: "readonly",
        MutationObserver: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        URL: "readonly",
        chrome: "readonly",
        document: "readonly",
        indexedDB: "readonly",
        location: "readonly",
        navigator: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "prefer-const": "warn",
      "no-console": ["warn", { "allow": ["warn", "error", "info"] }]
    }
  }
];
