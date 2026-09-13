// 1) ?lang= wins in a CLEAN context (no localStorage) and document.documentElement.lang follows.
// 2) Latvian diacritics render with the web font: PIXEL comparison of each glyph rendered with the
//    page font vs a deliberately nonexistent family. Glyph widths are not used — canvas silently
//    substitutes a system font and returns a plausible width.
import { chromium } from 'playwright-core';
import { PNG } from './png.mjs';

const BASE = process.env.BASE || 'http://localhost:5173/app/';
const browser = await chromium.launch({ channel: 'chrome' });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? ' -- ' + detail : '')); };

// --- languages ---
for (const lang of ['lv', 'ru', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' }); // browser locale deliberately unrelated
  const page = await ctx.newPage();
  await page.goto(`${BASE}?lang=${lang}`, { waitUntil: 'load' });
  await page.waitForSelector('.pcard');
  const got = await page.evaluate(() => ({ lang: document.documentElement.lang, nav: [...document.querySelectorAll('.nav a')].map((a) => a.textContent.trim()), saved: localStorage.getItem('pacelam.lang'), title: document.title }));
  const expectNav = { lv: 'Plūsma', ru: 'Лента', en: 'Board' }[lang];
  check(`?lang=${lang} in clean context: html lang="${got.lang}", nav starts with "${got.nav[0]}"`, got.lang === lang && got.nav[0] === expectNav, JSON.stringify(got));
  await ctx.close();
}
// stored choice ru, URL says lv -> lv must win
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?lang=ru`, { waitUntil: 'load' });
  await page.waitForSelector('.pcard');
  await page.goto(`${BASE}?lang=lv`, { waitUntil: 'load' });
  await page.waitForSelector('.pcard');
  const got = await page.evaluate(() => ({ lang: document.documentElement.lang, nav: document.querySelector('.nav a').textContent.trim() }));
  check(`stored ru, URL lv -> page is lv (${got.lang}, "${got.nav}")`, got.lang === 'lv' && got.nav === 'Plūsma');
  // switching via the language sheet updates document lang and URL
  await page.click('.lang-btn:not(.top__about)');
  await page.getByRole('button', { name: 'English' }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ lang: document.documentElement.lang, url: location.search, nav: document.querySelector('.nav a').textContent.trim() }));
  check(`language switch updates html lang and URL (${after.lang}, ${after.url})`, after.lang === 'en' && after.url.includes('lang=en') && after.nav === 'Board');
  await ctx.close();
}

// --- public page: ?lang= in a clean context ---
for (const lang of ['lv', 'ru', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(BASE.replace(/app\/$/, '') + '?lang=' + lang, { waitUntil: 'load' });
  await page.waitForSelector('.hero');
  const got = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1').textContent.trim().slice(0, 12), app: document.querySelector('a[data-app]').getAttribute('href') }));
  const expect = { lv: 'Brauc', ru: 'Возвра', en: 'Drive' }[lang];
  check(`public page ?lang=${lang}: html lang="${got.lang}", h1 "${got.h1}", app link ${got.app}`, got.lang === lang && got.h1.startsWith(expect) && got.app.includes('lang=' + lang));
  await ctx.close();
}

// --- diacritics: pixel comparison ---
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'lv-LV' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?lang=lv`, { waitUntil: 'load' });
  await page.waitForSelector('.pcard');
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.unicodeRange}`.slice(0, 60)));
  check(`web font faces loaded: ${loaded.length} (${loaded.map((l) => l.split(' ')[0]).join(', ')})`, loaded.length >= 3 && loaded.some((l) => l.startsWith('Unbounded')), JSON.stringify(loaded));
  const glyphs = 'āēīūčģķļņšž ĀĒĪŪČĢĶĻŅŠŽ';
  const probe = async (family, weight) => {
    await page.evaluate(({ family, weight, glyphs }) => {
      document.getElementById('probe')?.remove();
      const el = document.createElement('div');
      el.id = 'probe';
      el.style.cssText = `position:fixed;left:0;top:0;z-index:999;width:760px;height:60px;overflow:hidden;white-space:nowrap;background:#0B0D11;color:#EDF1F6;padding:8px;font:${weight} 28px/1.2 ${family};letter-spacing:0`;
      el.textContent = glyphs;
      document.body.append(el);
    }, { family, weight, glyphs });
    await page.waitForTimeout(120);
    return page.locator('#probe').screenshot();
  };
  for (const [fam, weight] of [['Manrope', 400], ['Manrope', 800], ['Unbounded', 700]]) {
    const page1 = PNG.decode(await probe(`${fam}, 'Segoe UI', system-ui, sans-serif`, weight));      // what the page uses
    const nonexistent = PNG.decode(await probe("'NoSuchFamily-QQQ-123'", weight));                 // deliberately nonexistent family
    const fallback = PNG.decode(await probe("'Segoe UI', system-ui, sans-serif", weight));          // the page's own fallback stack
    const d1 = PNG.diff(page1, nonexistent);
    const d2 = PNG.diff(page1, fallback);
    const same = PNG.diff(page1, PNG.decode(await probe(`${fam}, 'Segoe UI', system-ui, sans-serif`, weight)));
    check(`${fam} ${weight}: page font vs nonexistent family differ in ${d1.differing}/${d1.total} px`, !d1.sizeMismatch && d1.differing / d1.total > 0.03, JSON.stringify(d1));
    check(`${fam} ${weight}: page font vs the page's own fallback stack differ in ${d2.differing}/${d2.total} px (so the web font, not Segoe UI, is drawing the diacritics)`, !d2.sizeMismatch && d2.differing / d2.total > 0.03, JSON.stringify(d2));
    check(`${fam} ${weight}: probe is deterministic (same font twice: ${same.differing} px differ)`, same.differing === 0, JSON.stringify(same));
  }
  // the real headline of the page uses the web font too (not just the probe)
  const cityFont = await page.evaluate(() => getComputedStyle(document.querySelector('.pcard__route span')).fontFamily);
  check(`card headline font-family starts with Unbounded (${cityFont.slice(0, 30)})`, /^Unbounded/.test(cityFont));
  // detect tofu / notdef: render 'ļ' and 'l' — must differ (a missing glyph would fall back to l-like box)
  await page.evaluate(() => { document.getElementById('probe')?.remove(); });
  await ctx.close();
}
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
await browser.close();
process.exit(failures ? 1 : 0);
