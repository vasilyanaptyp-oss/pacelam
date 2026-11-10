// Shared bits for the minimal-version checks: a throwaway static server and a phone-sized browser.
// Nothing stays running after a script ends.
import http from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
// playwright-core lives in the main checkout's node_modules (a worktree has none)
const candidates = [path.join(ROOT, 'package.json'), path.resolve(ROOT, '..', 'pacelam', 'package.json')];
let pw = null;
for (const c of candidates) { try { pw = createRequire(c)('playwright-core'); break; } catch { /* next */ } }
if (!pw) throw new Error('playwright-core not found');
export const { chromium } = pw;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export function serve(root = ROOT) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(root, p);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!existsSync(file)) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) }));
  });
}

export async function phone({ width = 390, height = 844, lang = 'ru-RU' } = {}) {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang, geolocation: { latitude: 55.87, longitude: 26.52 }, permissions: ['geolocation'] });
  // map tiles are someone else's server: checks do not load them
  await ctx.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4+/j5fwAI7wOnqOhdJgAAAABJRU5ErkJggg==', 'base64') }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { browser, ctx, page, errors };
}

export const outDir = (name) => { const d = path.resolve(ROOT, '..', 'birza', 'shots_1011', name); mkdirSync(d, { recursive: true }); return d; };

// What a person meets on the screen: things to tap, words to read, the smallest letters, how far it scrolls.
export const metrics = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
  const top = [...document.querySelectorAll('.sheet.is-open')].pop() || document.body;
  const taps = [...top.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')].filter(vis);
  const firstScreen = taps.filter((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
  let minFont = 99; let words = 0; const small = new Set();
  const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const txt = n.textContent.trim(); if (!txt) continue;
    const el = n.parentElement; if (!el || !vis(el) || el.closest('.sr-only,script,style')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    words += txt.split(/\s+/).length;
    if (fs < minFont) minFont = fs;
    if (fs < 16) small.add(fs);
  }
  const lowTaps = taps.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 48 && r.width > 0; }).length;
  return { taps: taps.length, tapsFirstScreen: firstScreen.length, words, minFont, fontsBelow16: [...small].sort((a, b) => a - b), tapsLower48: lowTaps, screens: Math.round((document.documentElement.scrollHeight / innerHeight) * 10) / 10, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
});
