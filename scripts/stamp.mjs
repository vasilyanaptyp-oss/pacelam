// Cache-busting stamp (audit 23.09.2026, A-022). GitHub Pages lets a browser keep every file for 10 minutes,
// so right after a deploy a phone could glue a new app.js to an old i18n.js and show raw keys instead of words.
// Every local js/css reference gets ?v=<hash of the code>: a deploy is a new set of URLs, never a mix.
// Run before each commit that touches js/ or css/:
//   node scripts/stamp.mjs           rewrite the references
//   node scripts/stamp.mjs --check   exit 1 if anything is not stamped with the current hash
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(root, p);
const STAMP = /\?v=[0-9a-f]{8}/g;
const code = [
  ...readdirSync(rel('js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
  ...readdirSync(rel('css')).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
  'config.js',
].sort();
const hash = createHash('sha1');
for (const f of code) hash.update(`${f}\0${readFileSync(rel(f), 'utf8').replace(STAMP, '')}\0`);
const v = hash.digest('hex').slice(0, 8);

// module imports inside js/, local js/css/config in the two pages, the scene script the public page loads
const jsImport = /((?:\bfrom|\bimport)\s*\(?\s*['"])(\.\.?\/[\w./-]+\.js)(?:\?v=[0-9a-f]{8})?(['"])/g;
const htmlRef = /((?:src|href)=")((?:\.\.\/)?(?:js\/[\w.-]+\.js|css\/[\w.-]+\.css|config\.js))(?:\?v=[0-9a-f]{8})?(")/g;
const sceneRef = /(load\(')(js\/scene\.js)(?:\?v=[0-9a-f]{8})?(')/g;
const targets = [...code.filter((f) => f.startsWith('js/')), 'index.html', 'app/index.html'];
const check = process.argv.includes('--check');
let touched = 0;
for (const f of targets) {
  const before = readFileSync(rel(f), 'utf8');
  const after = before.replace(jsImport, `$1$2?v=${v}$3`).replace(htmlRef, `$1$2?v=${v}$3`).replace(sceneRef, `$1$2?v=${v}$3`);
  if (after === before) continue;
  touched++;
  if (check) console.log(`not stamped with ${v}: ${f}`);
  else writeFileSync(rel(f), after);
}
if (check) { console.log(touched ? `STALE: ${touched} file(s)` : `stamp ${v}: all references current`); process.exit(touched ? 1 : 0); }
console.log(`stamp ${v}: ${touched} file(s) updated`);
