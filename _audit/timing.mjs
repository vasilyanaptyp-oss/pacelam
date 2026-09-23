// Stopwatch for the posting wizard (23.09.2026: doors → map → calendar → what → publish), phone 390 px,
// Russian, human pacing: 700 ms per tap, 120 ms per typed character. Four runs, each from the board
// to the posting being live:
//   A. carrier, first time (no last route): the town is typed;
//   B. carrier, every day: the last route is offered first;
//   C. carrier, the way back: last route + ⇅;
//   D. customer, cargo, first time: town typed, category, weight.
// Limit: 20 s each. Run: node _audit/timing.mjs   (BASE=https://…/pacelam/ for the published site)
import { chromium } from 'playwright-core';

const ROOT = (process.env.BASE || 'http://localhost:5173/').replace(/\/?$/, '/').replace(/app\/$/, '');
const APP = ROOT + 'app/';
const TAP = 700, KEY = 120;
const BORIS = 'd0000000-0000-4000-8000-000000000001';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];

async function run(label, { who, lastRoute, swap, cargo }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const steps = [];
  let taps = 0, chars = 0;
  const tap = async (desc, action) => { const t0 = Date.now(); await action(); await page.waitForTimeout(TAP); taps++; steps.push(`${taps}. ${desc} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); };
  const type = async (desc, text) => { for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(KEY); } chars += text.length; steps.push(`   ${desc}`); };
  // signed-in demo user, as it will be every day
  await page.goto(APP + `?demo=${who}&lang=ru#/`, { waitUntil: 'load' });
  await page.evaluate(({ key, route }) => {
    localStorage.removeItem('pacelam.demo');
    Object.keys(localStorage).filter((k) => k.startsWith('pacelam.lastRoute')).forEach((k) => localStorage.removeItem(k));
    if (route) localStorage.setItem(key, JSON.stringify(route));
  }, { key: `pacelam.lastRoute.${BORIS}`, route: lastRoute || null });
  await page.goto(APP + `?demo=${who}&lang=ru#/`, { waitUntil: 'load' });
  await page.waitForSelector('.offer__btn');
  const start = Date.now();
  await tap(cargo ? 'Нажать «Груз»' : 'Нажать «Транспорт»', () => page.click(cargo ? '.offer__btn--cargo' : '.offer__btn--truck'));
  await page.waitForSelector('.wroute');
  if (swap) await tap('Нажать ⇅ (обратный рейс)', () => page.click('.wroute__swap'));
  if (!lastRoute) {
    await tap('Нажать поле «Город…»', () => page.click('.wsearch input'));
    await type(`Набрать «${cargo ? 'dau' : 'rig'}»`, cargo ? 'dau' : 'rig');
    await tap(`Выбрать ${cargo ? 'Daugavpils' : 'Rīga'}`, () => page.locator('.wsearch__list .cityrow').first().click());
  }
  const route = `${await page.locator('.wpt--from .wpt__v').innerText()} → ${await page.locator('.wpt--to .wpt__v').innerText()}`;
  await tap('«Дальше» (карта)', () => page.click('.wiz__foot .btn--primary'));
  await page.waitForSelector('.cal');
  if (!cargo) await tap('Нажать «Завтра»', () => page.locator('.cal .chip').nth(1).click());
  await tap('«Дальше» (календарь)', () => page.click('.wiz__foot .btn--primary'));
  if (cargo) {
    await tap('Выбрать категорию «Паллеты»', () => page.locator('.wiz .chips .chip').first().click());
    await tap('Нажать «Вес»', () => page.getByLabel('Вес, кг').click());
    await type('Набрать «800»', '800');
  }
  await tap(cargo ? '«Дальше» (что везём)' : '«Дальше» (машина уже выбрана)', () => page.click('.wiz__foot .btn--primary'));
  await page.waitForSelector('.wcheck');
  await tap('«Опубликовать»', () => page.click('.wiz__foot .btn--primary'));
  await page.waitForSelector('.detail__route');
  const total = (Date.now() - start) / 1000;
  console.log(`\n=== ${label}: ${route} ===`);
  steps.forEach((s) => console.log('  ' + s));
  console.log(`  итого: ${total.toFixed(1)} s, касаний: ${taps}, символов: ${chars}${errors.length ? ', ОШИБКИ: ' + errors.join(' | ') : ''}`);
  results.push({ label, total, ok: total <= 20 && !errors.length });
  await ctx.close();
}

await run('A. Перевозчик, первый раз (город набирает)', { who: 'carrier' });
await run('B. Перевозчик, обычный день (последний маршрут первым)', { who: 'carrier', lastRoute: { from: { name: 'Daugavpils', lat: 55.87, lng: 26.52, radius: 0 }, to: { name: 'Rīga', lat: 56.95, lng: 24.11, radius: 0 } } });
await run('C. Перевозчик, обратный рейс (⇅)', { who: 'carrier', swap: true, lastRoute: { from: { name: 'Daugavpils', lat: 55.87, lng: 26.52, radius: 0 }, to: { name: 'Rīga', lat: 56.95, lng: 24.11, radius: 0 } } });
await run('D. Заказчик, груз, первый раз', { who: 'customer', cargo: true });
console.log('\nРЕЗУЛЬТАТ: ' + results.map((r) => `${r.label.split('.')[0]} ${r.total.toFixed(1)} s`).join(', ') + ` (лимит 20 s) → ${results.every((r) => r.ok) ? 'УКЛАДЫВАЕТСЯ' : 'НЕ УКЛАДЫВАЕТСЯ'}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
