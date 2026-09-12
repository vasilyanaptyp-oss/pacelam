// Stopwatch: a carrier posts a truck offer from opening the app to the posting being live,
// with human pacing (700 ms per tap, 120 ms per typed character). Two runs: first time (route
// not yet known) and the everyday case (last route remembered). Run: node _audit/timing.mjs
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const TAP = 700, KEY = 120;
const browser = await chromium.launch({ channel: 'chrome' });

async function run(label, { remembered }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await ctx.newPage();
  const steps = [];
  const tap = async (desc, action) => { const t0 = Date.now(); await action(); await page.waitForTimeout(TAP); steps.push(`${desc} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); };
  // logged-in carrier with a truck in the profile, as it will be every day
  await page.goto(BASE + '?lang=ru#/me', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Перевозчик — Борис' }).click();
  await page.waitForSelector('form');
  if (remembered) {
    await page.evaluate(() => localStorage.setItem('pacelam.lastRoute', JSON.stringify({ from: { name: 'Daugavpils', lat: 55.87, lng: 26.52, radius: 0 }, to: { name: 'Rīga', lat: 56.95, lng: 24.11, radius: 0 } })));
  } else {
    await page.evaluate(() => localStorage.removeItem('pacelam.lastRoute'));
  }
  await page.goto(BASE + '?lang=ru#/', { waitUntil: 'load' });
  await page.waitForSelector('.pcard');
  const start = Date.now();
  await tap('1. Нажать «Подать» в нижнем меню', () => page.click('a[href="#/post"]'));
  await page.waitForSelector('form');
  if (!remembered) {
    await tap('2. Нажать «Откуда»', () => page.locator('form .picker').nth(0).click());
    await page.waitForSelector('.sheet input');
    for (const ch of 'dau') { await page.keyboard.type(ch); await page.waitForTimeout(KEY); }
    steps.push('3. Набрать «dau»');
    await tap('4. Выбрать Daugavpils', () => page.locator('.cityrow').first().click());
    await tap('5. Нажать «Куда»', () => page.locator('form .picker').nth(1).click());
    await page.waitForSelector('.sheet input');
    for (const ch of 'rig') { await page.keyboard.type(ch); await page.waitForTimeout(KEY); }
    steps.push('6. Набрать «rig»');
    await tap('7. Выбрать Rīga', () => page.locator('.cityrow').first().click());
    await tap('8. Нажать «Завтра»', () => page.getByRole('button', { name: 'Завтра' }).click());
    await tap('9. Нажать «Выложить»', () => page.getByRole('button', { name: 'Выложить' }).click());
  } else {
    await tap('2. Нажать «Завтра» (машина, откуда и куда уже подставлены)', () => page.getByRole('button', { name: 'Завтра' }).click());
    await tap('3. Нажать «Выложить»', () => page.getByRole('button', { name: 'Выложить' }).click());
  }
  await page.waitForSelector('.detail__route');
  const total = (Date.now() - start) / 1000;
  const taps = steps.filter((s) => !/Набрать/.test(s)).length;
  console.log(`\n=== ${label} ===`);
  steps.forEach((s) => console.log('  ' + s));
  console.log(`  итого: ${total.toFixed(1)} s, касаний: ${taps}, символов: ${remembered ? 0 : 6}`);
  await ctx.close();
  return total;
}
const a = await run('Первый раз: маршрут ещё не запомнен', { remembered: false });
const b = await run('Каждый следующий раз: последний маршрут подставлен', { remembered: true });
console.log(`\nРЕЗУЛЬТАТ: первый раз ${a.toFixed(1)} s, обычный случай ${b.toFixed(1)} s (лимит 20 s) → ${a <= 20 && b <= 20 ? 'УКЛАДЫВАЕТСЯ' : 'НЕ УКЛАДЫВАЕТСЯ'}`);
await browser.close();
