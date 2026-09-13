// Screenshots for design review: public page (desktop + phone), desktop board with the details
// panel (1440), board with the drawer (1280), operator form, two-column cards (768).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.BASE || 'http://localhost:5173/').replace(/\/?$/, '/');
const APP = ROOT + 'app/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
async function ctxPage(w, h, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'ru-RU' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}: ` + e.message));
  return { ctx, page };
}
{
  const { ctx, page } = await ctxPage(1440, 900);
  await page.goto(ROOT + '?lang=ru', { waitUntil: 'load' }); await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, 'd01-landing-1440.png') });
  await page.goto(APP + '?lang=ru&demo=carrier#/', { waitUntil: 'load' }); await page.waitForSelector('.tbl__row'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'd02-board-1440.png') });
  await page.locator('.tbl__row').nth(1).click(); await page.waitForSelector('.board__detail.is-open .detail'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'd03-board-1440-detail.png') });
  await ctx.close();
}
{
  const { ctx, page } = await ctxPage(1280, 800);
  await page.goto(APP + '?lang=ru&demo=carrier#/', { waitUntil: 'load' }); await page.waitForSelector('.tbl__row'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'd04-board-1280.png') });
  await page.locator('.tbl__row').nth(1).click(); await page.waitForSelector('.board__detail.is-open .detail'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'd05-board-1280-drawer.png') });
  await page.goto(APP + '?lang=ru&demo=operator#/operator', { waitUntil: 'load' }); await page.waitForSelector('form.form--operator'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'd06-operator-1280.png'), fullPage: true });
  await page.goto(APP + '?lang=ru&demo=customer#/my', { waitUntil: 'load' }); await page.waitForSelector('.tabs');
  await page.locator('.pcard', { hasText: 'Rēzekne' }).first().locator('a.pcard__link').click(); await page.waitForSelector('.bids'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'd07-owner-bids-1280.png'), fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await ctxPage(768, 1024, true);
  await page.goto(APP + '?lang=ru&demo=carrier#/', { waitUntil: 'load' }); await page.waitForSelector('.pcard'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'd08-cards-768.png') });
  await ctx.close();
}
{
  const { ctx, page } = await ctxPage(390, 844, true);
  await page.goto(ROOT + '?lang=ru', { waitUntil: 'load' }); await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, 'd09-landing-390.png'), fullPage: true });
  await ctx.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
