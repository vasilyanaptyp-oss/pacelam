// The whole minimal version, both roles, on a phone: every screen, every tap counted, every screen measured.
// Used by after.mjs (screenshots at 390) and check.mjs (360 / 390 / 412, assertions only).
import path from 'node:path';
import { phone } from './lib.mjs';

// What a 55-year-old driver meets on the screen, in numbers.
export const measure = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
  const top = [...document.querySelectorAll('.sheet.is-open')].pop() || document.body;
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  // the map credit is a legal line, not a control of the app
  const taps = [...top.querySelectorAll('a[href],button,input,select,textarea')].filter((el) => vis(el) && !el.closest('.map__attr') && !el.closest('.leaflet-container') && !el.classList.contains('skip'));
  const low = taps.filter((el) => el.getBoundingClientRect().height < 47.5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().height)}px`);
  // gaps between neighbours that are both on the screen and scroll together
  let minGap = 99; let gapPair = '';
  const fixed = (el) => !!el.closest('.bar,.foot');
  const list = taps.filter(inView);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.contains(b) || b.contains(a) || fixed(a) !== fixed(b)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const dx = Math.max(0, Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right));
    const dy = Math.max(0, Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom));
    const gap = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
    if (gap < minGap) { minGap = gap; gapPair = `${a.className} | ${b.className}`; }
  }
  // text: size and contrast against what is really behind it
  const rgb = (c) => { const m = c.match(/[\d.]+/g) || []; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] == null ? 1 : +m[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  let minFont = 99; let minContrast = 99; let words = 0; const smallText = []; const weak = [];
  const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const txt = n.textContent.trim(); if (!txt) continue;
    const el = n.parentElement; if (!el || !vis(el) || el.closest('.sr-only,script,style,.skip,option')) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    words += txt.split(/\s+/).length;
    if (fs < minFont) minFont = fs;
    if (fs < 16) smallText.push(`${txt.slice(0, 20)} ${fs}px`);
    const l1 = lum(rgb(cs.color)), l2 = lum(bgOf(el));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < minContrast) minContrast = ratio;
    if (ratio < 4.5) weak.push(`${txt.slice(0, 20)} ${ratio.toFixed(1)}`);
  }
  const h1 = document.querySelectorAll('.view h1').length;
  const main = [...document.querySelectorAll('.foot .btn--main')].filter(vis);
  return { taps: taps.length, tapsOnScreen: list.length, words, minFont, minContrast: Math.round(minContrast * 10) / 10, low, smallText, weak, minGap: Math.round(minGap), gapPair, screens: Math.round((document.documentElement.scrollHeight / innerHeight) * 10) / 10, hscroll: document.documentElement.scrollWidth > innerWidth + 1, h1, mainButtons: main.length, mainVisible: main.every((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) };
});

export async function tour(base, { width = 390, height = 844, lang = 'ru', out = null, tiles = false } = {}) {
  const { browser, ctx, page, errors } = await phone({ width, height });
  if (tiles) await ctx.unroute(/tile\.openstreetmap\.org/);
  const screens = []; const failed = []; const flows = {};
  let taps = 0;
  const shot = async (name, note = '') => {
    await page.waitForTimeout(tiles ? 1500 : 350);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((el) => el.remove()));   // a passing line of news is not part of the screen
    if (out) await page.screenshot({ path: path.join(out, name + '.png') });
    screens.push({ name, note, ...(await measure(page)) });
  };
  const step = async (name, fn) => { try { await fn(); } catch (e) { failed.push(`${name}: ${String(e.message).split('\n')[0]}`); } };
  const tap = async (loc) => { await loc.first().click(); taps++; await page.waitForTimeout(250); };
  const main = () => page.locator('.foot .btn--main');
  const cardWith = (text) => page.locator('.card', { hasText: text });
  const switchRole = async (door) => { await page.locator('.bar a[href="#/me"]').click(); await page.locator('a[href="#/start"]').click(); await page.locator('.door').nth(door).click(); await page.waitForSelector('.screen h1'); await page.waitForTimeout(250); };
  const L = { ru: { car: 'Автомобиль', send: 'Отправить' }, lv: { car: 'Automašīna' }, en: { car: 'Vehicle' } }[lang];

  await step('start', async () => { await page.goto(`${base}app/?lang=${lang}`, { waitUntil: 'load' }); await page.waitForSelector('.door'); await shot('01-start', 'вход: две кнопки'); });

  // ---- customer: a new request ----
  await step('customer-new', async () => {
    taps = 0;
    await tap(page.locator('.door').nth(0)); await page.waitForSelector('.cards');
    await shot('02-my-requests', 'заказчик: мои заявки');
    taps = 0;   // from the list a returning customer opens on; a new one comes here straight from the first door, the same count
    await tap(main()); await page.waitForSelector('.chips');
    await shot('03-new-1-what', 'новая заявка 1/3: что везём');
    await tap(page.locator('.chip', { hasText: L.car }));
    await page.fill('label.field .input >> nth=0', 'VW Golf 2015');
    await page.locator('.field', { hasText: /Вес|Svars|Weight/ }).locator('input').fill('1300');
    await shot('03-new-1-what-filled', 'новая заявка 1/3: выбрано');
    await tap(main()); await page.waitForSelector('.pt');
    await shot('04-new-2-where', 'новая заявка 2/3: откуда → куда');
    await page.fill('.search input', 'Daug'); await tap(page.locator('.search .row'));
    await shot('04-new-2-where-set', 'новая заявка 2/3: выбрано');
    await tap(main()); await page.waitForSelector('.opt');
    await shot('05-new-3-when', 'новая заявка 3/3: когда');
    await tap(main()); await page.waitForSelector('.facts');
    flows.customer_new_request = taps;
    await shot('06-request-sent', 'заявка отправлена, ждём цены');
  });
  await step('customer-prices', async () => {
    await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
    await cardWith('Rēzekne').click(); await page.waitForSelector('.offer');
    await shot('07-request-prices', 'заявка с ценами');
  });

  // ---- carrier: offer a price ----
  await step('carrier-offer', async () => {
    await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
    await switchRole(1);
    await page.waitForSelector('.cards');
    await shot('10-jobs', 'перевозчик: заявки рядом');
    await page.locator('.pill').click(); await page.waitForSelector('.sheet.is-open');
    await shot('11-where', 'где ищу');
    await page.locator('.sheet .icon-btn').click(); await page.waitForTimeout(300);
    taps = 0;
    await tap(cardWith('Rīga → Daugavpils')); await page.waitForSelector('.facts');
    await shot('12-job', 'заявка глазами перевозчика');
    await tap(main()); await page.waitForSelector('.sheet.is-open');
    await page.fill('.sheet .input--big', '150');
    await shot('13-price', 'цена');
    await tap(page.locator('.sheet .btn--main')); await page.waitForTimeout(400);
    flows.carrier_offer_price = taps;
    await shot('14-job-my-price', 'цена отправлена');
    await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
    await shot('15-jobs-my-price', 'список: моя цена первой');
  });

  // ---- customer: pick a carrier ----
  await step('customer-pick', async () => {
    await switchRole(0);
    await page.waitForSelector('.cards');
    await shot('20-my-requests-price', 'заказчик: пришла цена');
    taps = 0;
    await tap(cardWith('Rīga → Daugavpils')); await page.waitForSelector('.offer');
    await shot('21-request-one-price', 'заявка с ценой');
    await tap(page.locator('.offer .btn--fill')); await page.waitForSelector('.sheet.is-open');
    await shot('22-pick-confirm', 'выбрать?');
    await tap(page.locator('.sheet .btn--main')); await page.waitForSelector('.round--fill');
    flows.customer_pick_carrier = taps;
    await shot('23-deal-customer', 'договорились: телефон перевозчика');
    const tel = await page.locator('.round--fill').getAttribute('href');
    if (!/^tel:\+?\d{6,}/.test(tel || '')) throw new Error('no phone after the deal: ' + tel);
  });

  // ---- carrier: the deal, a trip, the profile ----
  await step('carrier-deal', async () => {
    await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
    await switchRole(1);
    await page.waitForSelector('.cards');
    await shot('30-jobs-deal', 'перевозчик: сделка первой в списке');
    await page.locator('.card').first().click(); await page.waitForSelector('.round--fill');
    await shot('31-deal-carrier', 'договорились: телефон заказчика');
  });
  await step('carrier-trip', async () => {
    await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
    taps = 0;
    await tap(page.locator('.pill')); await page.waitForSelector('.sheet.is-open');
    await tap(page.locator('.sheet .btn--wide', { hasText: /рейс|reisu|trip/i })); await page.waitForSelector('.pt');
    await page.fill('.search input', 'Rīga'); await tap(page.locator('.search .row'));
    await shot('32-trip-1-where', 'пустой рейс 1/2');
    await tap(main()); await page.waitForSelector('.opt');
    await shot('33-trip-2-when', 'пустой рейс 2/2');
    await tap(main()); await page.waitForSelector('.cards');
    flows.carrier_post_trip = taps;
    await shot('34-jobs-trip', 'список с рейсом');
    await page.locator('.pill').click(); await page.waitForSelector('.sheet.is-open');
    await shot('35-where-trip', 'где ищу: рейс');
    await page.locator('.sheet .icon-btn').click(); await page.waitForTimeout(300);
  });
  await step('profile', async () => {
    await page.locator('.bar a[href="#/me"]').click(); await page.waitForSelector('form');
    await shot('36-profile', 'профиль перевозчика');
    await page.locator('.btn', { hasText: /Добавить машину|Pievienot transportu|Add a vehicle/ }).click(); await page.waitForSelector('.sheet.is-open');
    await shot('37-vehicle', 'добавить машину');
    await page.locator('.sheet .icon-btn').click(); await page.waitForTimeout(300);
  });
  // ---- rules that must hold ----
  const rules = {};
  await step('rules', async () => {
    // a carrier never sees another carrier's price: Rēzekne → Rīga has offers of 170 and 190
    await page.goto(`${base}app/?lang=${lang}#/list`, { waitUntil: 'load' }); await page.waitForSelector('.cards');
    await page.locator('.btn--wide', { hasText: /Показать все|Rādīt visus|Show all/ }).click(); await page.waitForTimeout(300);
    const listText = await page.locator('.view').innerText();
    await cardWith('Rēzekne').click(); await page.waitForSelector('.facts');
    const jobText = await page.locator('.view').innerText();
    rules.blind = !/1[79]0\s*€/.test(listText) && !/1[79]0\s*€/.test(jobText);
    rules.noPhoneBeforeDeal = !/\+37\d/.test(jobText) && (await page.locator('a[href^="tel:"]').count()) === 0;
    // the customer has no price field anywhere in the request
    await page.goto(`${base}app/?lang=${lang}#/list`, { waitUntil: 'load' }); await page.waitForSelector('.cards');
    await switchRole(0);
    await page.goto(`${base}app/?lang=${lang}#/new`, { waitUntil: 'load' }); await page.waitForSelector('.chips');
    const step1 = await page.locator('.view').innerText();
    rules.customerNoPrice = !/€/.test(step1);
    // and gets no "offer a price" button on somebody else's cargo
    await page.goto(`${base}app/?lang=${lang}#/list`, { waitUntil: 'load' }); await page.waitForSelector('.cards');
    rules.customerSeesOnlyOwn = (await page.locator('.card').count()) > 0 && !(await page.locator('.card', { hasText: 'Jelgava' }).count());
  });

  await browser.close();
  return { width, lang, screens, flows, failed, errors, rules };
}

// A screen passes when nothing scrolls sideways, letters are 16 px and up, contrast is AA and up,
// everything tappable is 48 px high with 8 px between neighbours, and the main button is one and on the screen.
export function verdict(r) {
  const bad = [];
  for (const s of r.screens) {
    if (s.hscroll) bad.push(`${s.name}: horizontal scroll`);
    if (s.minFont < 16) bad.push(`${s.name}: text below 16 px (${s.smallText.slice(0, 3).join('; ')})`);
    if (s.minContrast < 4.5) bad.push(`${s.name}: contrast below AA (${s.weak.slice(0, 3).join('; ')})`);
    if (s.low.length) bad.push(`${s.name}: lower than 48 px: ${s.low.slice(0, 4).join('; ')}`);
    if (s.minGap < 8) bad.push(`${s.name}: gap ${s.minGap} px between ${s.gapPair}`);
    if (s.mainButtons > 1) bad.push(`${s.name}: ${s.mainButtons} main buttons`);
    if (!s.mainVisible) bad.push(`${s.name}: main button off the screen`);
  }
  for (const [k, v] of Object.entries(r.rules)) if (!v) bad.push(`rule broken: ${k}`);
  return [...bad, ...r.failed.map((f) => 'step failed: ' + f), ...r.errors.map((e) => 'console: ' + e)];
}
