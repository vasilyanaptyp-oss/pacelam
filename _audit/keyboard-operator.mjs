// Operator posts a phoned-in request using ONLY the keyboard (Tab / typing / Enter), no mouse.
// Also checks that every Tab stop on the operator form and on the desktop board has a visible focus.
// Run: BASE=https://.../pacelam/app/ node _audit/keyboard-operator.mjs
import { chromium } from 'playwright-core';

// BASE may be the site root or the app — both work, the same as timing.mjs and screens.mjs
const BASE = (process.env.BASE || 'http://localhost:5173/').replace(/\/?$/, '/').replace(/(app\/)?$/, 'app/');
const browser = await chromium.launch({ channel: 'chrome' });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  -- ' + detail : '')); };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ru-RU' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}?lang=ru&demo=operator#/`, { waitUntil: 'load' });
await page.waitForSelector('.tbl__row, .pcard');
check('demo=operator link signs the operator in', await page.evaluate(() => !!document.querySelector('.top__nav a[href="#/operator"]')));

// --- keyboard-only journey ---
await page.goto(`${BASE}?lang=ru#/operator`);
await page.waitForSelector('form.form--operator');
await page.waitForTimeout(200);
const active = () => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.name ? '[' + a.name + ']' : ''}${a.id ? '#' + a.id : ''} "${(a.getAttribute('aria-label') || a.textContent || a.placeholder || '').trim().slice(0, 24)}"` : 'none'; });
check(`focus lands on the first field on open (${await active()})`, await page.evaluate(() => document.activeElement?.tagName === 'INPUT' && document.activeElement.getAttribute('list') === 'pacelam-cities'));
const steps = [];
const t0 = Date.now();
const type = async (s) => { await page.keyboard.type(s, { delay: 60 }); };
await type('Daugav'); steps.push('Откуда: набрать «Daugav»');
await page.keyboard.press('Tab'); await type('Rīga'); steps.push('Tab → Куда: набрать «Rīga»');
await page.keyboard.press('Tab'); steps.push('Tab → Дата (оставить сегодня)');
await page.keyboard.press('Tab'); steps.push('Tab → Режим (оставить «Срочно»)');
await page.keyboard.press('Tab'); steps.push('Tab → Ждёт (оставить 1 ч — пойдёт обратный отсчёт)');
await page.keyboard.press('Tab'); steps.push('Tab → Категория (оставить «Автомобиль»)');
// dynamic vehicle fields: rolls, all_wheels, location, model
await page.keyboard.press('Tab'); await page.keyboard.press('ArrowDown'); steps.push('Tab → Катится: ↓ (Да)');
await page.keyboard.press('Tab'); await page.keyboard.press('ArrowDown'); steps.push('Tab → Все колёса: ↓ (Да)');
await page.keyboard.press('Tab'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); steps.push('Tab → Где стоит: ↓↓ (На обочине)');
await page.keyboard.press('Tab'); await type('Audi A4'); steps.push('Tab → Марка и модель: «Audi A4»');
await page.keyboard.press('Tab'); await type('1500'); steps.push('Tab → Вес: 1500');
await page.keyboard.press('Tab'); steps.push('Tab → Объём (пусто)');
await page.keyboard.press('Tab'); await type('4.6'); steps.push('Tab → Длина: 4.6');
await page.keyboard.press('Tab'); await type('1.8'); steps.push('Tab → Ширина: 1.8');
await page.keyboard.press('Tab'); await type('1.4'); steps.push('Tab → Высота: 1.4');
await page.keyboard.press('Tab'); steps.push('Tab → Нужная машина (любая)');
// since 23.09 the operator names no price either (only the carrier does): after the vehicle comes the note
await page.keyboard.press('Tab'); await type('Stāv pie veikala'); steps.push('Tab → Примечание: «Stāv pie veikala»');
await page.keyboard.press('Control+Enter'); steps.push('Ctrl+Enter → отправить');
await page.waitForSelector('.toast', { timeout: 5000 });
const elapsed = (Date.now() - t0) / 1000;
await page.waitForTimeout(400);
const toastText = await page.evaluate(() => document.querySelector('.toast')?.textContent || '');
check(`Enter posts the request (toast: "${toastText}")`, /Выложено/.test(toastText));
check('form cleared after posting (from/to empty)', await page.evaluate(() => [...document.querySelectorAll('form.form--operator input[list]')].every((i) => i.value === '')));
check(`focus returns to «Откуда» for the next call (${await active()})`, await page.evaluate(() => document.activeElement?.getAttribute('list') === 'pacelam-cities'));
check('date and mode are kept for the next call', await page.evaluate(() => { const sels = [...document.querySelectorAll('form.form--operator select')]; return sels[0].value !== '' && sels[1].value === 'urgent'; }));
await page.goto(`${BASE}?lang=ru#/my`);
await page.waitForSelector('.tabs');
await page.waitForTimeout(300);
const posted = await page.evaluate(() => [...document.querySelectorAll('.pcard')].map((c) => c.textContent.replace(/\s+/g, ' ')));
check('the posting appears in «Мои» with the Operator tag and Audi A4 route', posted.some((tx) => /Daugavpils.*Rīga/.test(tx) && /Оператор/.test(tx)), posted.slice(0, 2).join(' | '));
console.log('\nШаги (только клавиатура):'); steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`)); console.log(`  время: ${elapsed.toFixed(1)} s`);

// --- focus visibility on the board (desktop) and on the operator form ---
async function focusSweep(url, waitSel, label, maxTabs) {
  await page.goto(url); await page.waitForSelector(waitSel); await page.waitForTimeout(300);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  // every element is counted once by identity, not by its text: two buttons both named "Все" used to end the
  // sweep after 3 stops (audit 23.09, A-030)
  const bad = []; let n = 0;
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const key = el.dataset.sweep ? 'again' : (el.dataset.sweep = '1');
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow && cs.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      return { key, tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), visible: outline || shadow, w: Math.round(r.width), h: Math.round(r.height), hidden: cs.visibility === 'hidden' || r.width === 0 };
    });
    if (!info || info.key === 'again') break;   // back to an element already visited: the whole page is done
    n++;
    if (info.hidden) bad.push(`${info.tag} "${info.text}" focus on hidden element`);
    else if (!info.visible) bad.push(`${info.tag} "${info.text}" no visible focus`);
  }
  check(`${label}: ${n} tab stops, all with visible focus`, bad.length === 0, bad.join(' | '));
}
await focusSweep(`${BASE}?lang=ru#/`, '.tbl__row', 'board 1280', 200);
await focusSweep(`${BASE}?lang=ru#/operator`, 'form.form--operator', 'operator form', 80);
// Enter on a table row opens the details drawer without a page change
await page.goto(`${BASE}?lang=ru#/`); await page.waitForSelector('.tbl__row'); await page.waitForTimeout(200);
await page.locator('.tbl__row').first().focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('Enter on a row opens the details panel and keeps the URL', await page.evaluate(() => document.querySelector('.board__detail.is-open .detail') !== null && location.hash === '#/'));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check('Escape closes the details drawer at 1280', await page.evaluate(() => !document.querySelector('.board__detail.is-open')));
check('no page errors', errors.length === 0, errors.join(' | '));
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
await browser.close();
process.exit(failures ? 1 : 0);
