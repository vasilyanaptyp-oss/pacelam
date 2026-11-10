// The previous app must stay alive next to the minimal one: board, operator desk, and the redirect for ?demo=operator.
import { serve, phone } from './lib.mjs';
const srv = await serve();
const { browser, page, errors } = await phone({ width: 1280, height: 800 });
const out = {};
await page.goto(srv.base + 'app/classic.html?demo=carrier&lang=ru', { waitUntil: 'load' });
out.board = await page.waitForSelector('.tbl__row, .pcard', { timeout: 8000 }).then(() => true, () => false);
await page.goto(srv.base + 'app/?demo=operator&lang=ru', { waitUntil: 'load' });
await page.waitForTimeout(1200);
out.operatorRedirect = /classic\.html/.test(page.url()) && /#\/operator/.test(page.url());
out.operatorForm = (await page.locator('form').count()) > 0;
await browser.close(); await srv.close();
console.log(JSON.stringify(out), 'console errors', errors.length, errors.slice(0, 3));
process.exit(Object.values(out).every(Boolean) && !errors.length ? 0 : 1);
