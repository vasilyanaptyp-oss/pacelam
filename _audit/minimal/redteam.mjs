// Red team: the minimal version attacked on purpose. Each case tries to break one thing a tired driver, a bad
// connection or a curious visitor will break sooner or later. A case passes when the app stays up, says what is
// wrong in words, keeps the rules, and logs nothing to the console.
//   node _audit/minimal/redteam.mjs [id ...]   → birza/shots_1011/redteam.json, exit 1 when something got through
import path from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import { serve, chromium, outDir, ROOT } from './lib.mjs';

const only = process.argv.slice(2);
const srv = await serve();
const base = srv.base;
const browser = await chromium.launch({ channel: 'chrome' });
const GREY = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4+/j5fwAI7wOnqOhdJgAAAABJRU5ErkJggg==', 'base64');
const results = [];
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

async function attack(id, title, fn, { width = 390, height = 844, init = null, allowErrors = false } = {}) {
  if (only.length && !only.includes(id)) return;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ru-RU', geolocation: { latitude: 55.87, longitude: 26.52 }, permissions: ['geolocation'] });
  await ctx.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: GREY }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let v;
  try { v = { ok: true, note: (await fn(page, ctx)) || '' }; } catch (e) { v = { ok: false, note: String(e.message).split('\n')[0].slice(0, 260) }; }
  if (v.ok && errors.length && !allowErrors) v = { ok: false, note: errors[0].slice(0, 200) };
  results.push({ id, title, ...v });
  console.log(`${v.ok ? 'ok  ' : 'FAIL'} ${id.padEnd(4)} ${title}${v.note ? '  →  ' + v.note : ''}`);
  await ctx.close();
}

// ---- small steps ----
const open = async (page, q = '', hash = '') => { await page.goto(`${base}app/?lang=ru${q}${hash}`, { waitUntil: 'load' }); await page.waitForTimeout(400); };
const asCustomer = async (page) => { await open(page, '&demo=customer'); await page.waitForSelector('.cards'); };
const asCarrier = async (page) => { await open(page, '&demo=carrier'); await page.waitForSelector('.cards'); };
const main = (page) => page.locator('.foot .btn--main');
const db = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pacelam.demo') || 'null'));
const ANNA = 'd0000000-0000-4000-8000-000000000002';
const BORIS = 'd0000000-0000-4000-8000-000000000001';
const toasts = async (page) => (await page.locator('.toast').allInnerTexts()).join(' | ');
const title = (page) => page.locator('.view h1').first().innerText();
const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
async function startRequest(page, cat = 'Паллеты') {
  await asCustomer(page); await main(page).click(); await page.waitForSelector('.chips');
  await page.locator('.chip', { hasText: cat }).click(); await page.waitForTimeout(200);
}
const weight = (page) => page.locator('.field', { hasText: 'Вес' }).locator('input');
async function toWhere(page) { await main(page).click(); await page.waitForSelector('.pt'); }
async function setTo(page, text = 'Daug') { await page.fill('.search input', text); await page.locator('.search .row').first().click(); await page.waitForTimeout(150); }
async function toWhen(page) { await main(page).click(); await page.waitForSelector('.opt'); }
async function send(page) { await main(page).click(); await page.waitForSelector('.facts'); await page.waitForTimeout(300); return page.url().split('#/p/')[1]; }
async function quickRequest(page, { cat = 'Паллеты', to = 'Daug', before = null } = {}) {
  await startRequest(page, cat);
  if (before) await before(page);
  await toWhere(page); await setTo(page, to); await toWhen(page);
  return send(page);
}
const day = (n) => { const d = new Date(Date.now() + n * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

// ============================ the attacks ============================

await attack('R1', 'Хранилище телефона заблокировано', async (page) => {
  await open(page);
  await page.waitForSelector('.door');
  await page.locator('.door--cargo').click();
  await page.waitForSelector('.cards, .chips');
  await page.goto(`${base}app/?lang=ru#/start`); await page.waitForSelector('.door');
  await page.locator('.door--truck').click();
  await page.waitForSelector('.cards');
  must((await page.locator('.card').count()) > 0, 'список перевозчика пуст');
}, { init: () => { const no = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no; } });

await attack('R2', 'Мусор в адресе', async (page) => {
  const bad = ['#/p/not-an-id', '#/p/', '#/p/<script>alert(1)</script>', '#/new/99', '#/new/-1', '#/trip/0', '#/unknown', '#/list/extra/more', '#/me', '#/hello', '#/auth', '#//', '#/p/%00', '#/operator', '#/post/cargo/full'];
  const blank = [];
  for (const withRole of [false, true]) {
    for (const hsh of bad) {
      await page.goto(`${base}app/?lang=ru${withRole ? '&demo=customer' : ''}${hsh}`, { waitUntil: 'load' });
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => ({ text: document.querySelector('#view').innerText.trim().length, way: !!document.querySelector('.bar .round--plain, .door, .foot .btn--main') }));
      if (!state.text || !state.way) blank.push(`${withRole ? 'роль' : 'гость'} ${hsh}`);
    }
  }
  must(!blank.length, 'пустой экран или тупик: ' + blank.join(', '));
});

await attack('R3', 'Код в тексте заявки (XSS)', async (page) => {
  const evil = '"><img src=x onerror="window.__xss=1">';
  await quickRequest(page, { cat: 'Автомобиль', before: async (p) => { await p.locator('label.field .input').first().fill(evil); await p.fill('textarea', '<script>window.__xss=2</script><b onmouseover=window.__xss=3>x</b>'); } });
  must((await page.locator('.view').innerText()).includes('onerror'), 'текст не показан как текст');
  await asCarrier(page);
  await page.locator('.card', { hasText: 'onerror' }).first().click(); await page.waitForSelector('.facts');
  await page.waitForTimeout(300);
  const hit = await page.evaluate(() => window.__xss);
  must(hit === undefined, 'код из заявки выполнился: ' + hit);
  must((await page.locator('.view img[src="x"]').count()) === 0, 'в страницу попал чужой тег');
});

await attack('R4', 'Очень длинные слова, экран 320', async (page) => {
  const long = 'W'.repeat(58);
  await quickRequest(page, { cat: 'Автомобиль', before: async (p) => { await p.locator('label.field .input').first().fill(long); await p.fill('textarea', 'Q'.repeat(400)); } });
  must(!(await hscroll(page)), 'заявка заказчика уезжает вбок');
  await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
  must(!(await hscroll(page)), 'список заказчика уезжает вбок');
  await asCarrier(page);
  must(!(await hscroll(page)), 'список перевозчика уезжает вбок');
  await page.locator('.card', { hasText: 'WWWW' }).first().click(); await page.waitForSelector('.facts');
  must(!(await hscroll(page)), 'заявка у перевозчика уезжает вбок');
}, { width: 320, height: 568 });

await attack('R5', 'Кривые числа в заявке', async (page) => {
  await startRequest(page, 'Паллеты');
  const through = [];
  for (const bad of ['-5', '0', 'abc', '1e9', '99999999']) {
    await weight(page).fill(bad); await main(page).click(); await page.waitForTimeout(250);
    if (!(await page.locator('.chips, .row').count()) || (await page.locator('.pt').count())) { through.push('вес ' + bad); await page.goBack(); await page.waitForTimeout(300); }
  }
  await weight(page).fill('');
  const count = page.locator('.field', { hasText: 'Количество паллет' }).locator('input');
  for (const bad of ['-3', '0', '5000']) {
    await count.fill(bad); await main(page).click(); await page.waitForTimeout(250);
    if (await page.locator('.pt').count()) { through.push('паллет ' + bad); await page.locator('.bar .round--plain').click(); await page.waitForTimeout(300); }
  }
  await count.fill('');
  const len = page.locator('.grid3 input').first();
  for (const bad of ['0', '-1', '700']) {
    await len.fill(bad); await main(page).click(); await page.waitForTimeout(250);
    if (await page.locator('.pt').count()) { through.push('длина ' + bad); await page.locator('.bar .round--plain').click(); await page.waitForTimeout(300); }
  }
  await len.fill('');
  await weight(page).fill('1 200'); await main(page).click(); await page.waitForSelector('.pt');
  must(!through.length, 'прошло: ' + through.join(', '));
});

await attack('R6', 'Кривые числа в цене и машине', async (page) => {
  await asCarrier(page);
  await page.locator('.card', { hasText: 'Jelgava' }).first().click(); await page.waitForSelector('.facts');
  await main(page).click(); await page.waitForSelector('.sheet.is-open');
  const through = [];
  for (const bad of ['-1', '0', 'abc', '1e9', '', '0,0']) {
    await page.fill('.sheet .input--big', bad); await page.locator('.sheet .btn--main').click(); await page.waitForTimeout(250);
    if (!(await page.locator('.sheet.is-open').count())) { through.push('цена «' + bad + '»'); await main(page).click(); await page.waitForSelector('.sheet.is-open'); }
  }
  await page.fill('.sheet .input--big', '150,5'); await page.locator('.sheet .btn--main').click(); await page.waitForTimeout(400);
  const d = await db(page);
  const mine = d.bids.filter((b) => b.bidder_id === BORIS && b.status === 'active');
  must(mine.length === 1 && mine[0].amount === 150.5, 'цена 150,5 записана как ' + JSON.stringify(mine.map((b) => b.amount)));
  await open(page, '', '#/me'); await page.waitForSelector('form');
  await page.locator('.btn', { hasText: 'Добавить машину' }).click(); await page.waitForSelector('.sheet.is-open');
  for (const bad of ['0', '-2', '900', 'abc']) {
    await page.locator('.sheet input').fill(bad); await page.locator('.sheet .btn--main').click(); await page.waitForTimeout(250);
    if (!(await page.locator('.sheet.is-open').count())) { through.push('тонны ' + bad); break; }
  }
  must(!through.length, 'прошло: ' + through.join(', '));
});

await attack('R7', 'Вчерашний день и один город', async (page) => {
  await startRequest(page);
  await toWhere(page);
  await page.fill('.search input', 'Rīga'); await page.locator('.search .row').first().click(); await page.waitForTimeout(150);
  await main(page).click(); await page.waitForTimeout(300);
  must((await page.locator('.pt').count()) > 0, 'Rīga → Rīga прошло дальше');
  await setTo(page, 'Daug'); await toWhen(page);
  await page.fill('.opt__date', day(-1)); await page.waitForTimeout(250);
  const picked = await page.locator('label.opt.is-on').count();
  await main(page).click(); await page.waitForTimeout(500);
  const sent = (await page.locator('.facts').count()) > 0;
  const d = await db(page);
  const past = d.postings.filter((p) => p.owner_id === ANNA && p.date_from < day(0) && p.created_at > new Date(Date.now() - 60000).toISOString());
  must(!(sent && past.length), 'заявка на вчера ушла (' + past.map((p) => p.date_from).join() + ')');
  must(!picked || !sent, 'вчерашний день выбран');
});

await attack('R8', 'Двойные нажатия', async (page) => {
  await startRequest(page); await toWhere(page); await setTo(page); await toWhen(page);
  const before = (await db(page)).postings.filter((p) => p.owner_id === ANNA).length;
  await main(page).dblclick(); await page.waitForSelector('.facts'); await page.waitForTimeout(500);
  const after = (await db(page)).postings.filter((p) => p.owner_id === ANNA).length;
  must(after === before + 1, `двойное «Отправить» создало ${after - before} заявок`);
  await asCarrier(page);
  await page.locator('.card', { hasText: 'Jelgava' }).first().click(); await page.waitForSelector('.facts');
  await main(page).dblclick(); await page.waitForTimeout(400);
  must((await page.locator('.sheet').count()) === 1, 'двойное «Предложить цену» открыло ' + (await page.locator('.sheet').count()) + ' шторки');
  await page.fill('.sheet .input--big', '200'); await page.locator('.sheet .btn--main').dblclick(); await page.waitForTimeout(500);
  const d = await db(page);
  must(d.bids.filter((b) => b.bidder_id === BORIS && b.status === 'active').length === 1, 'двойное «Отправить» дало две цены');
  must(d.notifications.filter((n) => n.type === 'bid' && n.payload?.amount === 200).length === 1, 'заказчику ушло два уведомления');
  await asCustomer(page);
  await page.locator('.card', { hasText: 'Rēzekne' }).click(); await page.waitForSelector('.offer');
  await page.locator('.offer .btn--fill').first().dblclick(); await page.waitForTimeout(400);
  must((await page.locator('.sheet.is-open').count()) === 1, 'двойное «Выбрать» открыло несколько вопросов');
  await page.locator('.sheet .btn--main').dblclick(); await page.waitForTimeout(600);
  must((await db(page)).deals.length === 1, 'двойное подтверждение дало ' + (await db(page)).deals.length + ' сделок');
});

await attack('R9', 'Обновление страницы посреди заявки', async (page) => {
  await startRequest(page, 'Автомобиль');
  await page.locator('label.field .input').first().fill('Audi A4');
  await weight(page).fill('1500'); await page.fill('textarea', 'ключи у охраны');
  await toWhere(page); await setTo(page, 'Rēz');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
  must((await page.locator('.pt').count()) === 2, 'после обновления не тот шаг: ' + (await title(page)));
  must((await page.locator('.pt').nth(1).innerText()).includes('Rēzekne'), 'город «куда» потерян');
  await toWhen(page); await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.opt');
  const id = await send(page);
  const p = (await db(page)).postings.find((x) => x.id === id);
  must(p && p.weight_kg === 1500 && p.note === 'ключи у охраны' && p.cargo_fields.model === 'Audi A4' && p.to_name === 'Rēzekne', 'данные потеряны: ' + JSON.stringify({ w: p?.weight_kg, n: p?.note, m: p?.cargo_fields }));
});

await attack('R10', 'Фото пропадает после обновления молча', async (page) => {
  await startRequest(page);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('input[type=file]', { name: 'gruz.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.photos button:not(.photo-add)');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(900);
  const left = await page.locator('.photos button:not(.photo-add)').count();
  const said = await toasts(page);
  must(left > 0 || /фото/i.test(said), 'фото исчезло, человеку ничего не сказано');
});

await attack('R11', 'Системная кнопка «назад»', async (page) => {
  await asCarrier(page);
  await page.locator('.card', { hasText: 'Jelgava' }).first().click(); await page.waitForSelector('.facts');
  const url = page.url();
  await main(page).click(); await page.waitForSelector('.sheet.is-open');
  await page.goBack(); await page.waitForTimeout(500);
  must((await page.locator('.sheet.is-open').count()) === 0, '«назад» не закрыло шторку');
  must(page.url() === url && (await page.locator('.facts').count()) === 1, '«назад» ушло с экрана заявки');
  await page.goBack(); await page.waitForSelector('.cards');
  await page.locator('.pill').click(); await page.waitForSelector('.sheet.is-open');
  await page.locator('.sheet .row').first().click(); await page.waitForTimeout(400);
  must((await page.locator('.sheet.is-open').count()) === 2, 'выбор города не открылся поверх');
  await page.goBack(); await page.waitForTimeout(450);
  must((await page.locator('.sheet.is-open').count()) === 1, '«назад» закрыло не одну шторку');
  await page.goBack(); await page.waitForTimeout(450);
  must((await page.locator('.sheet.is-open').count()) === 0 && (await page.locator('.cards').count()) === 1, 'после двух «назад» не список');
  // the wizard: back leaves it, nothing is lost, the header arrow walks the steps
  await asCustomer(page); await main(page).click(); await page.waitForSelector('.chips');
  await page.locator('.chip', { hasText: 'Техника' }).click(); await toWhere(page); await setTo(page);
  await page.goBack(); await page.waitForSelector('.cards');
  await main(page).click(); await page.waitForTimeout(500);
  must((await page.locator('.pt').count()) === 2, 'заявка не продолжилась с того же шага: ' + (await title(page)));
  await toWhen(page);
  await page.locator('.bar .round--plain').click(); await page.waitForSelector('.pt');
  await page.locator('.bar .round--plain').click(); await page.waitForSelector('.row');
  must((await page.locator('.row', { hasText: 'Техника' }).count()) === 1, 'категория потеряна по пути назад');
});

await attack('R12', 'Чужая роль по прямой ссылке', async (page) => {
  await asCustomer(page);
  const d = await db(page);
  const foreign = d.postings.find((p) => p.kind === 'cargo' && p.from_name === 'Jelgava');
  const trip = d.postings.find((p) => p.kind === 'truck' && p.owner_id === BORIS);
  await open(page, '', `#/p/${foreign.id}`); await page.waitForSelector('.facts');
  must((await main(page).count()) === 0, 'заказчику дали кнопку цены на чужом грузе');
  must(!/\+37\d/.test(await page.locator('.view').innerText()), 'заказчик видит чужой телефон');
  await asCarrier(page);
  await open(page, '', `#/p/${trip.id}`); await page.waitForSelector('.facts');
  const text = await page.locator('.view').innerText();
  must(!/Ждём цены|Цены/.test(text), 'у своего рейса блок «Цены» как у груза');
  must((await main(page).count()) === 0, 'на своём рейсе кнопка «Предложить цену»');
});

await attack('R13', 'Слепые цены после своей цены', async (page) => {
  await asCarrier(page);
  await page.locator('.btn--wide', { hasText: 'Показать все' }).click(); await page.waitForTimeout(300);
  await page.locator('.card', { hasText: 'Rēzekne' }).click(); await page.waitForSelector('.facts');
  await main(page).click(); await page.waitForSelector('.sheet.is-open');
  must(!/1[79]0/.test(await page.locator('.sheet').innerText()) && !(await page.locator('.sheet .input--big').getAttribute('placeholder')), 'в шторке цены подсказка чужой цены');
  await page.fill('.sheet .input--big', '160'); await page.locator('.sheet .btn--main').click(); await page.waitForTimeout(400);
  const job = await page.locator('.view').innerText();
  must(!/1[79]0\s*€/.test(job), 'после своей цены видна чужая');
  await page.locator('.bar .round--plain').click(); await page.waitForSelector('.cards');
  must(!/1[79]0\s*€/.test(await page.locator('.view').innerText()), 'в списке видна чужая цена');
});

await attack('R14', 'Пустой рейс без машины', async (page) => {
  await asCarrier(page);
  await page.locator('.bar a[href="#/me"]').click(); await page.waitForSelector('form');
  for (let i = 0; i < 4 && (await page.locator('.row .btn', { hasText: 'Убрать' }).count()); i++) {
    await page.locator('.row .btn', { hasText: 'Убрать' }).first().click(); await page.waitForTimeout(300);
    if (await page.locator('.sheet.is-open').count()) { await page.locator('.sheet .btn--main').click(); await page.waitForTimeout(350); }
  }
  must((await page.locator('.row .btn', { hasText: 'Убрать' }).count()) === 0, 'машины не убрались');
  await open(page, '', '#/trip'); await page.waitForSelector('.pt');
  await setTo(page, 'Jelg'); await toWhen(page);
  await main(page).click(); await page.waitForSelector('.sheet.is-open');
  must((await page.locator('.sheet select').count()) === 1, 'без машины не спросили машину');
  await page.locator('.sheet input').fill('3,5'); await page.locator('.sheet .btn--main').click();
  await page.waitForSelector('.cards'); await page.waitForTimeout(300);
  const d = await db(page);
  const trips = d.postings.filter((p) => p.kind === 'truck' && p.owner_id === BORIS && p.to_name === 'Jelgava' && p.status === 'open');
  must(trips.length === 1, 'рейс не создан или создан дважды: ' + trips.length);
});

await attack('R15', 'Опасные кнопки без вопроса', async (page) => {
  const silent = [];
  await asCarrier(page);
  await page.locator('.pill').click(); await page.waitForSelector('.sheet.is-open');
  await page.locator('.sheet .row .btn', { hasText: 'Убрать' }).first().click(); await page.waitForTimeout(400);
  if ((await db(page)).postings.find((p) => p.kind === 'truck' && p.owner_id === BORIS).status !== 'open') silent.push('рейс убран одним нажатием');
  await page.goto(`${base}app/?lang=ru#/me`); await page.reload({ waitUntil: 'load' }); await page.waitForSelector('form');
  const had = (await db(page)).vehicles.filter((v) => v.owner_id === BORIS).length;
  await page.locator('.row .btn', { hasText: 'Убрать' }).first().click(); await page.waitForTimeout(400);
  if ((await db(page)).vehicles.filter((v) => v.owner_id === BORIS).length < had) silent.push('машина убрана одним нажатием');
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('form');
  await page.locator('.btn', { hasText: 'Начать демо заново' }).click(); await page.waitForTimeout(400);
  if (!(await page.locator('.sheet.is-open').count())) silent.push('демо сброшено одним нажатием');
  must(!silent.length, silent.join('; '));
});

await attack('R16', 'Узкий и лежачий экран', async (page) => {
  const bad = [];
  const look = async (name) => {
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.foot .btn--main, .sheet.is-open .btn--main')].pop();
      const r = b ? b.getBoundingClientRect() : null;
      const x = document.querySelector('.sheet.is-open .icon-btn'); const rx = x ? x.getBoundingClientRect() : null;
      return { side: document.documentElement.scrollWidth > innerWidth + 1, mainOk: !r || (r.top >= 0 && r.bottom <= innerHeight + 1), closeOk: !rx || (rx.top >= 0 && rx.bottom <= innerHeight), room: innerHeight - (document.querySelector('.bar')?.offsetHeight || 0) - (document.querySelector('.foot')?.offsetHeight || 0) };
    });
    if (m.side) bad.push(name + ': уезжает вбок');
    if (!m.mainOk) bad.push(name + ': главная кнопка не на экране');
    if (!m.closeOk) bad.push(name + ': крестик шторки не на экране');
    if (m.room < 120) bad.push(name + `: на содержимое остаётся ${m.room}px`);
  };
  for (const [w, hgt] of [[320, 568], [844, 390]]) {
    await page.setViewportSize({ width: w, height: hgt });
    const tag = `${w}x${hgt}`;
    await open(page); await page.waitForSelector('.door'); await look(tag + ' вход');
    await asCustomer(page); await look(tag + ' мои заявки');
    await main(page).click(); await page.waitForSelector('.chips'); await look(tag + ' что везём');
    await page.locator('.chip', { hasText: 'Автомобиль' }).click(); await look(tag + ' что везём, выбрано');
    await toWhere(page); await look(tag + ' откуда-куда'); await setTo(page); await toWhen(page); await look(tag + ' когда');
    await page.locator('.opt').first().click(); await look(tag + ' срочно');
    await asCarrier(page); await look(tag + ' заявки');
    await page.locator('.pill').click(); await page.waitForSelector('.sheet.is-open'); await look(tag + ' где ищу');
    await page.goBack(); await page.waitForTimeout(300);
    await page.locator('.card').first().click(); await page.waitForSelector('.facts'); await look(tag + ' заявка');
    await main(page).click(); await page.waitForSelector('.sheet.is-open'); await look(tag + ' цена');
    await page.evaluate(() => localStorage.clear());
  }
  must(!bad.length, bad.join('; '));
});

await attack('R17', 'Доступность: автоматическая проверка axe', async (page) => {
  const axePath = [path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), path.resolve(ROOT, '..', 'pacelam', 'node_modules', 'axe-core', 'axe.min.js')].find((p) => existsSync(p));
  must(axePath, 'axe-core не найден');
  const found = new Map();
  const scan = async (name) => {
    await page.waitForTimeout(450);
    await page.addScriptTag({ path: axePath });
    const res = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } }));
    for (const v of res.violations) { const k = v.id; if (!found.has(k)) found.set(k, { impact: v.impact, where: [] }); found.get(k).where.push(`${name}: ${v.nodes[0].target.join(' ')}`); }
  };
  await open(page); await page.waitForSelector('.door'); await scan('вход');
  await asCustomer(page); await scan('мои заявки');
  await page.locator('.card', { hasText: 'Rēzekne' }).click(); await page.waitForSelector('.offer'); await scan('заявка с ценами');
  await page.goBack(); await page.waitForSelector('.cards');
  await main(page).click(); await page.waitForSelector('.chips'); await page.locator('.chip', { hasText: 'Автомобиль' }).click(); await scan('что везём');
  await toWhere(page); await setTo(page); await scan('откуда-куда'); await toWhen(page); await page.locator('.opt').first().click(); await scan('когда');
  await asCarrier(page); await scan('заявки');
  await page.locator('.pill').click(); await page.waitForSelector('.sheet.is-open'); await scan('где ищу'); await page.goBack(); await page.waitForTimeout(300);
  await page.locator('.card').first().click(); await page.waitForSelector('.facts'); await scan('заявка');
  await main(page).click(); await page.waitForSelector('.sheet.is-open'); await scan('цена'); await page.goBack(); await page.waitForTimeout(300);
  await open(page, '', '#/me'); await page.waitForSelector('form'); await scan('профиль');
  const list = [...found.entries()].map(([id, v]) => `${id} [${v.impact}] ×${v.where.length} (${v.where[0]})`);
  must(!list.length, list.join(' ;; '));
});

await attack('R18', 'Экран сменился, а читалка экрана молчит', async (page) => {
  await asCarrier(page);
  await page.locator('.card').first().click(); await page.waitForSelector('.facts'); await page.waitForTimeout(400);
  const heard = await page.evaluate(() => { const live = [...document.querySelectorAll('[aria-live], [role="status"]')].filter((el) => !el.closest('.toasts')).map((el) => el.textContent.trim()).join(' '); return { live, focus: document.activeElement?.id || document.activeElement?.tagName }; });
  const h = await title(page);
  must(heard.live.includes(h) || heard.focus === 'view', `новый экран «${h}» не объявлен (live: «${heard.live}», фокус: ${heard.focus})`);
});

await attack('R19', 'Смена языка посреди заявки и на шторке', async (page) => {
  await startRequest(page, 'Автомобиль');
  await page.locator('label.field .input').first().fill('Opel'); await weight(page).fill('900');
  await page.locator('.lang button', { hasText: 'LV' }).click(); await page.waitForTimeout(400);
  must((await page.locator('.field', { hasText: 'Svars' }).locator('input').inputValue()) === '900', 'вес потерян при смене языка');
  must((await page.locator('.row', { hasText: 'Automašīna' }).count()) === 1, 'категория потеряна при смене языка');
  await page.locator('.lang button', { hasText: 'EN' }).click(); await page.waitForTimeout(300);
  await main(page).click(); await page.waitForSelector('.pt');
  await page.locator('.lang button', { hasText: 'RU' }).click(); await page.waitForTimeout(300);
  must((await page.locator('.pt').count()) === 2, 'смена языка сбросила шаг');
});

await attack('R20', 'Срочная заявка и отсчёт', async (page) => {
  await startRequest(page); await toWhere(page); await setTo(page); await toWhen(page);
  await page.locator('.opt', { hasText: 'Срочно' }).click(); await page.waitForTimeout(200);
  await page.locator('.chip', { hasText: '30' }).click();
  const id = await send(page);
  const p = (await db(page)).postings.find((x) => x.id === id);
  const left = (new Date(p.wait_until).getTime() - Date.now()) / 60000;
  must(p.mode === 'urgent' && left > 28 && left <= 30 && p.date_from === day(0), `срочная записана не так: ${p.mode}, ждать ${Math.round(left)} мин, день ${p.date_from}`);
  await asCarrier(page);
  const mine = page.locator('.card', { hasText: /Rīga\s*Daugavpils/ }).first();
  must((await mine.locator('.tag--urgent').count()) === 1 && (await mine.evaluate((el) => el.classList.contains('is-urgent'))), 'срочная заявка без красной метки: ' + (await mine.innerText()).replace(/\n/g, ' '));
  must(/Ждёт (29|30) мин/.test(await mine.locator('.tag').innerText()), 'отсчёт показан как «' + (await mine.locator('.tag').innerText()) + '»');
  const order = await page.locator('.card').evaluateAll((els) => els.map((el) => el.classList.contains('is-urgent')));
  must(order.lastIndexOf(true) < (order.indexOf(false) === -1 ? 99 : order.indexOf(false)), 'срочные заявки стоят не первыми: ' + order.join());
});

await attack('R21', 'Убрать цену, закрыть заявку, начать демо заново', async (page) => {
  await asCarrier(page);
  await page.locator('.card', { hasText: 'Jelgava' }).first().click(); await page.waitForSelector('.facts');
  await main(page).click(); await page.waitForSelector('.sheet.is-open'); await page.fill('.sheet .input--big', '180'); await page.locator('.sheet .btn--main').click(); await page.waitForTimeout(400);
  await main(page).click(); await page.waitForSelector('.sheet.is-open');
  await page.locator('.sheet .btn--quiet').click(); await page.waitForTimeout(400);
  must((await db(page)).bids.filter((b) => b.bidder_id === BORIS && b.status === 'active').length === 0, 'цена не убрана');
  must(!/Моя цена/.test(await page.locator('.view').innerText()), 'после «Убрать цену» она всё ещё на экране');
  await asCustomer(page);
  await page.locator('.card', { hasText: 'Cēsis' }).click(); await page.waitForSelector('.facts');
  await page.locator('.btn--danger-text').click(); await page.waitForSelector('.sheet.is-open'); await page.locator('.sheet .btn--main').click();
  await page.waitForSelector('.cards'); await page.waitForTimeout(300);
  must(/Закрыта/.test(await page.locator('.card', { hasText: 'Cēsis' }).innerText()), 'закрытая заявка не помечена');
  await asCarrier(page);
  await page.locator('.btn--wide', { hasText: 'Показать все' }).click(); await page.waitForTimeout(300);
  must((await page.locator('.card', { hasText: 'Cēsis' }).count()) === 0, 'закрытая заявка видна перевозчику');
});

await attack('R22', 'Только клавиатура', async (page) => {
  await open(page); await page.waitForSelector('.door');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  let guard = 0;
  while (guard++ < 12 && !(await page.evaluate(() => document.activeElement?.classList.contains('door--truck')))) await page.keyboard.press('Tab');
  must(guard < 12, 'до двери «Есть транспорт» не дойти клавишей Tab');
  await page.keyboard.press('Enter'); await page.waitForSelector('.cards');
  guard = 0;
  while (guard++ < 15 && !(await page.evaluate(() => document.activeElement?.classList.contains('pill')))) await page.keyboard.press('Tab');
  must(guard < 15, 'до «Где ищу» не дойти клавишей Tab');
  await page.keyboard.press('Enter'); await page.waitForSelector('.sheet.is-open');
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  must(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'Tab вышел из открытой шторки');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  must((await page.locator('.sheet.is-open').count()) === 0, 'Escape не закрыл шторку');
  must(await page.evaluate(() => document.activeElement?.classList.contains('pill')), 'фокус не вернулся на кнопку, открывшую шторку');
}, { width: 1024, height: 768 });

await attack('R23', 'Карта не загрузилась', async (page, ctx) => {
  await ctx.route(/vendor\/leaflet/, (r) => r.abort());
  await asCarrier(page);
  await page.locator('.card').first().click(); await page.waitForSelector('.facts'); await page.waitForTimeout(600);
  must(/Карта не загрузилась/.test(await page.locator('.view').innerText()), 'нет слов о карте');
  must((await main(page).count()) === 1, 'без карты пропала главная кнопка');
  await asCustomer(page); await main(page).click(); await page.waitForSelector('.chips');
  await page.locator('.chip', { hasText: 'Паллеты' }).click(); await toWhere(page); await setTo(page); await toWhen(page);
  await send(page);
}, { allowErrors: true });

await attack('R24', 'Не картинка вместо фото, пять фото', async (page) => {
  await startRequest(page);
  await page.setInputFiles('input[type=file]', { name: 'virus.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('это не картинка') });
  await page.waitForTimeout(700);
  must((await page.locator('.photos button:not(.photo-add)').count()) === 0, 'не-картинка принята как фото');
  must((await toasts(page)).length > 0, 'про плохой файл ничего не сказано');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  await page.setInputFiles('input[type=file]', [1, 2, 3, 4, 5].map((i) => ({ name: `f${i}.png`, mimeType: 'image/png', buffer: png })));
  await page.waitForTimeout(900);
  must((await page.locator('.photos button:not(.photo-add)').count()) === 4, 'фото: ' + (await page.locator('.photos button:not(.photo-add)').count()) + ' вместо 4');
  must((await page.locator('.photo-add').count()) === 0, 'после 4 фото кнопка «Фото» осталась');
  await toWhere(page); await setTo(page); await toWhen(page);
  const id = await send(page);
  must((await db(page)).postings.find((x) => x.id === id).photos.length === 4, 'фото не дошли до заявки');
  must((await page.locator('.photos img').count()) === 4, 'фото не показаны в заявке');
}, { allowErrors: true });

await attack('R25', 'Двести заявок в списке', async (page) => {
  await asCarrier(page);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('pacelam.demo')); const tpl = d.postings.find((p) => p.from_name === 'Jelgava');
    for (let i = 0; i < 200; i++) d.postings.push({ ...tpl, id: `00000000-0000-4000-8000-${String(100000000000 + i)}`, created_at: new Date(Date.now() - i * 60000).toISOString(), weight_kg: 100 + i });
    localStorage.setItem('pacelam.demo', JSON.stringify(d));
  });
  const t0 = Date.now();
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.cards');
  await page.waitForFunction(() => document.querySelectorAll('.card').length >= 200, null, { timeout: 5000 });
  const ms = Date.now() - t0;
  must(ms < 2500, `список из 200 заявок открывается ${ms} мс`);
  must(!(await hscroll(page)), 'уезжает вбок');
  return `${ms} мс`;
});

await attack('R26', 'Испорченные записи в памяти телефона', async (page) => {
  await asCustomer(page);
  await page.evaluate((anna) => {
    localStorage.setItem('pacelam.min.role', '"hacker"');
    localStorage.setItem('pacelam.here', '{"name":5,"lat":"x"}');
    localStorage.setItem('pacelam.min.zone', '"много"');
    localStorage.setItem('pacelam.min.seen', '{"not":"a list"}');
    localStorage.setItem('pacelam.theme', '"розовая"');
    localStorage.setItem(`pacelam.min.wiz.cargo.${anna}`, JSON.stringify({ at: Date.now(), step: 'три', draft: { fields: null, from: 'Rīga', to: { name: null }, day: 'вчера', cargo_type_id: 'нет такой', wait: 'долго' } }));
    localStorage.setItem(`pacelam.lastRoute.${anna}`, '[1,2,3]');
  }, ANNA);
  await open(page); await page.waitForTimeout(500);
  must((await page.locator('.door, .cards').count()) > 0, 'приложение не открылось с чужой ролью в памяти');
  await open(page, '&demo=customer', '#/new'); await page.waitForTimeout(600);
  must((await page.locator('.chips, .row').count()) > 0, 'заявка не открылась с испорченным черновиком: ' + (await page.locator('#view').innerText()).slice(0, 80));
  await page.locator('.chip, .row').first().click(); await page.waitForTimeout(250);
  if (await page.locator('.chip', { hasText: 'Паллеты' }).count()) await page.locator('.chip', { hasText: 'Паллеты' }).click();
  await toWhere(page); await setTo(page, 'Rēz');
  if ((await page.locator('.pt').first().innerText()).trim().length < 3 || /Откуда/.test(await page.locator('.pt').first().innerText())) { await page.locator('.pt').first().click(); await setTo(page, 'Jelg'); }
  await toWhen(page); await send(page);
});

await attack('R27', 'Заявка гостя после входа', async (page) => {
  await open(page); await page.waitForSelector('.door');
  await page.evaluate(() => localStorage.setItem('pacelam.min.wiz.cargo.guest', JSON.stringify({ at: Date.now(), step: 3, photos: 0, draft: { cargo_type_id: 'machinery', fields: {}, weight_kg: '2800', length_m: '', width_m: '', height_m: '', note: 'трактор', from: { name: 'Jelgava', lat: 56.65, lng: 23.71 }, to: { name: 'Rēzekne', lat: 56.51, lng: 27.33 }, day: new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), urgent: false, wait: 60 } })));
  await page.goto(`${base}app/?lang=ru#/new`); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(700);
  must((await page.locator('.opt').count()) > 0, 'после входа заявка гостя не на последнем шаге: ' + (await title(page)));
  const id = await send(page);
  const p = (await db(page)).postings.find((x) => x.id === id);
  must(p.cargo_type_id === 'machinery' && p.weight_kg === 2800 && p.note === 'трактор' && p.from_name === 'Jelgava' && p.to_name === 'Rēzekne', 'заявка гостя ушла не той: ' + JSON.stringify({ c: p.cargo_type_id, w: p.weight_kg, f: p.from_name, t: p.to_name }));
  must((await page.evaluate(() => localStorage.getItem('pacelam.min.wiz.cargo.guest'))) === null, 'черновик гостя остался лежать');
});

await attack('R28', 'Двойное нажатие на фото и на значки', async (page) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  await startRequest(page);
  await page.setInputFiles('input[type=file]', { name: 'gruz.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.photos button:not(.photo-add)');
  await toWhere(page); await setTo(page); await toWhen(page); await send(page);
  await page.locator('.photos button').first().dblclick(); await page.waitForTimeout(400);
  must((await page.locator('.sheet').count()) === 1, 'двойное нажатие на фото открыло ' + (await page.locator('.sheet').count()) + ' шторки');
  await page.goBack(); await page.waitForTimeout(400);
  await asCarrier(page);
  await page.locator('.pill').dblclick(); await page.waitForTimeout(400);
  must((await page.locator('.sheet').count()) === 1, 'двойное нажатие на «Где ищу» открыло ' + (await page.locator('.sheet').count()) + ' шторки');
  await page.locator('.sheet .row').first().dblclick(); await page.waitForTimeout(400);
  must((await page.locator('.sheet').count()) === 2, 'двойное нажатие на «Город» открыло ' + ((await page.locator('.sheet').count()) - 1) + ' выбора города');
});

await attack('R29', 'Ссылки наружу и звонок', async (page) => {
  await asCarrier(page);
  await page.locator('.card', { hasText: 'Jelgava' }).first().click(); await page.waitForSelector('.facts');
  const links = await page.locator('.view a[href]').evaluateAll((els) => els.map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
  for (const l of links) {
    if (/^https?:/.test(l.href)) must(l.target === '_blank' && /noopener/.test(l.rel), 'внешняя ссылка без noopener: ' + l.href);
    must(/^(#\/|https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+(\.\d+)?,-?\d+(\.\d+)?&waypoints=-?\d+(\.\d+)?,-?\d+(\.\d+)?&travelmode=driving$|https:\/\/www\.openstreetmap\.org\/copyright$|tel:\+?\d+$)/.test(l.href), 'странная ссылка: ' + l.href);
  }
  must(links.some((l) => /google\.com\/maps/.test(l.href)), 'нет кнопки маршрута');
});

await attack('R30', 'Мусор в языке и чужой язык телефона', async (page) => {
  for (const q of ['?lang=<script>alert(1)</script>', '?lang=zz', '?lang=RU', '?lang=ru-RU', '?lang=', '?lang=lv&lang=en']) {
    await page.goto(`${base}app/${q}`, { waitUntil: 'load' }); await page.waitForSelector('.door');
    const lang = await page.evaluate(() => document.documentElement.lang);
    must(['lv', 'ru', 'en'].includes(lang), `язык «${lang}» при ${q}`);
    must((await page.locator('.door').first().innerText()).trim().length > 3, 'пустая кнопка при ' + q);
  }
  await page.goto(`${base}app/?lang=RU`, { waitUntil: 'load' }); await page.waitForSelector('.door');
  must(/Есть груз/.test(await page.locator('.door').first().innerText()), '?lang=RU не дал русский');
});

await attack('R31', 'Быстро туда и обратно', async (page) => {
  await asCarrier(page);
  for (let i = 0; i < 6; i++) {
    await page.locator('.card').nth(i % 3).click({ noWaitAfter: true });
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
  }
  await page.waitForTimeout(900);
  must((await page.locator('.cards').count()) === 1 && (await page.locator('.facts').count()) === 0, 'после быстрых переходов не список: ' + (await title(page)));
  must((await page.locator('.card').count()) >= 3, 'список потерял карточки');
  const maps = await page.evaluate(() => document.querySelectorAll('.leaflet-container').length);
  must(maps === 0, 'осталось карт в памяти: ' + maps);
  for (let i = 0; i < 5; i++) { await page.locator('.lang button').nth(i % 3).click({ noWaitAfter: true }); }
  await page.waitForTimeout(600);
  must((await page.locator('.cards').count()) === 1, 'после быстрой смены языка не список');
});

await attack('R32', 'Сменили категорию: старые ответы не уходят', async (page) => {
  await startRequest(page, 'Автомобиль');
  await page.locator('label.field .input').first().fill('BMW X5');
  await page.locator('.field--line', { hasText: 'Катится' }).locator('.chip', { hasText: 'Нет' }).click();
  await page.locator('.row', { hasText: 'Автомобиль' }).click(); await page.waitForSelector('.chips');
  await page.locator('.chip', { hasText: 'Паллеты' }).click(); await page.waitForTimeout(200);
  await page.locator('.field', { hasText: 'Количество паллет' }).locator('input').fill('6');
  await toWhere(page); await setTo(page); await toWhen(page);
  const id = await send(page);
  const p = (await db(page)).postings.find((x) => x.id === id);
  must(p.cargo_type_id === 'pallets' && p.cargo_fields.pallet_count === 6 && !('model' in p.cargo_fields) && !('rolls' in p.cargo_fields), 'в заявку ушло лишнее: ' + JSON.stringify(p.cargo_fields));
  must(!/BMW/.test(await page.locator('.view').innerText()), 'марка от прошлой категории на экране');
});

await browser.close();
await srv.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(path.join(outDir('.'), 'redteam.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 1));
console.log(`\n${results.length} атак, прошло насквозь: ${failed.length}`);
process.exit(failed.length ? 1 : 0);
