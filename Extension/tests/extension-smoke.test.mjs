import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd());

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

test('manifest and package metadata stay aligned', async () => {
  const manifest = await readJson(path.join(root, 'manifest.json'));
  const pkg = await readJson(path.join(root, 'package.json'));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
  assert.equal(manifest.version, pkg.version);
  assert.ok(!manifest.update_url || /^https:\/\/allinone\.milanwebportal\.com\/extension\/updates\.xml$/.test(manifest.update_url));
  assert.ok(manifest.permissions.includes('offscreen'));
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.permissions.includes('scripting'));
  assert.ok(manifest.optional_permissions.includes('browsingData'));
});

test('critical entry files are wired in the popup and offscreen pages', async () => {
  const popup = await readFile(path.join(root, 'popup.html'), 'utf8');
  const offscreen = await readFile(path.join(root, 'offscreen.html'), 'utf8');

  assert.match(popup, /<link rel="preload" href="css\/style\.css" as="style">/);
  assert.match(popup, /<script type="module" src="js\/popup\.js"><\/script>/);
  assert.match(offscreen, /<script src="js\/offscreen\.js"><\/script>/);
});

test('locale bundles parse and expose required base strings', async () => {
  const localeDir = path.join(root, '_locales');
  const locales = await readdir(localeDir, { withFileTypes: true });
  const localeNames = locales.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  assert.ok(localeNames.length > 0);

  for (const locale of localeNames) {
    const messages = await readJson(path.join(localeDir, locale, 'messages.json'));
    assert.ok(messages.extName?.message, `${locale} is missing extName`);
    assert.ok(messages.extDesc?.message, `${locale} is missing extDesc`);
  }

  const en = await readJson(path.join(localeDir, 'en', 'messages.json'));
  const sr = await readJson(path.join(localeDir, 'sr', 'messages.json'));
  for (const [locale, messages] of [['en', en], ['sr', sr]]) {
    assert.ok(messages.toastPermissionDenied?.message, `${locale} is missing toastPermissionDenied`);
    assert.ok(messages.toastCacheCleared?.message, `${locale} is missing toastCacheCleared`);
    assert.ok(messages.swNoHistory?.message, `${locale} is missing swNoHistory`);
  }
});
