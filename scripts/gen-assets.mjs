// Builds assets/: the share image (1200×630) and the app icons, rendered with the site's own fonts and
// the hero map from index.html, so they stay in the same style as the page. Run from the repo root:
//   node scripts/gen-assets.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const map = index.slice(index.indexOf('<svg class="map"'), index.indexOf('</svg>', index.indexOf('<svg class="map"')) + 6)
  .replace(/class="([^"]*)draw([^"]*)"/g, 'class="$1$2"'); // static: no stroke-dash animations
// fonts go in as data URIs: a page built with setContent has no origin and cannot fetch file:// fonts
const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');

const ICON = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
  <rect width="64" height="64" rx="${pad ? 0 : 14}" fill="#0B0D11"/>
  <g transform="translate(32 32) scale(${pad ? 0.78 : 1}) translate(-32 -32)">
    <path d="M14 46V18h12a9 9 0 0 1 0 18h-6v10z" fill="#EDF1F6"/>
    <circle cx="46" cy="42" r="6" fill="#F5A623"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), ICON(false));

const OG = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"><style>
@font-face { font-family: Unbounded; font-weight: 500 900; src: url(${font('unbounded-latin.woff2')}) format('woff2'); unicode-range: U+0000-00FF; }
@font-face { font-family: Unbounded; font-weight: 500 900; src: url(${font('unbounded-latin-ext.woff2')}) format('woff2'); unicode-range: U+0100-024F; }
@font-face { font-family: Manrope; font-weight: 200 800; src: url(${font('manrope-latin.woff2')}) format('woff2'); unicode-range: U+0000-00FF; }
@font-face { font-family: Manrope; font-weight: 200 800; src: url(${font('manrope-latin-ext.woff2')}) format('woff2'); unicode-range: U+0100-024F; }
@font-face { font-family: Manrope; font-weight: 200 800; src: url(${font('manrope-cyrillic.woff2')}) format('woff2'); unicode-range: U+0400-04FF; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #0B0D11; color: #EDF1F6; font-family: Manrope, sans-serif; position: relative; }
.glow { position: absolute; inset: 0; background: radial-gradient(50% 60% at 78% 45%, rgba(245,166,35,.16), transparent 70%); }
.copy { position: absolute; left: 72px; top: 64px; width: 540px; }
.brand { font-family: Unbounded; font-weight: 800; font-size: 34px; letter-spacing: -.02em; }
.brand span { color: #F5A623; }
.eyebrow { display: inline-block; margin-top: 44px; padding: 8px 14px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; font-size: 14px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #98A2B1; }
h1 { margin-top: 26px; font-family: Unbounded; font-weight: 800; font-size: 54px; line-height: 1.04; letter-spacing: -.02em; }
h1 em { font-style: normal; color: #F5A623; }
p { margin-top: 24px; font-size: 20px; line-height: 1.45; color: #98A2B1; }
.tags { position: absolute; left: 72px; bottom: 56px; display: flex; gap: 12px; font-size: 16px; font-weight: 700; }
.tags span { padding: 10px 16px; border-radius: 12px; background: rgba(21,25,33,.9); border: 1px solid rgba(255,255,255,.12); }
.scene { position: absolute; right: 56px; top: 44px; width: 490px; height: 546px; border-radius: 26px; border: 1px solid rgba(255,255,255,.1); background: linear-gradient(180deg, #151921, #0F1218); overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.5); }
.scene svg { width: 100%; height: 100%; }
.map__cities text { font-family: Manrope; }
.truck__light, .truck__load, .truck__shadow, .tour, .tour-halo, .tour-done, .tour-road, .pickup:not(.map__cargo), .pickup__label { display: none; }
.map__cargo .pickup__label { display: block; }
</style></head><body>
<div class="glow"></div>
<div class="copy">
  <div class="brand">Pace<span>ļ</span>am</div>
  <div class="eyebrow">Kravu birža atpakaļceļam · Latvija un Baltija</div>
  <h1>Atgriezies <em>ar kravu</em>, nevis tukšs.</h1>
  <p>Sludinājums 20 sekundēs, līkums kilometros uz katras kartītes, kontakti tikai pēc darījuma.</p>
</div>
<div class="tags"><span>LV</span><span>RU · Биржа обратной загрузки</span><span>EN · Backload exchange</span></div>
<div class="scene">${map}</div>
</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(OG, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'og.png'), type: 'png' });

const icon = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [name, size, pad] of [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['apple-touch-icon.png', 180, false], ['icon-maskable-512.png', 512, true]]) {
  await icon.setContent(`<body style="margin:0;background:${pad ? '#0B0D11' : 'transparent'}">${ICON(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  await icon.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: !pad });
}
await browser.close();
for (const f of fs.readdirSync(OUT)) console.log(f, Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' KB');
