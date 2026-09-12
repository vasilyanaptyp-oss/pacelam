// Screen tour through the demo flows at 390x844: screenshots for design review + smoke test.
// Run with the static server up: node _audit/shots.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });
const errors = [];

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async (name, full = false) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: full }); console.log('shot', name); };
const click = async (text, opts = {}) => { await page.getByRole(opts.role || 'button', { name: text, exact: opts.exact ?? false }).first().click(); await page.waitForTimeout(250); };

await page.goto(BASE + '?lang=ru', { waitUntil: 'load' });
await page.waitForSelector('.pcard');
await shot('01-feed-visitor', true);
await page.click('a[href="#/me"]');
await page.waitForSelector('text=Войти в демо как');
await shot('02-auth');
await click('Перевозчик — Борис');
await page.waitForSelector('form');
await page.goto(BASE + '?lang=ru#/');
await page.waitForSelector('.pcard');
await shot('03-feed-carrier');
// route
await page.click('.strip .picker');
await page.waitForSelector('.sheet.is-open');
await shot('04-route-sheet');
await page.click('.sheet .picker >> nth=1');
await page.waitForSelector('.sheet input');
await page.fill('.sheet input[placeholder]', 'rig');
await page.waitForTimeout(150);
await shot('05-city-picker');
await page.click('.cityrow >> nth=0');
await page.waitForTimeout(300);
await click('Сохранить');
await page.waitForSelector('.pcard');
await shot('06-feed-detour', true);
// post truck
await page.click('a[href="#/post"]');
await page.waitForSelector('form');
await shot('07-post-truck', true);
await click('Ищу транспорт', { role: 'tab' });
await page.waitForSelector('form');
await click('Автомобиль');
await shot('08-post-cargo', true);
// urgent detail + take
await page.goto(BASE + '?lang=ru#/');
await page.waitForSelector('.pcard');
const urgent = page.locator('.pcard.is-urgent').first();
await urgent.locator('a.pcard__link').click();
await page.waitForSelector('.detail__route');
await shot('09-detail-urgent', true);
await click('Беру');
await page.waitForSelector('.sheet.is-open');
await shot('10-take-confirm');
await page.locator('.sheet .btn--primary').click();
await page.waitForSelector('.contacts');
await shot('11-deal-contacts', true);
// planned bid (clear the route first: after the take nothing is left within 60 km of detour)
await page.evaluate(() => localStorage.removeItem('pacelam.route'));
await page.goto(BASE + '?lang=ru#/');
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.pcard');
const planned = page.locator('.pcard', { hasText: 'Rēzekne' }).first();
await planned.locator('a.pcard__link').click();
await page.waitForSelector('.detail__route');
await shot('12-detail-planned', true);
await click('Своя ставка');
await page.waitForSelector('.sheet.is-open');
await page.fill('.sheet input[inputmode="decimal"]', '175');
await shot('13-bid-sheet');
await click('Отправить ставку');
await page.waitForSelector('.status-line');
await shot('14-detail-my-bid', true);
// my
await page.click('a[href="#/my"]');
await page.waitForSelector('.tabs');
await click('Ставки', { role: 'tab' });
await shot('15-my-bids', true);
// search
await page.click('a[href="#/search"]');
await page.waitForSelector('h1');
await shot('16-search', true);
await click('Новый поиск');
await page.waitForSelector('.sheet.is-open');
await shot('17-search-sheet');
await page.keyboard.press('Escape');
// profile
await page.click('a[href="#/me"]');
await page.waitForSelector('form');
await shot('18-profile', true);
await click('Добавить машину');
await page.waitForSelector('.sheet.is-open');
await shot('19-vehicle-sheet');
await page.keyboard.press('Escape');
// inbox
await page.click('#top-actions .icon-btn');
await page.waitForSelector('h1');
await shot('20-inbox', true);
// customer side: accept the bid
await page.click('a[href="#/me"]');
await click('Выйти');
await page.waitForTimeout(300);
await page.click('a[href="#/me"]');
await click('Заказчик — Анна');
await page.waitForSelector('form');
await page.click('a[href="#/my"]');
await page.waitForSelector('.tabs');
await click('Объявления', { role: 'tab' });
await page.locator('.pcard', { hasText: 'Rēzekne' }).first().locator('a.pcard__link').click();
await page.waitForSelector('.bids');
await shot('21-detail-owner-bids', true);
await page.locator('.bidrow', { hasText: '175' }).locator('button').click();
await page.waitForTimeout(400);
await shot('22-detail-pending-owner', true);
// carrier confirms
await page.click('a[href="#/me"]');
await click('Выйти');
await page.waitForTimeout(300);
await page.click('a[href="#/me"]');
await click('Перевозчик — Борис');
await page.waitForSelector('form');
await page.click('#top-actions .icon-btn');
await page.waitForSelector('.noterow');
await page.locator('.noterow').first().click();
await page.waitForSelector('.detail__route');
await shot('23-detail-pending-carrier', true);
await click('Подтвердить сделку');
await page.waitForSelector('.contacts');
await shot('24-deal-confirmed', true);
// light theme + lv
await page.goto(BASE + '?lang=lv#/me');
await page.waitForSelector('form');
await page.locator('label.check', { hasText: 'Gaišais' }).click();
await page.goto(BASE + '?lang=lv#/');
await page.waitForSelector('.pcard');
await shot('25-feed-light-lv', true);

console.log('\nerrors:', errors.length ? errors : 'none');
await browser.close();
