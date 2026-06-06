import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd());
const localesDir = path.join(root, "_locales");

test("all translation bundles are valid JSON, UTF-8 without BOM, and have no mojibake", async () => {
  const locales = await readdir(localesDir, { withFileTypes: true });
  const localeNames = locales.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  assert.ok(localeNames.length > 0, "At least one locale directory should exist");

  for (const locale of localeNames) {
    const filePath = path.join(localesDir, locale, "messages.json");
    const rawContent = await readFile(filePath, "utf8");

    // 1. Check for BOM
    assert.ok(!rawContent.startsWith("\uFEFF"), `Locale "${locale}" messages.json contains a BOM (Byte Order Mark)`);

    // 2. Check for invalid UTF-8 (mojibake patterns)
    const mojibakeRegex = /[ÃÂ][\u0080-\u00BF]/;
    assert.ok(!mojibakeRegex.test(rawContent), `Locale "${locale}" messages.json seems to contain corrupted character patterns (mojibake)`);

    // 3. Check valid JSON
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      assert.fail(`Locale "${locale}" messages.json is not valid JSON: ${err.message}`);
    }

    // 4. Check that each key has a 'message' property
    for (const [key, val] of Object.entries(parsed)) {
      assert.ok(val && typeof val === "object", `Locale "${locale}" key "${key}" value is not an object`);
      assert.ok(typeof val.message === "string", `Locale "${locale}" key "${key}" is missing a string "message"`);
    }
  }
});

test("all translation locales match the English master locale key-for-key and placeholder-for-placeholder", async () => {
  const enPath = path.join(localesDir, "en", "messages.json");
  const enRaw = await readFile(enPath, "utf8");
  const en = JSON.parse(enRaw);
  const enKeys = Object.keys(en).sort();

  const locales = await readdir(localesDir, { withFileTypes: true });
  const localeNames = locales.filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((name) => name !== "en");

  const placeholderRegex = /\$[a-zA-Z0-9_]+\$/g;

  for (const locale of localeNames) {
    const filePath = path.join(localesDir, locale, "messages.json");
    const rawContent = await readFile(filePath, "utf8");
    const parsed = JSON.parse(rawContent);
    const parsedKeys = Object.keys(parsed).sort();

    // 1. Check keys matching
    try {
      assert.deepEqual(parsedKeys, enKeys);
    } catch (err) {
      const missingInLocale = enKeys.filter(k => !parsedKeys.includes(k));
      const extraInLocale = parsedKeys.filter(k => !enKeys.includes(k));
      let errMsg = `Locale "${locale}" keys do not match English master keys.`;
      if (missingInLocale.length > 0) {
        errMsg += `\nMissing keys in "${locale}": ${missingInLocale.join(", ")}`;
      }
      if (extraInLocale.length > 0) {
        errMsg += `\nExtra keys in "${locale}": ${extraInLocale.join(", ")}`;
      }
      assert.fail(errMsg);
    }

    // 2. Check placeholder matching
    for (const key of enKeys) {
      const enMsg = en[key].message;
      const localeMsg = parsed[key].message;

      const enPlaceholders = (enMsg.match(placeholderRegex) || []).sort();
      const localePlaceholders = (localeMsg.match(placeholderRegex) || []).sort();

      assert.deepEqual(
        localePlaceholders,
        enPlaceholders,
        `Placeholders do not match for key "${key}" in locale "${locale}":\nEN: "${enMsg}" (placeholders: ${enPlaceholders.join(", ")})\n${locale.toUpperCase()}: "${localeMsg}" (placeholders: ${localePlaceholders.join(", ")})`
      );
    }
  }
});
