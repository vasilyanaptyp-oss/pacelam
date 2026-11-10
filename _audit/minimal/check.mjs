// The check before handing over: both roles end to end at 360 / 390 / 412 in Russian, and at the narrowest
// width in Latvian and English. Passes when there are no console errors, nothing scrolls sideways, text is
// 16 px and up, contrast is AA and up, tappable things are 48 px high with 8 px between them, every step
// of every flow works, and the business rules hold (blind prices, no phone before a deal, no price from the customer).
//   node _audit/minimal/check.mjs   → birza/shots_1011/check.json, exit 1 on any problem
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { serve, outDir, ROOT } from './lib.mjs';
import { tour, verdict } from './tour.mjs';
import { pathToFileURL } from 'node:url';

const RUNS = [
  { width: 360, height: 640, lang: 'ru' },
  { width: 390, height: 844, lang: 'ru' },
  { width: 412, height: 915, lang: 'ru' },
  { width: 360, height: 640, lang: 'lv' },
  { width: 360, height: 640, lang: 'en' },
];
const { missing } = await import(pathToFileURL(path.join(ROOT, 'js', 'i18n-min.js')).href).catch(() => ({ missing: null }));
const srv = await serve();
const out = [];
let problems = 0;
// every text exists in all three languages
if (missing) for (const l of ['lv', 'en']) { const m = missing(l); if (m.length) { problems += m.length; console.log(`texts missing in ${l}: ${m.join(', ')}`); } }
else { problems++; console.log('could not read js/i18n-min.js'); }
for (const run of RUNS) {
  const r = await tour(srv.base, run);
  const bad = verdict(r);
  problems += bad.length;
  const worst = r.screens.reduce((a, s) => ({ taps: Math.max(a.taps, s.tapsOnScreen), font: Math.min(a.font, s.minFont), contrast: Math.min(a.contrast, s.minContrast), gap: Math.min(a.gap, s.minGap) }), { taps: 0, font: 99, contrast: 99, gap: 99 });
  console.log(`${run.width}x${run.height} ${run.lang}: ${r.screens.length} screens, flows ${JSON.stringify(r.flows)}, most taps on a screen ${worst.taps}, smallest text ${worst.font}px, lowest contrast ${worst.contrast}, smallest gap ${worst.gap}px, console errors ${r.errors.length} → ${bad.length ? 'PROBLEMS' : 'ok'}`);
  for (const b of bad) console.log('   ' + b);
  out.push({ ...run, flows: r.flows, rules: r.rules, worst, bad, screens: r.screens.map((s) => ({ name: s.name, taps: s.tapsOnScreen, words: s.words, minFont: s.minFont, minContrast: s.minContrast, minGap: s.minGap, screens: s.screens })) });
}
await srv.close();
writeFileSync(path.join(outDir('.'), 'check.json'), JSON.stringify({ at: new Date().toISOString(), problems, runs: out }, null, 1));
console.log(problems ? `FAILED: ${problems} problem(s)` : 'ALL OK');
process.exit(problems ? 1 : 0);
