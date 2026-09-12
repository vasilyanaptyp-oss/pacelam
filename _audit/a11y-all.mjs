// Every screen, both viewports, same criteria as _qa-tools/compare.js (axe WCAG 2.1 A/AA,
// tap targets >= 44px, no horizontal scroll) — including screens behind login and open sheets.
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const BASE = process.env.BASE || 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome' });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  -- ' + detail : '')); };

async function audit(page, label) {
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const small = await page.evaluate(() => {
    const sel = 'a,button,input,select,textarea,[role="button"],[onclick]';
    return [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
      const lab = el.closest('label');
      if (lab) { const lr = lab.getBoundingClientRect(); if (lr.width >= 44 && lr.height >= 44) return false; }
      return r.width < 44 || r.height < 44;
    }).map((el) => `${el.tagName}.${String(el.className).slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}"`);
  });
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 90)}`);
  });
  check(`${label}: no horizontal scroll`, overflow <= 0, `+${overflow}px`);
  check(`${label}: tap targets >= 44px`, small.length === 0, small.join(' | '));
  check(`${label}: axe WCAG 2.1 AA = ${axe.length}`, axe.length === 0, axe.join(' | '));
}

for (const vp of [{ w: 390, h: 844 }, { w: 360, h: 800 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'lv-LV' });
  const page = await ctx.newPage();
  const V = `${vp.w}x${vp.h}`;
  await page.goto(BASE + '?lang=lv', { waitUntil: 'load' });
  await page.waitForSelector('.pcard');
  await audit(page, `${V} feed (visitor)`);
  await page.click('.lang-btn'); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} language sheet`);
  await page.keyboard.press('Escape');
  await page.goto(BASE + '?lang=lv#/auth'); await page.waitForSelector('text=Ieiet demo');
  await audit(page, `${V} auth`);
  await page.getByRole('button', { name: 'Pārvadātājs' }).click(); await page.waitForSelector('.pcard');
  await audit(page, `${V} feed (carrier)`);
  await page.click('.strip .picker'); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} route sheet`);
  await page.locator('.sheet .picker').nth(1).click(); await page.waitForSelector('.sheet input');
  await page.fill('.sheet input[placeholder]', 'ri'); await page.waitForTimeout(150);
  await audit(page, `${V} city picker`);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.locator('.strip .icon-btn').click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} filter sheet`);
  await page.keyboard.press('Escape');
  await page.goto(BASE + '?lang=lv#/post'); await page.waitForSelector('form');
  await audit(page, `${V} post truck`);
  await page.getByRole('tab', { name: 'Meklēju transportu' }).click(); await page.waitForSelector('form');
  await page.getByRole('button', { name: 'Automašīna' }).click();
  await audit(page, `${V} post cargo`);
  await page.goto(BASE + '?lang=lv#/'); await page.waitForSelector('.pcard');
  await page.locator('.pcard', { hasText: 'Rēzekne' }).first().locator('a.pcard__link').click(); await page.waitForSelector('.detail__route');
  await audit(page, `${V} detail (planned, carrier)`);
  await page.getByRole('button', { name: 'Sava cena' }).click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} bid sheet`);
  await page.keyboard.press('Escape');
  await page.goto(BASE + '?lang=lv#/my'); await page.waitForSelector('.tabs');
  await audit(page, `${V} my`);
  await page.goto(BASE + '?lang=lv#/search'); await page.waitForSelector('h1');
  await audit(page, `${V} saved searches`);
  await page.getByRole('button', { name: 'Jauns meklējums' }).click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} search sheet`);
  await page.keyboard.press('Escape');
  await page.goto(BASE + '?lang=lv#/me'); await page.waitForSelector('form');
  await audit(page, `${V} profile`);
  await page.getByRole('button', { name: 'Pievienot auto' }).click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} vehicle sheet`);
  await page.keyboard.press('Escape');
  await page.goto(BASE + '?lang=lv#/inbox'); await page.waitForSelector('h1');
  await audit(page, `${V} inbox`);
  // light theme feed
  await page.evaluate(() => localStorage.setItem('pacelam.theme', JSON.stringify('light')));
  await page.goto(BASE + '?lang=lv#/'); await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.pcard');
  await audit(page, `${V} feed (light theme)`);
  await page.locator('.pcard', { hasText: 'Rēzekne' }).first().locator('a.pcard__link').click(); await page.waitForSelector('.detail__route');
  await audit(page, `${V} detail (light theme)`);
  await ctx.close();
}
console.log(failures ? `\n${failures} FAILED` : '\nALL SCREENS PASS');
await browser.close();
process.exit(failures ? 1 : 0);
