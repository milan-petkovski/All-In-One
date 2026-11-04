import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('manifest and package versions match', () => {
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const p = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(m.version, p.version);
});

test('content script does not load translations eagerly', () => {
  const toolsSrc = readFileSync(new URL('../js/content-tools.js', import.meta.url), 'utf8');
  assert.match(toolsSrc, /function ensureTranslations\(/);
  const contentSrc = readFileSync(new URL('../js/content.js', import.meta.url), 'utf8');
  assert.doesNotMatch(contentSrc, /loadTranslations\(\)/);
});

test('background validates locale codes and tracker escapes domains', () => {
  const bg = readFileSync(new URL('../js/background.js', import.meta.url), 'utf8');
  assert.match(bg, /function isValidLocaleCode\(/);
  assert.match(bg, /isValidLocaleCode\(request\.lang\)/);
  const tr = readFileSync(new URL('../js/popup-tracker.js', import.meta.url), 'utf8');
  assert.match(tr, /data-domain="\$\{escapeHtml\(domain\)\}"/);
});