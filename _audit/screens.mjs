// Every screen at four widths (360, 390, 1280, 1920) with the compare.js criteria: axe WCAG 2.1 A/AA,
// tap targets >= 44px, no horizontal scroll. Includes the public page, screens behind login, open
// sheets, the desktop board with the details panel, the operator form and the deal screens.
// Run: BASE=https://.../pacelam/ node _audit/screens.mjs   (BASE is the site root; the app is BASE + 'app/')
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const ROOT = (process.env.BASE || 'http://localhost:5173/').replace(/\/?$/, '/');
const APP = ROOT + 'app/';
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

for (const vp of [{ w: 360, h: 800 }, { w: 390, h: 844 }, { w: 1280, h: 800 }, { w: 1920, h: 1080 }]) {
  const mobile = vp.w < 700;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'lv-LV' });
  const page = await ctx.newPage();
  const V = `${vp.w}x${vp.h}`;
  const rowSel = mobile ? '.pcard' : '.tbl__row';
  // public page
  await page.goto(ROOT + '?lang=lv', { waitUntil: 'load' });
  await page.waitForSelector('.hero');
  await audit(page, `${V} public page`);
  await page.goto(ROOT + '?lang=ru', { waitUntil: 'load' });
  await page.waitForSelector('.hero');
  await audit(page, `${V} public page (ru)`);
  // app, visitor
  await page.goto(APP + '?lang=lv', { waitUntil: 'load' });
  await page.waitForSelector(rowSel);
  await audit(page, `${V} board (visitor)`);
  await page.click('.lang-btn:not(.top__about)'); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} language sheet`);
  await page.keyboard.press('Escape');
  await page.goto(APP + '?lang=lv#/auth'); await page.waitForSelector('text=Ieiet demo');
  await audit(page, `${V} auth`);
  await page.getByRole('button', { name: 'Pārvadātājs' }).click(); await page.waitForSelector(rowSel);
  await audit(page, `${V} board (carrier)`);
  if (!mobile) {
    await page.locator('.tbl__sort').nth(6).click(); await page.waitForTimeout(200);
    await audit(page, `${V} board sorted by weight`);
    await page.locator('.tbl__row').first().click(); await page.waitForSelector('.board__detail.is-open .detail');
    await audit(page, `${V} board + details panel`);
    if (vp.w < 1440) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
  await page.locator(mobile ? '.strip .picker' : '.board__filters .picker').first().click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} route sheet`);
  await page.locator('.sheet .picker').nth(1).click(); await page.waitForSelector('.sheet input');
  await page.fill('.sheet input[placeholder]', 'ri'); await page.waitForTimeout(150);
  await audit(page, `${V} city picker`);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  if (mobile) { await page.locator('.strip .icon-btn').click(); await page.waitForSelector('.sheet.is-open'); await audit(page, `${V} filter sheet`); await page.keyboard.press('Escape'); }
  await page.goto(APP + '?lang=lv#/post'); await page.waitForSelector('form');
  await audit(page, `${V} post truck`);
  await page.getByRole('tab', { name: 'Meklēju transportu' }).click(); await page.waitForSelector('form');
  await page.getByRole('button', { name: 'Automašīna' }).click();
  await audit(page, `${V} post cargo`);
  // planned detail + bid sheet
  await page.goto(APP + '?lang=lv#/'); await page.waitForSelector(rowSel);
  await page.evaluate(() => localStorage.removeItem('pacelam.route'));
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector(rowSel);
  await page.locator(mobile ? '.pcard' : '.tbl__row', { hasText: 'Rēzekne' }).first().locator(mobile ? 'a.pcard__link' : 'td').first().click();
  await page.waitForSelector('.detail');
  await audit(page, `${V} detail (planned)`);
  await page.getByRole('button', { name: 'Sava cena' }).first().click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} bid sheet`);
  await page.fill('.sheet input[inputmode="decimal"]', '175');
  await page.getByRole('button', { name: 'Nosūtīt cenu' }).click(); await page.waitForTimeout(400);
  await audit(page, `${V} detail with my bid`);
  // urgent take -> contacts (the deal screens that overflowed in the previous build)
  await page.goto(APP + '?lang=lv#/'); await page.waitForSelector(rowSel);
  await page.locator(mobile ? '.pcard.is-urgent' : '.tbl__row.is-urgent').first().locator(mobile ? 'a.pcard__link' : 'td').first().click();
  await page.waitForSelector('.detail');
  await page.getByRole('button', { name: 'Ņemu' }).first().click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} take confirm`);
  await page.locator('.sheet .btn--primary').click(); await page.waitForSelector('.contacts');
  await audit(page, `${V} deal contacts`);
  await page.goto(APP + '?lang=lv#/my'); await page.waitForSelector('.tabs');
  await audit(page, `${V} my`);
  await page.getByRole('tab', { name: 'Darījumi' }).click(); await page.waitForTimeout(300);
  await audit(page, `${V} my deals`);
  await page.goto(APP + '?lang=lv#/search'); await page.waitForSelector('h1');
  await audit(page, `${V} saved searches`);
  await page.getByRole('button', { name: 'Jauns meklējums' }).click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} search sheet`);
  await page.keyboard.press('Escape');
  await page.goto(APP + '?lang=lv#/me'); await page.waitForSelector('form');
  await audit(page, `${V} profile`);
  await page.getByRole('button', { name: 'Pievienot auto' }).click(); await page.waitForSelector('.sheet.is-open');
  await audit(page, `${V} vehicle sheet`);
  await page.keyboard.press('Escape');
  await page.goto(APP + '?lang=lv#/inbox'); await page.waitForSelector('h1');
  await audit(page, `${V} inbox`);
  // customer view (accept a bid -> pending deal screen) and operator form
  await page.goto(APP + '?lang=lv&demo=customer#/'); await page.waitForSelector(rowSel);
  await audit(page, `${V} board (customer)`);
  await page.goto(APP + '?lang=lv#/my'); await page.waitForSelector('.tabs');
  await page.locator('.pcard', { hasText: 'Rēzekne' }).first().locator('a.pcard__link').click(); await page.waitForSelector('.bids');
  await audit(page, `${V} detail (owner, bids)`);
  await page.locator('.bidrow', { hasText: '175' }).locator('button').click(); await page.waitForTimeout(400);
  await audit(page, `${V} deal pending (owner)`);
  await page.goto(APP + '?lang=lv&demo=operator#/operator'); await page.waitForSelector('form.form--operator');
  await audit(page, `${V} operator form`);
  // light theme
  await page.evaluate(() => localStorage.setItem('pacelam.theme', JSON.stringify('light')));
  await page.goto(APP + '?lang=lv&demo=carrier#/'); await page.reload({ waitUntil: 'load' }); await page.waitForSelector(rowSel);
  await audit(page, `${V} board (light theme)`);
  await ctx.close();
}
console.log(failures ? `\n${failures} FAILED` : '\nALL SCREENS PASS');
await browser.close();
process.exit(failures ? 1 : 0);
