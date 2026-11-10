// The light theme (one tap in the profile) on the main screens: readable too, and the switch itself works.
import { serve, phone } from './lib.mjs';
import { measure } from './tour.mjs';

const srv = await serve();
const { browser, page, errors } = await phone({ width: 390, height: 844 });
const bad = [];
const look = async (name) => {
  await page.waitForTimeout(450);
  const m = await measure(page);
  if (m.minContrast < 4.5) bad.push(`${name}: contrast ${m.minContrast} (${m.weak.slice(0, 3).join('; ')})`);
  if (m.minFont < 16) bad.push(`${name}: text ${m.minFont}px`);
  console.log(name.padEnd(14), 'contrast', m.minContrast, 'font', m.minFont);
};
await page.goto(srv.base + 'app/?lang=ru&demo=carrier', { waitUntil: 'load' });
await page.waitForSelector('.cards');
await page.locator('.bar a[href="#/me"]').click();
await page.locator('.btn', { hasText: 'Светлая тема' }).click();
await page.waitForTimeout(300);
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
if (theme !== 'light') bad.push('the theme switch did not turn the light theme on');
await look('profile');
await page.goto(srv.base + 'app/?lang=ru#/list', { waitUntil: 'load' }); await page.waitForSelector('.cards'); await look('jobs');
await page.locator('.card').first().click(); await page.waitForSelector('.facts'); await look('job');
await page.locator('.foot .btn--main').click(); await page.waitForSelector('.sheet.is-open'); await look('price');
await page.goto(srv.base + 'app/?lang=ru#/start', { waitUntil: 'load' }); await page.waitForSelector('.door'); await look('start');
await page.goto(srv.base + 'app/?lang=ru&demo=customer', { waitUntil: 'load' }); await page.waitForSelector('.cards'); await look('my requests');
await page.goto(srv.base + 'app/?lang=ru#/new', { waitUntil: 'load' }); await page.waitForSelector('.chips'); await look('new request');
await browser.close(); await srv.close();
console.log(bad.length || errors.length ? 'PROBLEMS:\n' + [...bad, ...errors].join('\n') : 'OK: light theme');
process.exit(bad.length || errors.length ? 1 : 0);
