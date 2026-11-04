/**
 * Jednokratna generacija optimizovanih slika (OG kartice, favicon set, PWA ikone, avatari).
 * Pokretanje iz Website/: npm run assets
 * Rezultat se upisuje u public/ i commit-uje, pa Netlify build ne zavisi od sharp-a.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => path.join(root, 'public', ...p);

const BG = '#f5f6f7';

async function ogCards() {
    await mkdir(pub('images'), { recursive: true });
    for (const lang of ['EN', 'SR']) {
        const src = pub('Branding', lang, '1.png');
        const inner = await sharp(src)
            .resize({ height: 630, fit: 'inside' })
            .toBuffer();
        const meta = await sharp(inner).metadata();
        const left = Math.round((1200 - meta.width) / 2);
        const base = sharp({
            create: { width: 1200, height: 630, channels: 3, background: BG }
        }).composite([{ input: inner, left, top: 0 }]);
        const out = lang.toLowerCase();
        await base.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(pub('images', `og-${out}.jpg`));
        await base.clone().webp({ quality: 80 }).toFile(pub('images', `og-${out}.webp`));
        console.log(`og-${out}.jpg/webp`);
    }
}

async function icons() {
    const mark = pub('logo.png');
    for (const size of [16, 32, 48, 192, 512]) {
        const name = size === 192 || size === 512 ? `icon-${size}.png` : `favicon-${size}.png`;
        await sharp(mark).resize(size, size, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 9 }).toFile(pub(name));
    }
    // Apple touch icon: pun kvadrat sa blagim paddingom na beloj podlozi.
    const apple = await sharp(mark).resize(132, 132).toBuffer();
    await sharp({ create: { width: 180, height: 180, channels: 3, background: '#ffffff' } })
        .composite([{ input: apple, left: 24, top: 24 }]).png({ compressionLevel: 9 })
        .toFile(pub('apple-touch-icon.png'));
    // Maskable: sadrzaj u centralnih 80%.
    const mask = await sharp(mark).resize(360, 360).toBuffer();
    await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } })
        .composite([{ input: mask, left: 76, top: 76 }]).png({ compressionLevel: 9 })
        .toFile(pub('icon-maskable-512.png'));
    console.log('icons');
}

async function logoWebp() {
    await sharp(pub('logo.png')).resize(128, 128).webp({ quality: 90 }).toFile(pub('logo-128.webp'));
    console.log('logo webp');
}

async function avatars(urls) {
    await mkdir(pub('reviews'), { recursive: true });
    let i = 1;
    for (const url of urls) {
        const out = pub('reviews', `r${i}.webp`);
        i += 1;
        if (existsSync(out)) continue;
        try {
            const res = await fetch(url.replace(/=s48-w48-h48$/, '=s96-w96-h96'));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            await sharp(buf).resize(96, 96).webp({ quality: 80 }).toFile(out);
            console.log('avatar', out);
        } catch (err) {
            console.warn('avatar preskocen:', url.slice(0, 60), String(err));
        }
    }
}

const which = process.argv[2] || 'all';
if (which === 'all' || which === 'og') await ogCards();
if (which === 'all' || which === 'icons') { await icons(); await logoWebp(); }
if (which === 'all' || which === 'avatars') {
    const list = (process.argv[3] || '').split(',').filter(Boolean);
    if (list.length) await avatars(list);
}
