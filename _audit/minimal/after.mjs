// "After": the minimal version at 390x844, Russian → birza/shots_1011/after/*.png + after.json
// TILES=1 loads the real map tiles for the pictures; without it the map stays grey (checks do not call the tile server).
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { serve, outDir } from './lib.mjs';
import { tour, verdict } from './tour.mjs';

const OUT = outDir('after');
const srv = await serve();
const r = await tour(srv.base, { width: 390, lang: 'ru', out: OUT, tiles: process.env.TILES === '1' });
await srv.close();
const bad = verdict(r);
writeFileSync(path.join(OUT, 'after.json'), JSON.stringify({ at: new Date().toISOString(), ...r, bad }, null, 1));
for (const s of r.screens) console.log(s.name.padEnd(26), `taps ${String(s.tapsOnScreen).padStart(2)}  words ${String(s.words).padStart(3)}  font ${s.minFont}  contrast ${s.minContrast}  gap ${s.minGap}  screens ${s.screens}`);
console.log('flows', r.flows, 'rules', r.rules);
console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : 'OK: no problems');
process.exit(bad.length ? 1 : 0);
