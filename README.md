# Paceļam — kravu birža atpakaļceļam

Backload exchange for Latvia and the Baltics. Static front-end (no framework) + Supabase
(Postgres, Auth, row-level security, Storage). Client: SIA TK Trans, Daugavpils.

Vehicle types: `docs/vehicle-types.json`. Product decisions are kept outside this public repository.
(codes as on the exchange carriers already use). Scheme agreed with the client:
`docs/pacelam-scheme.png`.

## Pages

- `index.html` — public page for people coming from search (lv baked in, ru/en swapped by `js/landing.js`).
- `app/` — the exchange itself. One adaptive layout: cards below 1024 px, a sortable table with a
  filter sidebar from 1024 px, plus an inline details panel from 1440 px. On top of the board —
  "Offer: cargo / transport", two big doors (also on the public page and behind the "+" of the bottom
  bar, `#/post`). A door opens the posting wizard, one question per screen: map from → to, calendar,
  what / which vehicle, publish (`#/post/cargo`, `#/post/truck`; every field in one form:
  `#/post/cargo/full`). A guest fills the cargo wizard without an account; it is asked for only at
  "Publish" and the filled-in posting waits on the last step. Only the carrier names a price; the customer taps "Agree" or "Let me think"
  on each offer. `#/operator` — keyboard-first form for the dispatcher posting on behalf of callers
  (profiles with `is_operator`).
- Links from the public page: `app/?demo=carrier|customer|operator` signs into the demo,
  `app/?post=cargo|truck` opens posting (in the demo as the sample customer / carrier),
  `app/?role=carrier|customer#/auth` preselects the role for sign-up.

## Run locally

Any static server, e.g.

```bash
python -m http.server 5173
```

Without Supabase credentials in `config.js` the app runs in **demo mode**: sample data in the
browser's localStorage, two demo accounts (carrier / customer), every flow clickable.

## Connect Supabase

1. Create a project (free tier). In the SQL editor run, in order:
   `supabase/migrations/0001_init.sql`, `0002_seed.sql`, `0003_storage.sql`, `0004_urgent_price.sql`
   (price decides in the urgent mode too: carriers agree to the customer's price or offer their own,
   the customer picks, and accepting an urgent offer confirms the deal and opens contacts at once),
   `0005_carrier_price.sql` (only the carrier names a price: a new cargo posting carries none, the
   customer taps "Agree" on an offer and the deal closes at once with contacts open on both sides).
   `0006_cargo_for_truck.sql` ("offer my cargo" on a truck: the cargo keeps a link to that truck and its
   owner is notified at once).
   `0007_urgent_wait.sql` (urgent cargo: today, with the time the customer can wait — the card counts down).
   `0008_pairs.sql` (the exchange finds pairs by itself: a cargo that fits an open truck's route within the
   carrier's detour limit notifies the carrier, a new truck notifies customers of fitting cargo; the customer
   can "call" a carrier on the way once).
   `0009_carrier_facts.sql` (facts next to an offer: the carrier's vehicle and payload, deals closed here, since
   when he is on Paceļam — no contacts, no plates).
   `0010_vehicle_names.sql` (vehicle names without codes, limits written with < and >: "Tow truck < 5 t").
2. Authentication → Providers → Email: for a test project turn **off** "Confirm email";
   set Site URL to the page URL (for password-reset links).
3. Put the project URL and the anon key into `config.js`:
   ```js
   window.PACELAM_CONFIG = { SUPABASE_URL: 'https://xxxx.supabase.co', SUPABASE_ANON_KEY: 'eyJ…', PHOTO_BUCKET: 'photos' };
   ```
   The anon key is public by design; what a browser may read is decided by the database policies.
4. Make the dispatcher an operator and, later, flip the subscription wall — from the SQL editor:
   ```sql
   update profiles set is_operator = true where id = '<uuid of the dispatcher>';
   update settings set value = '15' where key = 'free_delay_minutes';   -- minutes of delay for free accounts
   update profiles set subscription_until = now() + interval '30 days' where id = '<uuid>';
   ```

## What lives where

- `js/app.js` screens and routing, `js/api-supabase.js` REST/Auth/Storage client,
  `js/api-demo.js` demo backend with the same surface, `js/geo.js` cities + haversine + detour,
  `js/data.js` vehicle types and provisional cargo categories (also the source of `0002_seed.sql`
  via `node scripts/gen-seed.mjs`), `js/i18n.js` lv/ru/en.
- `supabase/migrations/0001_init.sql` — the whole model: tables, RLS, bids/deals functions,
  contact unlocks, saved-search notifications, subscription switch.
- `_audit/` — checks: `db-test.mjs` (100 policy tests in PGlite), `leak-rest.mjs` (contact leak
  through the real REST API), `timing.mjs` (20-second posting), `lang-fonts.mjs` (?lang and
  Latvian diacritics by pixel comparison), `screens.mjs` (every screen at 360/390/1280/1920),
  `keyboard-operator.mjs` (operator posts with the keyboard only), `table-rows.mjs`, `shots.mjs`,
  `desk-shots.mjs`, `scene-shots.mjs` (frames of the hero animation at several moments plus the
  still phone frame). Pass `BASE=https://.../pacelam/` to run them against the published site.
- `scripts/stamp.mjs` — cache-busting: every local js/css reference carries `?v=<hash of the code>`, so right after a
  deploy a browser never mixes a new `app.js` with an old `i18n.js`. Run `node scripts/stamp.mjs` before each commit
  that touches `js/` or `css/`; `node scripts/stamp.mjs --check` fails if something is not stamped.
- `assets/` — share image `og.png` (1200×630) and app icons, built by `node scripts/gen-assets.mjs`
  from the site's own fonts and the hero map (re-run after changing the map or the headline).
  `manifest.webmanifest` (root and `app/`) makes the board installable; `404.html` is served by
  Pages for any missing path and finds the site root itself.
- `vendor/` — GSAP 3 core + MotionPath + DrawSVG and Leaflet 1.9.4 (`vendor/leaflet`, BSD-2), self-hosted
  (no CDN). Leaflet is loaded only on the map step of the wizard; tiles come from openstreetmap.org, no key. `js/scene.js` is loaded
  by `landing.js` only on capable desktops (≥980 px, no reduced-motion, no save-data); phones get
  a still scene from CSS alone.

## Security model in one paragraph

Phones and e-mails are in `profile_contacts`, readable only by the owner or by users holding a row
in `contact_unlocks` for that owner. Unlock rows are written only by the database functions that
close a deal (`take_posting`, `confirm_deal`); clients have no insert right on bids, deals or
unlocks. Cargo photos are public objects without personal data. Everything a browser can read is
decided by RLS, never by JavaScript.
