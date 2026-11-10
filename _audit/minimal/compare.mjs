// One sheet "before / after" from the two screenshot sets → birza/shots_1011/COMPARE.png
import path from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium, outDir } from './lib.mjs';

const DIR = outDir('.');
const before = JSON.parse(readFileSync(path.join(DIR, 'before', 'before.json'), 'utf8'));
const after = JSON.parse(readFileSync(path.join(DIR, 'after', 'after.json'), 'utf8'));
const B = Object.fromEntries(before.screens.map((s) => [s.name, s]));
const A = Object.fromEntries(after.screens.map((s) => [s.name, s]));
const PAIRS = [
  ['Вход', '13-doors', '01-start'],
  ['Перевозчик: список заявок', '03-feed-carrier', '10-jobs'],
  ['Перевозчик: заявка', '06-detail-carrier', '12-job'],
  ['Перевозчик: предложить цену', '07-bid', '13-price'],
  ['Заказчик: первый экран', '24-feed-customer', '20-my-requests-price'],
  ['Заявка, шаг «Что везём»', '21-cargo-3-what', '03-new-1-what'],
  ['Заявка, шаг «Откуда → куда»', '19-cargo-1-route', '04-new-2-where-set'],
  ['Заявка, шаг «Когда»', '20-cargo-2-when', '05-new-3-when'],
  ['Заказчик: цены перевозчиков', '26-detail-owner', '07-request-prices'],
  ['Сделка: телефон', '28-deal-contacts', '23-deal-customer'],
];
const img = (set, name) => pathToFileURL(path.join(DIR, set, name + '.png')).href;
const cell = (label, set, name, s, taps) => `<figure><figcaption><b>${label}</b> ${taps} нажимаемых · шрифт от ${s.minFont} px · ${s.words} слов</figcaption><img src="${img(set, name)}" alt=""></figure>`;
const rows = PAIRS.filter(([, b, a]) => existsSync(path.join(DIR, 'before', b + '.png')) && existsSync(path.join(DIR, 'after', a + '.png')))
  .map(([title, b, a]) => `<section><h2>${title}</h2><div class="pair">${cell('Было', 'before', b, B[b], B[b].tapsFirstScreen)}${cell('Стало', 'after', a, A[a], A[a].tapsOnScreen)}</div></section>`).join('');
const f = (o, k) => (o && o[k] != null ? o[k] : '?');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:32px;background:#fff;color:#101418;font:400 18px/1.35 system-ui,"Segoe UI",Arial,sans-serif;width:1240px}
h1{font-size:30px;margin:0 0 6px} p{margin:0 0 20px;color:#3F4850}
table{border-collapse:collapse;margin:0 0 28px;font-size:18px} td,th{border:1px solid #9AA5AE;padding:8px 14px;text-align:left}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 40px}
h2{font-size:21px;margin:0 0 8px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0} figcaption{font-size:15px;color:#3F4850;min-height:42px} figcaption b{color:#101418;display:block}
img{width:100%;border:1px solid #9AA5AE;border-radius:8px;display:block}
</style>
<h1>Paceļam: было и стало</h1>
<p>Телефон 390x844, русский язык. Числа под каждым экраном сняты скриптом: сколько всего можно нажать на экране без прокрутки, самый мелкий шрифт, сколько слов.</p>
<table><tr><th>Сколько нажатий</th><th>Было</th><th>Стало</th></tr>
<tr><td>Заказчик: отправить заявку</td><td>${f(before.flows, 'customer_landing_to_posted')}, 4 шага</td><td>${f(after.flows, 'customer_new_request')}, 3 шага</td></tr>
<tr><td>Заказчик: выбрать перевозчика</td><td>${f(before.flows, 'customer_feed_to_deal')}</td><td>${f(after.flows, 'customer_pick_carrier')}</td></tr>
<tr><td>Перевозчик: предложить цену</td><td>${f(before.flows, 'carrier_feed_to_offer')}</td><td>${f(after.flows, 'carrier_offer_price')}</td></tr>
<tr><td>Перевозчик: выложить пустой рейс</td><td>${f(before.flows, 'carrier_post_trip')}</td><td>${f(after.flows, 'carrier_post_trip')}</td></tr></table>
<div class="grid">${rows}</div>`;
const file = path.join(DIR, 'compare.html');
writeFileSync(file, html);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1304, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(DIR, 'COMPARE.png'), fullPage: true });
await browser.close();
console.log('COMPARE.png', rows.split('<section>').length - 1, 'pairs');
