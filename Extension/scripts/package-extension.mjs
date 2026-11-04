import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(extensionRoot, '..');

const manifestPath = path.join(extensionRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';

const outputDir = path.join(extensionRoot, 'dist');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const zipFileName = `All-In-One-v${version}.zip`;
const zipOutputPath = path.join(outputDir, zipFileName);
const stagingDir = path.join(outputDir, 'package-staging');

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(zipOutputPath)) {
  fs.rmSync(zipOutputPath, { force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

const itemsToCopy = [
  'manifest.json',
  'popup.html',
  'offscreen.html',
  'assets',
  'css',
  'js',
  '_locales'
];

for (const item of itemsToCopy) {
  const src = path.join(extensionRoot, item);
  const dest = path.join(stagingDir, item);
  if (!fs.existsSync(src)) {
    console.warn(`Upozorenje: ${item} ne postoji u ${extensionRoot}`);
    continue;
  }
  fs.cpSync(src, dest, { recursive: true });
}

// Kreiranje zip arhive
try {
  // Pokusavamo sa tar.exe (ugradjen u Windows i Linux/macOS)
  execSync(`tar -a -c -f "${zipOutputPath}" -C "${stagingDir}" .`, { stdio: 'inherit' });
} catch {
  // Fallback na PowerShell Compress-Archive ako tar nije dostupan
  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipOutputPath}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });
}

// Ciscenje staging foldera
fs.rmSync(stagingDir, { recursive: true, force: true });

const stats = fs.statSync(zipOutputPath);
const sizeKb = (stats.size / 1024).toFixed(2);
console.log(`\nUSPESNO: Kreiran je produkcioni zip paket!`);
console.log(`Fajl: ${zipOutputPath}`);
console.log(`Velicina: ${sizeKb} KB`);
