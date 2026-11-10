// "Before": every screen of the current app (main checkout) at 390x844, Russian, with what a person meets on it.
// node _audit/minimal/before.mjs   → birza/shots_1011/before/*.png + before.json
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { serve, phone, outDir, metrics, ROOT } from './lib.mjs';

const MAIN = path.resolve(ROOT, '..', 'pacelam');
const OUT = outDir('before');
const srv = await serve(MAIN);
const { browser, page, errors } = await phone();
const report = [];
const log = [];
let taps = 0;
const shot = async (name, note = '') => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const m = await metrics(page);
  report.push({ name, note, ...m });
  console.log('shot', name, JSON.stringify(m));
};
const step = async (name, fn) => { try { await fn(); } catch (e) { log.push(`${name}: ${String(e.message).split('\n')[0]}`); console.log('FAIL', name, String(e.message).split('\n')[0]); } };
const tap = async (loc) => { await loc.first().click(); taps++; await page.waitForTimeout(300); };
const btn = (text) => page.getByRole('button', { name: text });
const flows = {};

await step('landing', async () => { await page.goto(srv.base + '?lang=ru', { waitUntil: 'load' }); await shot('01-landing', 'главная, первый экран'); });
await step('feed-guest', async () => { await page.goto(srv.base + 'app/?visit=1&lang=ru', { waitUntil: 'load' }); await page.waitForSelector('.pcard'); await shot('02-feed-guest', 'лента, гость'); });

// ---- carrier ----
await step('feed-carrier', async () => { await page.goto(srv.base + 'app/?demo=carrier&lang=ru', { waitUntil: 'load' }); await page.waitForSelector('.pcard'); await shot('03-feed-carrier', 'лента перевозчика'); });
await step('filter', async () => { await page.click('.strip .icon-btn'); await page.waitForSelector('.sheet.is-open'); await shot('04-filter', 'фильтр'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); });
await step('route-sheet', async () => { await page.click('.strip .picker'); await page.waitForSelector('.sheet.is-open'); await shot('05-route', 'мой маршрут'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); });
await step('carrier-flow', async () => {
  taps = 0;
  const card = page.locator('.pcard--cargo:not(.is-mine):not(.is-urgent) a.pcard__link');
  await tap(card); await page.waitForSelector('.detail__route');
  await shot('06-detail-carrier', 'заявка глазами перевозчика');
  await tap(btn('Предложить цену')); await page.waitForSelector('.sheet.is-open');
  await shot('07-bid', 'предложить цену');
  await page.fill('.sheet .input--num', '150');
  await tap(btn('Отправить цену'));
  await page.waitForTimeout(500);
  flows.carrier_feed_to_offer = taps;
  await shot('08-detail-my-bid', 'после предложения');
});
await step('carrier-my', async () => { await page.goto(srv.base + 'app/?lang=ru#/my', { waitUntil: 'load' }); await page.waitForTimeout(600); await shot('09-my-carrier', 'мои (перевозчик)'); });
await step('search', async () => { await page.goto(srv.base + 'app/?lang=ru#/search', { waitUntil: 'load' }); await page.waitForTimeout(600); await shot('10-search', 'сохранённые поиски'); });
await step('profile', async () => { await page.goto(srv.base + 'app/?lang=ru#/me', { waitUntil: 'load' }); await page.waitForTimeout(600); await shot('11-profile', 'профиль'); });
await step('inbox', async () => { await page.goto(srv.base + 'app/?lang=ru#/inbox', { waitUntil: 'load' }); await page.waitForTimeout(600); await shot('12-inbox', 'уведомления'); });
await step('doors', async () => { await page.goto(srv.base + 'app/?lang=ru#/post', { waitUntil: 'load' }); await page.waitForTimeout(600); await shot('13-doors', 'предложить: груз / транспорт'); });
await step('truck-wizard', async () => {
  taps = 0;
  await tap(page.locator('.offer__btn--truck')); await page.waitForSelector('.wiz');
  await shot('14-truck-1-route', 'рейс: откуда → куда');
  for (let i = 0; i < 6 && !(await page.locator('.wpt--to .wpt__v:not(.is-empty)').count()); i++) { await page.fill('.wsearch input', 'Rīga'); await tap(page.locator('.wsearch__list .cityrow')); }
  await tap(page.locator('.wiz__foot .btn')); await shot('15-truck-2-when', 'рейс: когда');
  await tap(page.locator('.wiz__foot .btn')); await shot('16-truck-3-what', 'рейс: какая машина');
  await tap(page.locator('.wiz__foot .btn')); await shot('17-truck-4-check', 'рейс: проверка');
  await tap(page.locator('.wiz__foot .btn')); await page.waitForTimeout(700);
  flows.carrier_post_trip = taps;
  await shot('18-truck-posted', 'рейс опубликован');
});

// ---- customer ----
await step('cargo-wizard', async () => {
  await page.goto(srv.base + '?lang=ru', { waitUntil: 'load' });
  taps = 0;
  await tap(page.locator('.offer__btn--cargo')); await page.waitForSelector('.wiz');
  await shot('19-cargo-1-route', 'груз: откуда → куда');
  await page.fill('.wsearch input', 'Daug'); await tap(page.locator('.wsearch__list .cityrow'));
  await tap(page.locator('.wiz__foot .btn')); await shot('20-cargo-2-when', 'груз: когда');
  await tap(page.locator('.wiz__foot .btn')); await shot('21-cargo-3-what', 'груз: что везём');
  await tap(page.locator('.wiz__foot .btn')); await shot('22-cargo-4-check', 'груз: проверка');
  await tap(page.locator('.wiz__foot .btn')); await page.waitForTimeout(700);
  flows.customer_landing_to_posted = taps;
  await shot('23-cargo-posted', 'груз опубликован');
});
await step('customer-feed', async () => { await page.goto(srv.base + 'app/?lang=ru#/', { waitUntil: 'load' }); await page.waitForSelector('.pcard'); await shot('24-feed-customer', 'лента заказчика'); });
await step('customer-choose', async () => {
  taps = 0;
  await tap(page.locator('.nav a[href="#/my"]')); await page.waitForTimeout(500);
  await shot('25-my-customer', 'мои (заказчик)');
  await tap(page.locator('a[href^="#/p/"]', { hasText: 'Rēzekne' })); await page.waitForSelector('.detail__route');
  await shot('26-detail-owner', 'моя заявка с предложениями');
  await tap(btn('Согласиться')); await page.waitForSelector('.sheet.is-open');
  await shot('27-agree-confirm', 'подтверждение');
  await tap(page.locator('.sheet .btn--primary')); await page.waitForTimeout(700);
  flows.customer_feed_to_deal = taps;
  await shot('28-deal-contacts', 'сделка, контакты');
});
await step('auth', async () => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(srv.base + 'app/?lang=ru&visit=1#/auth', { waitUntil: 'load' }); await page.waitForTimeout(600); await shot('29-auth', 'вход');
});

writeFileSync(path.join(OUT, 'before.json'), JSON.stringify({ at: new Date().toISOString(), flows, screens: report, failed: log, errors }, null, 1));
console.log('flows', flows, 'failed', log, 'errors', errors.length);
await browser.close();
await srv.close();
