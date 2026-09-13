// How many table rows a dispatcher sees without scrolling at 1280x800 (and 1920x1080).
// Run: BASE=https://.../pacelam/app/ node _audit/table-rows.mjs
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:5173/app/';
const browser = await chromium.launch({ channel: 'chrome' });
for (const vp of [{ w: 1280, h: 800 }, { w: 1440, h: 900 }, { w: 1920, h: 1080 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?lang=ru&demo=carrier#/`, { waitUntil: 'load' });
  await page.waitForSelector('.tbl__row');
  await page.evaluate(() => localStorage.removeItem('pacelam.route'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tbl__row');
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tbl__row')];
    const vh = innerHeight;
    const visible = rows.filter((tr) => { const b = tr.getBoundingClientRect(); return b.top >= 0 && b.bottom <= vh; }).length;
    const first = rows[0]?.getBoundingClientRect();
    const rowH = first ? Math.round(first.height) : 0;
    const thead = document.querySelector('.tbl thead')?.getBoundingClientRect();
    const capacity = rowH ? Math.floor((vh - (thead?.bottom || 0)) / rowH) : 0;
    return { total: rows.length, visible, rowH, headBottom: Math.round(thead?.bottom || 0), capacity, hasDetail: !!document.querySelector('.board__detail'), width: innerWidth };
  });
  console.log(`${vp.w}x${vp.h}: строк в демо ${r.total}, видно без прокрутки ${r.visible} (высота строки ${r.rowH}px, шапка таблицы до ${r.headBottom}px → вместимость ${r.capacity} строк)`);
  await ctx.close();
}
await browser.close();
