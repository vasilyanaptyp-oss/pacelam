// Frames of the hero scene at several moments (desktop) plus the still phone frame.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.BASE || 'http://localhost:5180/').replace(/\/?$/, '/');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(ROOT + '?lang=ru', { waitUntil: 'load' });
const t0 = Date.now();
for (const t of (process.env.TIMES || '1200,5600,7000,15000,19000,28000').split(',').map(Number)) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.locator('.scene').screenshot({ path: path.join(OUT, `scene-${t}.png`) });
  console.log('frame', t, await page.evaluate(() => ({ gsap: !!window.gsap, cls: document.querySelector('.scene').className, truck: (document.querySelector('.truck').getAttribute('transform') || '').slice(0, 48), cards: [...document.querySelectorAll('.mock')].map((m) => getComputedStyle(m).visibility) })));
}
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await mob.goto(ROOT + '?lang=ru', { waitUntil: 'load' }); await mob.waitForTimeout(1500);
console.log('phone gsap loaded:', await mob.evaluate(() => !!window.gsap), 'scripts:', await mob.evaluate(() => [...document.scripts].map((s) => s.src.split('/').pop()).filter(Boolean)));
await mob.locator('.scene').screenshot({ path: path.join(OUT, 'scene-phone.png') });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
