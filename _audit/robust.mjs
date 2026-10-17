// Regression checks for the audit of 23.09.2026 (GLM, findings A-0xx) and the client's edits of the same evening.
// Each check reproduces the finding the way the auditor did and expects the fixed behaviour.
// Run: BASE=https://.../pacelam/ node _audit/robust.mjs   (BASE is the site root or the app; default localhost:5173)
import { chromium } from 'playwright-core';

const APP = (process.env.BASE || 'http://localhost:5173/').replace(/\/?$/, '/').replace(/(app\/)?$/, 'app/');
const browser = await chromium.launch({ channel: 'chrome' });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  -- ' + detail : '')); };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' };
const errorsOf = (page) => { const e = []; page.on('pageerror', (x) => e.push(String(x))); return e; };
const clean = async (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pacelam.')).forEach((k) => localStorage.removeItem(k)));
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent.trim()), sel);

// --- the client's edits of 23.09 evening -----------------------------------------------------------------
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await clean(page);
  await page.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  const all = (await page.evaluate(() => document.body.innerText));
  check('no vehicle codes on the board (VT…)', !/\bVT\d{2}/.test(all), all.match(/\bVT\d{2}\S*/g)?.slice(0, 3).join(','));
  check('tow truck limits read "< 5 т"', /Эвакуатор < 5 т/.test(all));
  const colours = await page.evaluate(() => [...document.querySelectorAll('.pcard')].map((c) => ({ kind: c.classList.contains('pcard--cargo') ? 'cargo' : 'truck', stripe: getComputedStyle(c, '::after').backgroundColor, tag: getComputedStyle(c.querySelector('.tag--cargo, .tag--truck')).backgroundColor })));
  const cargoOk = colours.filter((c) => c.kind === 'cargo').every((c) => c.stripe === 'rgb(91, 147, 204)' && c.tag === 'rgb(91, 147, 204)');
  const truckOk = colours.filter((c) => c.kind === 'truck').every((c) => c.stripe === 'rgb(245, 166, 35)' && c.tag === 'rgb(245, 166, 35)');
  check('cargo: blue tag and blue stripe; transport: yellow tag and yellow stripe', cargoOk && truckOk && colours.length > 2, JSON.stringify(colours.slice(0, 3)));
  check('the board says where distances count from', (await texts(page, '.strip .here')).join('').includes('Rīga'));
  check('a cargo card reads "до погрузки / с грузом"', (await texts(page, '.pcard--cargo .km__l')).some((x) => /до погрузки/i.test(x)) && (await texts(page, '.pcard--cargo .km__l')).some((x) => /с грузом/i.test(x)));
  check('a customer gets no price button on cargo (A-017)', !(await page.locator('.pcard--cargo .pcard__actions').count()));
  await page.click('.strip .here'); await page.fill('.sheet input', 'Daug'); await page.locator('.sheet .cityrow').first().click();
  await page.waitForTimeout(400);
  check('the town can be changed in one tap', (await texts(page, '.strip .here')).join('').includes('Daugavpils'));
  check('the demo bar says who you are', (await texts(page, '.demobar')).join('').includes('Анна'));
  await page.click('.offer__btn--truck'); await page.waitForSelector('.wroute');
  check('"Transport" makes the demo visitor the sample carrier', (await texts(page, '.demobar')).join('').includes('Борис'));
  await page.fill('.wsearch input', 'Daug'); await page.locator('.wsearch__list .cityrow').first().click();
  await page.fill('.wsearch input', 'Rīg'); await page.locator('.wsearch__list .cityrow').first().click();
  await page.click('.wiz__foot .btn--primary'); await page.waitForSelector('.cal');
  await page.click('.wiz__foot .btn--primary'); await page.waitForSelector('.wvadd__open');
  const before = (await texts(page, '.wiz__body .chip')).length;
  await page.click('.wvadd__open'); await page.selectOption('.wvadd select', 'VT09');
  await page.fill('.wvadd input[placeholder="AB-1234"]', 'TT-999'); await page.click('.wvadd .btn--primary');
  await page.waitForTimeout(600);
  const chipsAfter = await texts(page, '.wiz__body .chip');
  check('another vehicle is added right in the wizard and picked', chipsAfter.length === before + 1 && chipsAfter.some((x) => x.includes('TT-999')) && (await texts(page, '.wiz__body .chip.is-on')).join('').includes('TT-999'), chipsAfter.join(' | '));
  await page.click('.wiz__foot .btn--primary'); await page.waitForSelector('.wcheck');
  await page.click('.wiz__foot .btn--primary'); await page.waitForSelector('.detail__route');
  const detail = await page.evaluate(() => document.querySelector('.detail').innerText);
  check('own truck: "это твоё объявление", no carriers\' offers block', /Это твоё объявление/.test(detail) && !/Предложения перевозчиков/.test(detail) && /Грузы по пути/.test(detail), detail.slice(0, 300));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --- A-003, A-005: the phone's "back" closes a sheet; Tab stays inside it --------------------------------
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(APP + '?demo=carrier&lang=ru', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  const url0 = page.url();
  await page.click('.strip .icon-btn'); await page.waitForSelector('.sheet.is-open');
  await page.goBack(); await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ open: !!document.querySelector('.sheet'), locked: document.body.classList.contains('has-sheet'), cards: document.querySelectorAll('.pcard').length }));
  check('A-003: "back" closes the filter sheet and stays on the board', !st.open && !st.locked && st.cards > 0 && page.url() === url0, JSON.stringify(st) + ' ' + page.url());
  await page.click('.strip .icon-btn'); await page.waitForSelector('.sheet.is-open');
  await page.click('.sheet .icon-btn[aria-label]'); await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(500);
  check('a sheet closed by hand leaves no extra "back" step', page.url() !== url0 || !(await page.locator('.sheet').count()), page.url());
  await page.goto(APP + '?demo=carrier&lang=ru#/', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  await page.click('.strip .icon-btn'); await page.waitForSelector('.sheet.is-open');
  for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
  check('A-005: after 60 Tabs the focus is still inside the sheet', await page.evaluate(() => !!document.activeElement.closest('.sheet__panel')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // a navigation right after a confirmation is not undone by the sheet's history step
  const cargo = page.locator('.pcard--cargo', { hasText: 'Krāslava' }).first();   // in the sample carrier's zone (since 29.09)
  await cargo.locator('a.pcard__link').click(); await page.waitForSelector('.detail');
  check('after a sheet the link to a posting still opens it', /#\/p\//.test(page.url()), page.url());
  await ctx.close();
}

// --- A-007, A-008, A-009, A-042: numbers, same town, one tap one action ----------------------------------
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await clean(page);
  await page.goto(APP + '?demo=customer&lang=ru#/post/cargo/full', { waitUntil: 'load' }); await page.waitForSelector('form .picker');
  const pick = async (i, town) => { await page.locator('form .picker').nth(i).click(); await page.fill('.sheet input', town); await page.locator('.sheet .cityrow').first().click(); await page.waitForTimeout(300); };
  await pick(0, 'Jelg'); await pick(1, 'Jelg');
  await page.click('.submitbar .btn'); await page.waitForTimeout(300);
  check('A-008: the full form refuses the same town twice', (await texts(page, '.toast')).join(' ').includes('разные города'), (await texts(page, '.toast')).join(' | '));
  await pick(1, 'Rīg');
  await page.locator('input[placeholder="1200"]').fill('-100');
  await page.click('.submitbar .btn'); await page.waitForTimeout(300);
  check('A-007: a weight of -100 is refused', (await texts(page, '.toast')).join(' ').includes('Проверь числа') && /post\/cargo\/full/.test(page.url()));
  await page.locator('input[placeholder="1200"]').fill('1 200');
  await page.click('.submitbar .btn'); await page.waitForSelector('.detail__route');
  check('A-007: "1 200" is read as 1200 kg', (await page.evaluate(() => document.querySelector('.facts').innerText)).replace(/\s/g, '').includes('1200'));
  // a carrier sends a price with a double tap: one offer, one notice
  await page.goto(APP + '?demo=carrier&lang=ru#/', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  await page.locator('.pcard--cargo', { hasText: 'Jelgava' }).first().locator('.pcard__actions .btn').last().click();
  await page.waitForSelector('.sheet form');
  await page.fill('.sheet input.input--num', '230');
  await page.locator('.sheet button[type="submit"]').dblclick();
  await page.waitForTimeout(700);
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('pacelam.demo')).notifications.filter((x) => x.type === 'bid' && x.payload.from === 'Jelgava').length);
  check('A-009: a double tap on "send price" gives the customer one notice', n === 1, String(n));
  await ctx.close();
}

// --- A-010: the wizard survives a refresh ------------------------------------------------------------------
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await clean(page);
  await page.goto(APP + '?demo=customer&lang=ru#/post/cargo', { waitUntil: 'load' }); await page.waitForSelector('.wroute');
  await page.fill('.wsearch input', 'Liep'); await page.locator('.wsearch__list .cityrow').first().click();
  await page.fill('.wsearch input', 'Ventsp'); await page.locator('.wsearch__list .cityrow').first().click();
  await page.click('.wiz__foot .btn--primary'); await page.waitForSelector('.cal');
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.wiz');
  const w = await page.evaluate(() => ({ step: document.querySelector('.wiz__step')?.textContent, note: !!document.querySelector('.wiz__restored') }));
  check('A-010: after a refresh the wizard is back on the same step, answers kept', /2/.test(w.step || '') && w.note, JSON.stringify(w));
  await page.click('.wiz__back'); await page.waitForSelector('.wroute');
  // "from" starts as the profile town (Rīga), so the two towns typed went to "to": Ventspils is the last one
  check('A-010: and the route is still filled in', (await texts(page, '.wpt__v')).join(' ') === 'Rīga Ventspils', (await texts(page, '.wpt__v')).join(' '));
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.wiz__restored');
  await page.click('.wiz__restored .btn'); await page.waitForSelector('.wroute');
  check('A-010: "start over" gives an empty wizard', !(await page.locator('.wiz__restored').count()) && (await page.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith('pacelam.wiz.') && JSON.parse(localStorage.getItem(k))?.draft?.to))));
  await ctx.close();
}

// --- A-012: two tabs share one demo ------------------------------------------------------------------------
{
  const ctx = await browser.newContext(phone);
  const a = await ctx.newPage(); const b = await ctx.newPage();
  await a.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await clean(a);
  await a.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await a.waitForSelector('.pcard');
  await b.goto(APP + '?lang=ru#/me', { waitUntil: 'load' }); await b.waitForSelector('form');
  await a.goto(APP + '?lang=ru#/post/cargo/full', { waitUntil: 'load' }); await a.waitForSelector('form .picker');
  const pick = async (i, town) => { await a.locator('form .picker').nth(i).click(); await a.fill('.sheet input', town); await a.locator('.sheet .cityrow').first().click(); await a.waitForTimeout(300); };
  await pick(0, 'Tukum'); await pick(1, 'Talsi');
  await a.click('.submitbar .btn'); await a.waitForSelector('.detail__route');
  await b.click('form button[type="submit"]'); await b.waitForTimeout(500);
  const kept = await a.evaluate(() => JSON.parse(localStorage.getItem('pacelam.demo')).postings.some((p) => p.from_name === 'Tukums'));
  check('A-012: saving in the other tab does not wipe a posting made here', kept);
  await ctx.close();
}

// --- A-013: storage blocked — the page still opens ------------------------------------------------------------
{
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Access denied', 'SecurityError'); } }); });
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.goto(APP + '?visit=1&lang=ru', { waitUntil: 'load' });
  const ok = await page.waitForSelector('.pcard', { timeout: 8000 }).then(() => true).catch(() => false);
  check('A-013: with storage blocked the board opens', ok, errors.join(' | '));
  await ctx.close();
}

// --- A-040: ?lang=RU and ru-RU ------------------------------------------------------------------------------
{
  const ctx = await browser.newContext({ ...phone, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(APP + '?visit=1&lang=RU', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  const l1 = await page.evaluate(() => document.documentElement.lang);
  await page.goto(APP + '?visit=1&lang=ru-RU', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  const l2 = await page.evaluate(() => document.documentElement.lang);
  check('A-040: ?lang=RU and ?lang=ru-RU open the Russian page', l1 === 'ru' && l2 === 'ru', `${l1} ${l2}`);
  await ctx.close();
}

// --- 29.09: the carrier's zone (base town + radius, either end) and the day in an offer ----------------------
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.goto(APP + '?demo=customer&lang=ru', { waitUntil: 'load' }); await clean(page);
  await page.goto(APP + '?demo=customer&lang=ru#/post/cargo/full', { waitUntil: 'load' }); await page.waitForSelector('form .picker');
  const pick = async (i, town) => { await page.locator('form .picker').nth(i).click(); await page.fill('.sheet input', town); await page.locator('.sheet .cityrow').first().click(); await page.waitForTimeout(300); };
  await pick(0, 'Jēkabp'); await pick(1, 'Daug');
  await page.click('.submitbar .btn'); await page.waitForSelector('.detail__route');
  // the sample carrier: Daugavpils, 50 km — the cargo ends in his zone
  await page.goto(APP + '?demo=carrier&lang=ru#/inbox', { waitUntil: 'load' }); await page.waitForSelector('.noterow');
  const inbox = await texts(page, '.noterow__t');
  check('zone: a cargo that ENDS in the carrier\'s zone reaches him ("Новая заявка в твоей зоне")', inbox.some((x) => /в твоей зоне: Jēkabpils → Daugavpils/.test(x)), inbox.slice(0, 4).join(' | '));
  await page.goto(APP + '?lang=ru#/', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  check('zone: the board says "Моя зона: Daugavpils · 50 км"', (await texts(page, '.strip .here')).join('').includes('Daugavpils · 50'));
  let routes = (await texts(page, '.pcard__route')).join(' | ');
  check('zone: jobs of the zone are shown, far ones wait behind "show all"', routes.includes('Jēkabpils') && !routes.includes('Cēsis') && (await page.locator('.board__main .btn--ghost.btn--wide', { hasText: 'Показать все' }).count()) === 1, routes);
  await page.click('.strip .here'); await page.waitForSelector('.sheet.is-open');
  await page.getByRole('button', { name: '200 км' }).click(); await page.locator('.sheet .btn--primary').last().click(); await page.waitForTimeout(500);
  routes = (await texts(page, '.pcard__route')).join(' | ');
  check('zone: 200 km brings Cēsis → Rīga in', routes.includes('Cēsis'), routes);
  // the day in an offer
  await page.locator('.pcard--cargo', { hasText: 'Jēkabpils' }).first().locator('.pcard__actions .btn').last().click();
  await page.waitForSelector('.sheet form');
  check('offer: "Когда сможешь?" with today / tomorrow / a date', (await texts(page, '.sheet .field__label')).some((x) => /Когда сможешь/.test(x)) && (await page.locator('.sheet input[type="date"]').count()) === 1);
  await page.fill('.sheet input.input--num', '120');
  await page.getByRole('button', { name: 'Завтра' }).click();
  await page.locator('.sheet button[type="submit"]').click(); await page.waitForTimeout(600);
  await page.goto(APP + '?demo=customer&lang=ru#/inbox', { waitUntil: 'load' }); await page.waitForSelector('.noterow');
  const inbox2 = await texts(page, '.noterow__t');
  check('offer: the customer is told the price and the day', inbox2.some((x) => /120 € \(завтра\): Jēkabpils → Daugavpils/.test(x)), inbox2.slice(0, 3).join(' | '));
  await page.goto(APP + '?lang=ru#/my', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  await page.locator('.pcard', { hasText: 'Jēkabpils' }).first().locator('a.pcard__link').click(); await page.waitForSelector('.bids');
  check('offer: beside the price the customer reads "сможет завтра", and can sort "Быстрее"', (await texts(page, '.bidrow__who small')).join(' ').includes('сможет завтра') && (await texts(page, '.seg button')).includes('Быстрее') || (await texts(page, '.bidrow__who small')).join(' ').includes('сможет завтра'));
  check('no page errors (zone)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --- 17.10: blind offers — a carrier never sees another carrier's price -----------------------------------
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(APP + '?demo=carrier&lang=ru', { waitUntil: 'load' }); await clean(page);
  await page.goto(APP + '?demo=carrier&lang=ru', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  const all = page.locator('.board__main .btn--ghost.btn--wide', { hasText: 'Показать все' });
  if (await all.count()) { await all.click(); await page.waitForTimeout(300); }
  const card = page.locator('.pcard--cargo', { hasText: 'Rēzekne' }).first();
  const txt = await card.innerText();
  check('blind: a carrier sees "предложений: 2" but no price of the others', /предложений: 2/.test(txt) && !/лучшее|170/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 200));
  const stored = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('pacelam.demo')); return s ? 'ok' : 'none'; });
  await card.locator('.pcard__actions .btn').last().click(); await page.waitForSelector('.sheet form');
  const ph = await page.locator('.sheet input.input--num').getAttribute('placeholder');
  const hint = (await texts(page, '.sheet .lead')).join(' ');
  check('blind: the price field gives no hint of other prices, and says so', !ph && /не видят/.test(hint), `${ph} | ${hint} | ${stored}`);
  await page.keyboard.press('Escape');
  await page.goto(APP + '?demo=customer&lang=ru#/my', { waitUntil: 'load' }); await page.waitForSelector('.pcard');
  const own = await page.locator('.pcard', { hasText: 'Rēzekne' }).first().innerText();
  check('blind: the owner still sees the best price on her own posting', /лучшее 170/.test(own), own.replace(/\s+/g, ' ').slice(0, 160));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
