// Database-level test of the Paceļam schema in PGlite (real Postgres, WASM).
// Applies the auth shim, the migrations, then plays the business scenarios as different users
// through `set role authenticated` + JWT claims, exactly how Supabase evaluates RLS.
// 0001–0004 scenarios first (postings made before 23.09 keep the customer's price), then 0005 is
// applied and the carrier-price rules are played on fresh users.
// Run: node _audit/db-test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const db = new PGlite();
let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  -- ' + detail : ''));
}

const U = {
  anna: '11111111-1111-4111-8111-111111111111',   // customer
  boris: '22222222-2222-4222-8222-222222222222',  // carrier
  cilvis: '33333333-3333-4333-8333-333333333333', // carrier
  dace: '44444444-4444-4444-8444-444444444444',   // carrier far away
};

async function as(user, fn) {
  // Supabase runs every request as role `authenticated` with the JWT claims in request.jwt.claims.
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: user, role: 'authenticated' })}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
}
async function asAnon(fn) {
  await db.exec(`set role anon; select set_config('request.jwt.claims', '${JSON.stringify({ role: 'anon' })}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;
async function fails(sql, params) {
  try { await db.query(sql, params); return null; } catch (e) { return e.message; }
}

await db.exec(read('_audit/auth-shim.sql'));
await db.exec(read('supabase/migrations/0001_init.sql'));
await db.exec(read('supabase/migrations/0002_seed.sql'));
await db.exec(read('supabase/migrations/0004_urgent_price.sql'));
console.log('schema applied');

await db.exec(`insert into auth.users (id, email) values
  ('${U.anna}', 'anna@example.com'), ('${U.boris}', 'boris@example.com'), ('${U.cilvis}', 'cilvis@example.com'), ('${U.dace}', 'dace@example.com')`);

// --- profiles and contacts ---------------------------------------------------------------
await as(U.anna, async () => {
  await db.query(`insert into profiles (id, role, display_name, city_name, city_lat, city_lng, is_operator, subscription_until)
    values ($1, 'customer', 'Anna', 'Daugavpils', 55.87, 26.52, true, now() + interval '1 year')`, [U.anna]);
  await db.query(`insert into profile_contacts (profile_id, phone, email, company) values ($1, '+371 20000001', 'anna@example.com', 'Anna SIA')`, [U.anna]);
});
const annaProfile = (await rows(`select is_operator, subscription_until from profiles where id = $1`, [U.anna]))[0];
check('client cannot self-assign operator flag or subscription', annaProfile.is_operator === false && annaProfile.subscription_until === null, JSON.stringify(annaProfile));

await as(U.boris, async () => {
  await db.query(`insert into profiles (id, role, display_name, city_name, city_lat, city_lng) values ($1, 'carrier', 'Boriss', 'Daugavpils', 55.87, 26.52)`, [U.boris]);
  await db.query(`insert into profile_contacts (profile_id, phone, email) values ($1, '+371 20000002', 'boris@example.com')`, [U.boris]);
  await db.query(`insert into vehicles (owner_id, type_code, plate, tonnage_t, volume_m3, is_default) values ($1, 'VT10', 'AB-1234', 8, 40, true)`, [U.boris]);
});
await as(U.cilvis, async () => {
  await db.query(`insert into profiles (id, role, display_name, city_name, city_lat, city_lng) values ($1, 'carrier', 'Cilvis', 'Rēzekne', 56.51, 27.33)`, [U.cilvis]);
  await db.query(`insert into profile_contacts (profile_id, phone) values ($1, '+371 20000003')`, [U.cilvis]);
});
await as(U.dace, async () => {
  await db.query(`insert into profiles (id, role, display_name, city_name, city_lat, city_lng) values ($1, 'carrier', 'Dace', 'Liepāja', 56.51, 21.01)`, [U.dace]);
  await db.query(`insert into profile_contacts (profile_id, phone) values ($1, '+371 20000004')`, [U.dace]);
});

// --- THE leak test: a second user reads the contacts table directly ------------------------
await as(U.boris, async () => {
  const all = await rows(`select profile_id, phone, email from profile_contacts`);
  check('carrier reading profile_contacts sees only his own row', all.length === 1 && all[0].profile_id === U.boris, JSON.stringify(all));
  const anna = await rows(`select * from profile_contacts where profile_id = $1`, [U.anna]);
  check('direct select of another user\'s contacts returns 0 rows', anna.length === 0, JSON.stringify(anna));
  const viaJoin = await rows(`select c.phone from profiles p join profile_contacts c on c.profile_id = p.id where p.id = $1`, [U.anna]);
  check('join through profiles leaks nothing', viaJoin.length === 0);
  const fn = await rows(`select has_contact_access($1) as ok`, [U.anna]);
  check('has_contact_access(other) is false before a deal', fn[0].ok === false);
  const err = await fails(`insert into contact_unlocks (viewer_id, owner_id) values ($1, $2)`, [U.boris, U.anna]);
  check('client cannot insert into contact_unlocks', !!err, err);
  const err2 = await fails(`update profile_contacts set phone = '+371 1' where profile_id = $1`, [U.anna]);
  const changed = await rows(`select phone from profile_contacts where profile_id = $1`, [U.anna]);
  check('client cannot update another user\'s contacts', changed.length === 0 || changed[0].phone !== '+371 1', err2 || JSON.stringify(changed));
  const vehicles = await rows(`select * from vehicles`);
  check('vehicles of other carriers are private', vehicles.length === 1 && vehicles[0].plate === 'AB-1234');
});
await asAnon(async () => {
  const err = await fails(`select * from profile_contacts`);
  const got = err ? [] : await rows(`select * from profile_contacts`);
  check('anonymous visitor reads no contacts', !!err || got.length === 0, err || JSON.stringify(got));
  const profiles = await rows(`select display_name from profiles`);
  check('anonymous visitor can read display names (board is open)', profiles.length === 4);
});

// --- urgent cargo: price decides here too — carriers bid, the customer picks, the deal closes at once ---
let urgentId;
await as(U.anna, async () => {
  const r = await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code, cargo_type_id, weight_kg, price, is_operator_posting, status, bid_count)
    values ('cargo', 'urgent', $1, 'Daugavpils', 55.87, 26.52, 'Rīga', 56.95, 24.11, current_date, current_date, 'VT08', 'vehicle', 1500, 120, true, 'deal', 99) returning id, status, bid_count, is_operator_posting`, [U.anna]);
  urgentId = r[0].id;
  check('posting insert forces status=open and counters=0', r[0].status === 'open' && r[0].bid_count === 0, JSON.stringify(r[0]));
  check('operator tag dropped when profile is not an operator', r[0].is_operator_posting === false);
});
await as(U.boris, async () => {
  const feed = await rows(`select id, from_name, to_name, price from postings where status = 'open'`);
  check('carrier sees the urgent cargo in the feed', feed.length === 1 && feed[0].id === urgentId);
  const err = await fails(`update postings set price = 1 where id = $1`, [urgentId]);
  const price = await rows(`select price from postings where id = $1`, [urgentId]);
  check('carrier cannot edit someone else\'s posting', Number(price[0].price) === 120, err || JSON.stringify(price));
  const takeErr = await fails(`select take_posting($1)`, [urgentId]);
  check('urgent cargo cannot be taken without the customer choosing', /bid on/.test(takeErr || ''), takeErr);
  const directBid = await fails(`insert into bids (posting_id, bidder_id, amount) values ($1, $2, 100)`, [urgentId, U.boris]);
  check('client cannot insert bids directly', !!directBid, directBid);
  const agree = await rows(`select place_bid($1, 120) as id`, [urgentId]);
  check('carrier agrees to the customer\'s price (a bid at that price)', !!agree[0].id);
  const contacts = await rows(`select * from profile_contacts where profile_id = $1`, [U.anna]);
  check('agreeing alone opens no contacts', contacts.length === 0, JSON.stringify(contacts));
});
let cheaperBid;
await as(U.cilvis, async () => {
  const b = await rows(`select place_bid($1, 100) as id`, [urgentId]);
  cheaperBid = b[0].id;
  check('a second carrier offers a lower price on the urgent cargo', !!cheaperBid);
  const err = await fails(`select accept_bid($1)`, [cheaperBid]);
  check('a carrier cannot accept a bid', /owner/.test(err || ''), err);
});
await as(U.anna, async () => {
  const notes = await rows(`select type, payload->>'urgent' as urgent from notifications where user_id = $1 and type = 'bid'`, [U.anna]);
  check('customer was notified of both urgent offers', notes.length === 2 && notes.every((n) => n.urgent === 'true'), JSON.stringify(notes));
  const deal = await rows(`select accept_bid($1) as id`, [cheaperBid]);
  check('customer picks the cheaper offer', !!deal[0].id);
  const deals = await rows(`select status, customer_id, carrier_id, amount from deals where posting_id = $1`, [urgentId]);
  check('urgent deal is confirmed at once with the cheaper carrier', deals.length === 1 && deals[0].status === 'confirmed' && deals[0].customer_id === U.anna && deals[0].carrier_id === U.cilvis && Number(deals[0].amount) === 100, JSON.stringify(deals));
  const contacts = await rows(`select phone from profile_contacts where profile_id = $1`, [U.cilvis]);
  check('customer sees the chosen carrier\'s phone right away', contacts.length === 1 && contacts[0].phone === '+371 20000003', JSON.stringify(contacts));
  const other = await rows(`select phone from profile_contacts where profile_id = $1`, [U.boris]);
  check('customer does not see the losing carrier\'s phone', other.length === 0);
  const bids = await rows(`select bidder_id, status from bids where posting_id = $1 order by amount`, [urgentId]);
  check('losing offer is rejected, winning one accepted', bids.length === 2 && bids.find((b) => b.bidder_id === U.boris).status === 'rejected' && bids.find((b) => b.bidder_id === U.cilvis).status === 'accepted', JSON.stringify(bids));
});
await as(U.cilvis, async () => {
  const contacts = await rows(`select phone from profile_contacts where profile_id = $1`, [U.anna]);
  check('chosen carrier sees the customer\'s phone right away', contacts.length === 1 && contacts[0].phone === '+371 20000001', JSON.stringify(contacts));
  const notes = await rows(`select type from notifications where user_id = $1`, [U.cilvis]);
  check('chosen carrier got the deal notification', notes.some((n) => n.type === 'deal'), JSON.stringify(notes));
});
await as(U.boris, async () => {
  const contacts = await rows(`select * from profile_contacts where profile_id = $1`, [U.anna]);
  check('losing carrier still cannot see the customer\'s contacts', contacts.length === 0);
  const gone = await rows(`select status from postings where id = $1`, [urgentId]);
  check('closed urgent posting is no longer visible to third parties', gone.length === 0, JSON.stringify(gone));
});

// --- planned cargo: reverse auction --------------------------------------------------------
let plannedId;
await as(U.anna, async () => {
  const r = await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code, cargo_type_id, weight_kg, price)
    values ('cargo', 'planned', $1, 'Daugavpils', 55.87, 26.52, 'Rīga', 56.95, 24.11, current_date + 3, current_date + 5, 'VT10', 'pallets', 3000, 200) returning id`, [U.anna]);
  plannedId = r[0].id;
});
let bidB, bidC;
await as(U.boris, async () => {
  bidB = (await rows(`select place_bid($1, 180, 'могу завтра') as id`, [plannedId]))[0].id;
  const ownBids = await rows(`select amount, status from bids where posting_id = $1`, [plannedId]);
  check('bidder sees only his own bid', ownBids.length === 1 && Number(ownBids[0].amount) === 180);
});
await as(U.cilvis, async () => {
  bidC = (await rows(`select place_bid($1, 170) as id`, [plannedId]))[0].id;
  const higher = (await rows(`select place_bid($1, 250) as id`, [plannedId]))[0].id;
  check('re-bidding updates the same bid row', higher === bidC);
  bidC = (await rows(`select place_bid($1, 170) as id`, [plannedId]))[0].id;
  const others = await rows(`select amount from bids where posting_id = $1`, [plannedId]);
  check('a bidder cannot read competing bids', others.length === 1 && Number(others[0].amount) === 170, JSON.stringify(others));
  const ownErr = await fails(`select accept_bid($1)`, [bidB]);
  check('a non-owner cannot accept bids', /owner|not found|permission/i.test(ownErr || ''), ownErr);
});
await as(U.anna, async () => {
  const p = (await rows(`select bid_count, best_bid from postings where id = $1`, [plannedId]))[0];
  check('posting carries bid count and best (lowest) bid', p.bid_count === 2 && Number(p.best_bid) === 170, JSON.stringify(p));
  const all = await rows(`select bidder_id, amount from bids where posting_id = $1 order by amount`, [plannedId]);
  check('owner sees all bids', all.length === 2 && Number(all[0].amount) === 170);
  const notes = await rows(`select payload from notifications where user_id = $1 and type = 'bid' order by created_at`, [U.anna]);
  const planned = notes.filter((n) => n.payload.urgent !== true);
  check('owner got a notification per bid with the amount', planned.length === 4 && planned.some((n) => n.payload.above_price === true), JSON.stringify(notes.map((n) => n.payload)));
  const deal = await rows(`select accept_bid($1) as id`, [bidC]);
  check('owner accepts the lowest bid -> pending deal', !!deal[0].id);
  const st = (await rows(`select status from postings where id = $1`, [plannedId]))[0];
  check('posting status is pending while the carrier confirms', st.status === 'pending');
  const unl = await rows(`select deal_id from contact_unlocks where viewer_id = $1 and deal_id = $2`, [U.anna, deal[0].id]);
  check('contacts stay closed until both sides confirm (no unlock for the pending deal)', unl.length === 0, JSON.stringify(unl));
});
await as(U.boris, async () => {
  const c = await rows(`select * from profile_contacts where profile_id = $1`, [U.anna]);
  check('the losing bidder has no access to the customer (nothing leaked)', c.length === 0, JSON.stringify(c));
});
await as(U.cilvis, async () => {
  const notes = await rows(`select type, deal_id from notifications where user_id = $1 and type = 'accepted'`, [U.cilvis]);
  check('accepted bidder is notified to confirm', notes.length === 1);
  const wrong = await fails(`select confirm_deal($1)`, ['99999999-9999-4999-8999-999999999999']);
  check('confirming a foreign/nonexistent deal fails', !!wrong);
  await db.query(`select confirm_deal($1)`, [notes[0].deal_id]);
  const c = await rows(`select phone from profile_contacts where profile_id = $1`, [U.anna]);
  check('after both confirmations the carrier sees the customer\'s phone', c.length === 1 && c[0].phone === '+371 20000001');
});
await as(U.anna, async () => {
  const c = await rows(`select phone from profile_contacts where profile_id = $1`, [U.cilvis]);
  check('customer sees the winning carrier\'s phone', c.length === 1 && c[0].phone === '+371 20000003');
  const b = await rows(`select bidder_id, status from bids where posting_id = $1 order by amount`, [plannedId]);
  check('losing bid is rejected, winning bid accepted', b.find((x) => x.bidder_id === U.boris).status === 'rejected' && b.find((x) => x.bidder_id === U.cilvis).status === 'accepted', JSON.stringify(b));
});
await as(U.dace, async () => {
  const c = await rows(`select * from profile_contacts where profile_id in ($1, $2, $3)`, [U.anna, U.boris, U.cilvis]);
  check('uninvolved carrier sees no contacts of anyone', c.length === 0);
});

// --- truck offer (carrier posts a truck, customer offers cargo + price) ---------------------
let truckId;
await as(U.boris, async () => {
  const r = await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code, cargo_type_id, weight_kg, volume_m3, price)
    values ('truck', 'urgent', $1, 'Rīga', 56.95, 24.11, 'Daugavpils', 55.87, 26.52, current_date + 1, current_date + 1, 'VT10', 'pallets', 8000, 40, null) returning id, mode, cargo_type_id`, [U.boris]);
  truckId = r[0].id;
  check('truck offers are always planned and carry no cargo category', r[0].mode === 'planned' && r[0].cargo_type_id === null, JSON.stringify(r[0]));
});
await as(U.anna, async () => {
  const noPrice = await fails(`select take_posting($1)`, [truckId]);
  check('a truck offer without a price cannot be taken instantly', /instant price/.test(noPrice || ''), noPrice);
  await db.query(`select place_bid($1, 150)`, [truckId]);
});
await as(U.dace, async () => {
  await db.query(`select place_bid($1, 210)`, [truckId]);
});
await as(U.boris, async () => {
  const p = (await rows(`select bid_count, best_bid from postings where id = $1`, [truckId]))[0];
  check('for a truck offer the best bid is the highest', p.bid_count === 2 && Number(p.best_bid) === 210, JSON.stringify(p));
  const best = (await rows(`select id from bids where posting_id = $1 and amount = 210`, [truckId]))[0];
  const deal = (await rows(`select accept_bid($1) as id`, [best.id]))[0];
  const d = (await rows(`select customer_id, carrier_id, carrier_confirmed_at from deals where id = $1`, [deal.id]))[0];
  check('truck offer deal: owner is the carrier, bidder the customer', d.carrier_id === U.boris && d.customer_id === U.dace && d.carrier_confirmed_at !== null);
  await db.query(`select cancel_deal($1)`, [deal.id]);
  const st = (await rows(`select status from postings where id = $1`, [truckId]))[0];
  check('cancelled pending deal reopens the posting', st.status === 'open');
  const c = await rows(`select * from profile_contacts where profile_id = $1`, [U.dace]);
  check('no contacts opened by a cancelled deal', c.length === 0);
  await db.query(`select close_posting($1)`, [truckId]);
  const st2 = (await rows(`select status from postings where id = $1`, [truckId]))[0];
  check('owner can close a posting', st2.status === 'closed');
});

// --- saved search notifications --------------------------------------------------------------
await as(U.boris, async () => {
  await db.query(`insert into saved_searches (owner_id, kind, center_name, center_lat, center_lng, radius_km, vehicle_type_codes, cargo_type_ids)
    values ($1, 'cargo', 'Daugavpils', 55.87, 26.52, 80, '{VT10,VT16}', '{}')`, [U.boris]);
});
await as(U.dace, async () => {
  await db.query(`insert into saved_searches (owner_id, kind, center_name, center_lat, center_lng, radius_km) values ($1, 'cargo', 'Liepāja', 56.51, 21.01, 50)`, [U.dace]);
});
let matchId;
await as(U.anna, async () => {
  matchId = (await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code, cargo_type_id)
    values ('cargo', 'planned', $1, 'Krāslava', 55.90, 27.17, 'Rīga', 56.95, 24.11, current_date + 2, current_date + 4, 'VT16', 'building') returning id`, [U.anna]))[0].id;
  await db.query(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code, cargo_type_id)
    values ('cargo', 'planned', $1, 'Krāslava', 55.90, 27.17, 'Rīga', 56.95, 24.11, current_date + 2, current_date + 4, 'VT08', 'vehicle')`, [U.anna]);
});
await as(U.boris, async () => {
  const notes = await rows(`select posting_id, payload from notifications where user_id = $1 and type = 'match'`, [U.boris]);
  check('saved search within radius + matching vehicle type notifies the carrier once', notes.length === 1 && notes[0].posting_id === matchId, JSON.stringify(notes));
  const err = await fails(`update notifications set read_at = now() where user_id = $1`, [U.boris]);
  check('client cannot update notifications directly', !!err, err);
  await db.query(`select mark_notifications_read($1::uuid[])`, [[notes[0]?.id].filter(Boolean)]);
});
await as(U.dace, async () => {
  const notes = await rows(`select id from notifications where user_id = $1 and type = 'match'`, [U.dace]);
  check('carrier outside the radius is not notified', notes.length === 0);
  const foreign = await rows(`select id from notifications where user_id = $1`, [U.boris]);
  check('notifications of other users are invisible', foreign.length === 0);
});

// --- subscription wall switch: delay for free accounts ----------------------------------------
await db.exec(`update settings set value = '15' where key = 'free_delay_minutes'`);
await db.exec(`update profiles set subscription_until = now() + interval '30 days' where id = '${U.cilvis}'`);
let delayedId;
await as(U.anna, async () => {
  delayedId = (await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to)
    values ('cargo', 'planned', $1, 'Daugavpils', 55.87, 26.52, 'Rīga', 56.95, 24.11, current_date + 6, current_date + 6) returning id`, [U.anna]))[0].id;
  const own = await rows(`select id from postings where id = $1`, [delayedId]);
  check('owner always sees their own posting', own.length === 1);
});
await as(U.boris, async () => {
  const seen = await rows(`select id from postings where id = $1`, [delayedId]);
  check('with the delay switched on, a free carrier does not see the fresh posting yet', seen.length === 0);
  const n = await rows(`select id from notifications where user_id = $1 and posting_id = $2`, [U.boris, delayedId]);
  check('and the matching notification is held back', n.length === 0);
});
await as(U.cilvis, async () => {
  const seen = await rows(`select id from postings where id = $1`, [delayedId]);
  check('a subscribed carrier sees it immediately', seen.length === 1);
  const err = await fails(`update profiles set subscription_until = now() + interval '10 years', is_operator = true where id = $1`, [U.cilvis]);
  const p = (await rows(`select is_operator, subscription_until < now() + interval '31 days' as short from profiles where id = $1`, [U.cilvis]))[0];
  check('subscribed user cannot extend subscription or become operator', p.is_operator === false && p.short === true, err || JSON.stringify(p));
});
await db.exec(`update settings set value = '0' where key = 'free_delay_minutes'`);
await as(U.boris, async () => {
  const seen = await rows(`select id from postings where id = $1`, [delayedId]);
  check('delay back to 0: free carrier sees the posting', seen.length === 1);
});

// --- board closed to visitors switch ---------------------------------------------------------
await asAnon(async () => {
  const open = await rows(`select count(*)::int as n from postings`);
  check('visitors see open postings while the board is open', open[0].n >= 3, JSON.stringify(open));
});
await db.exec(`update settings set value = 'false' where key = 'board_open_to_visitors'`);
await asAnon(async () => {
  const open = await rows(`select count(*)::int as n from postings`);
  check('board closed to visitors: anonymous sees nothing', open[0].n === 0, JSON.stringify(open));
});
await db.exec(`update settings set value = 'true' where key = 'board_open_to_visitors'`);

// --- 0005 (23.09.2026): only the carrier names a price; "Agree" closes the deal at once ---------------
// Fresh customer Eva and carrier Gatis: no earlier deals, so every open contact comes from this deal.
await db.exec(read('supabase/migrations/0005_carrier_price.sql'));
const E = { eva: '55555555-5555-4555-8555-555555555555', gatis: '66666666-6666-4666-8666-666666666666' };
await db.exec(`insert into auth.users (id, email) values ('${E.eva}', 'eva@example.com'), ('${E.gatis}', 'gatis@example.com')`);
await as(E.eva, async () => {
  await db.query(`insert into profiles (id, role, display_name, city_name, city_lat, city_lng) values ($1, 'customer', 'Eva', 'Rīga', 56.95, 24.11)`, [E.eva]);
  await db.query(`insert into profile_contacts (profile_id, phone) values ($1, '+371 20000005')`, [E.eva]);
});
await as(E.gatis, async () => {
  await db.query(`insert into profiles (id, role, display_name, city_name, city_lat, city_lng) values ($1, 'carrier', 'Gatis', 'Rēzekne', 56.51, 27.33)`, [E.gatis]);
  await db.query(`insert into profile_contacts (profile_id, phone) values ($1, '+371 20000006')`, [E.gatis]);
});
let plainId;
await as(E.eva, async () => {
  const r = await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, price)
    values ('cargo', 'planned', $1, 'Rēzekne', 56.51, 27.33, 'Rīga', 56.95, 24.11, current_date + 1, current_date + 2, 500) returning id, price`, [E.eva]);
  plainId = r[0].id;
  check('0005: a customer\'s cargo keeps no price even if one is sent', r[0].price === null, JSON.stringify(r[0]));
  await db.query(`update postings set price = 300, is_operator_posting = true where id = $1`, [plainId]);
  const p = (await rows(`select price, is_operator_posting from postings where id = $1`, [plainId]))[0];
  check('0005: nor can the customer add a price or the operator tag later', p.price === null && p.is_operator_posting === false, JSON.stringify(p));
});
let gatisBid;
await as(E.gatis, async () => {
  const takeErr = await fails(`select take_posting($1)`, [plainId]);
  check('0005: cargo without a price cannot be taken, only offered on', /no instant price/.test(takeErr || ''), takeErr);
  gatisBid = (await rows(`select place_bid($1, 210) as id`, [plainId]))[0].id;
  check('0005: the carrier names his price', !!gatisBid);
  const c = await rows(`select phone from profile_contacts where profile_id = $1`, [E.eva]);
  check('0005: naming a price opens no contacts', c.length === 0, JSON.stringify(c));
});
await as(U.dace, async () => { await rows(`select place_bid($1, 230)`, [plainId]); });
await as(E.eva, async () => {
  const before = await rows(`select phone from profile_contacts where profile_id = $1`, [E.gatis]);
  check('0005: before agreeing the customer sees no carrier phone', before.length === 0, JSON.stringify(before));
  await rows(`select accept_bid($1)`, [gatisBid]);
  const d = await rows(`select status, carrier_id, amount from deals where posting_id = $1`, [plainId]);
  check('0005: "Agree" on a planned cargo confirms the deal at once', d.length === 1 && d[0].status === 'confirmed' && d[0].carrier_id === E.gatis && Number(d[0].amount) === 210, JSON.stringify(d));
  const c = await rows(`select phone from profile_contacts where profile_id = $1`, [E.gatis]);
  check('0005: right after agreeing the customer sees the carrier\'s phone', c.length === 1, JSON.stringify(c));
  const other = await rows(`select status from bids where posting_id = $1 and bidder_id = $2`, [plainId, U.dace]);
  check('0005: the other offer is rejected', other.length === 1 && other[0].status === 'rejected', JSON.stringify(other));
});
await as(E.gatis, async () => {
  const c = await rows(`select phone from profile_contacts where profile_id = $1`, [E.eva]);
  check('0005: the carrier sees the customer\'s phone too', c.length === 1, JSON.stringify(c));
});
await as(U.dace, async () => {
  const c = await rows(`select phone from profile_contacts where profile_id = $1`, [E.eva]);
  check('0005: the carrier whose offer lost sees no contacts', c.length === 0, JSON.stringify(c));
});

// --- 0006 (23.09.2026): "offer my cargo" on a truck notifies the truck's owner ---------------------
await db.exec(read('supabase/migrations/0006_cargo_for_truck.sql'));
let gatisTruckId, linkedId;
await as(E.gatis, async () => {
  gatisTruckId = (await rows(`insert into postings (kind, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code, price)
    values ('truck', $1, 'Rīga', 56.95, 24.11, 'Daugavpils', 55.87, 26.52, current_date + 1, current_date + 1, 'VT10', 350) returning id`, [E.gatis]))[0].id;
});
await as(E.eva, async () => {
  const r = await rows(`insert into postings (kind, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, for_posting_id)
    values ('cargo', $1, 'Rīga', 56.95, 24.11, 'Daugavpils', 55.87, 26.52, current_date + 1, current_date + 1, $2) returning id, for_posting_id`, [E.eva, gatisTruckId]);
  linkedId = r[0].id;
  check('0006: cargo offered on a truck keeps the link to it', r[0].for_posting_id === gatisTruckId, JSON.stringify(r[0]));
  const own = await rows(`insert into postings (kind, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, for_posting_id)
    values ('cargo', $1, 'Rīga', 56.95, 24.11, 'Jelgava', 56.65, 23.71, current_date + 2, current_date + 2, $2) returning for_posting_id`, [E.eva, plainId]);
  check('0006: a link to something that is not someone else\'s open truck is dropped', own[0].for_posting_id === null, JSON.stringify(own[0]));
  await db.query(`update postings set for_posting_id = $2 where id = $1`, [own.length ? (await rows(`select id from postings where owner_id = $1 and to_name = 'Jelgava'`, [E.eva]))[0].id : null, gatisTruckId]);
  const still = await rows(`select for_posting_id from postings where owner_id = $1 and to_name = 'Jelgava'`, [E.eva]);
  check('0006: the link cannot be added later by an update', still[0].for_posting_id === null, JSON.stringify(still));
});
await as(E.gatis, async () => {
  const n = await rows(`select type, payload->>'for_truck' as truck from notifications where user_id = $1 and posting_id = $2`, [E.gatis, linkedId]);
  check('0006: the truck\'s owner is notified once about the cargo offered to him', n.length === 1 && n[0].type === 'match' && n[0].truck === gatisTruckId, JSON.stringify(n));
});
await as(U.dace, async () => {
  const n = await rows(`select id from notifications where posting_id = $1`, [linkedId]);
  check('0006: nobody else gets that notification', n.length === 0, JSON.stringify(n));
});

// --- 0007 (23.09.2026): urgent cargo waits until a moment, with a countdown ---------------------------
await db.exec(read('supabase/migrations/0007_urgent_wait.sql'));
await as(E.eva, async () => {
  const urgent = (await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, wait_until)
    values ('cargo', 'urgent', $1, 'Rīga', 56.95, 24.11, 'Ogre', 56.82, 24.60, current_date, current_date, now() + interval '1 hour')
    returning id, extract(epoch from (wait_until - now()))::int as secs`, [E.eva]))[0];
  check('0007: urgent cargo keeps its waiting time (about 1 h)', urgent.secs > 3500 && urgent.secs <= 3600, JSON.stringify(urgent));
  const far = (await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, wait_until)
    values ('cargo', 'urgent', $1, 'Rīga', 56.95, 24.11, 'Tukums', 56.97, 23.15, current_date, current_date, now() + interval '3 days')
    returning extract(epoch from (wait_until - now()))::int as secs`, [E.eva]))[0];
  check('0007: a waiting time further than 24 h is cut to 24 h', far.secs > 86000 && far.secs <= 86400, JSON.stringify(far));
  const planned = (await rows(`insert into postings (kind, mode, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, wait_until)
    values ('cargo', 'planned', $1, 'Rīga', 56.95, 24.11, 'Bauska', 56.41, 24.19, current_date + 1, current_date + 1, now() + interval '1 hour')
    returning wait_until`, [E.eva]))[0];
  check('0007: only urgent cargo keeps a waiting time', planned.wait_until === null, JSON.stringify(planned));
  await db.query(`update postings set wait_until = now() + interval '10 hours' where id = $1`, [urgent.id]);
  const moved = (await rows(`select extract(epoch from (wait_until - now()))::int as secs from postings where id = $1`, [urgent.id]))[0];
  check('0007: the waiting time cannot be moved later', moved.secs <= 3600, JSON.stringify(moved));
});

// --- 0008 (23.09.2026): the exchange finds pairs and tells both sides; "call him again" -------------
await db.exec(read('supabase/migrations/0008_pairs.sql'));
let alongId, farId;
await as(E.eva, async () => {
  alongId = (await rows(`insert into postings (kind, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to)
    values ('cargo', $1, 'Ogre', 56.82, 24.60, 'Jēkabpils', 56.50, 25.86, current_date + 1, current_date + 2) returning id`, [E.eva]))[0].id;
  farId = (await rows(`insert into postings (kind, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to)
    values ('cargo', $1, 'Liepāja', 56.51, 21.01, 'Ventspils', 57.39, 21.56, current_date + 1, current_date + 2) returning id`, [E.eva]))[0].id;
});
await as(E.gatis, async () => {
  const along = await rows(`select payload->>'for_truck' as truck from notifications where user_id = $1 and posting_id = $2`, [E.gatis, alongId]);
  check('0008: cargo along a carrier\'s open truck route reaches him at once', along.length === 1 && along[0].truck === gatisTruckId, JSON.stringify(along));
  const far = await rows(`select id from notifications where user_id = $1 and posting_id = $2`, [E.gatis, farId]);
  check('0008: cargo far off his route does not', far.length === 0, JSON.stringify(far));
});
let daceTruck;
await as(U.dace, async () => {
  daceTruck = (await rows(`insert into postings (kind, owner_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, date_from, date_to, vehicle_type_code)
    values ('truck', $1, 'Rīga', 56.95, 24.11, 'Daugavpils', 55.87, 26.52, current_date + 2, current_date + 2, 'VT10') returning id`, [U.dace]))[0].id;
});
await as(E.eva, async () => {
  const n = await rows(`select payload->>'kind' as kind, payload->>'for_cargo' as cargo from notifications where user_id = $1 and posting_id = $2`, [E.eva, daceTruck]);
  check('0008: a new truck on the route of an open cargo reaches its customer', n.length === 1 && n[0].kind === 'truck' && n[0].cargo === alongId, JSON.stringify(n));
  await rows(`select nudge_truck($1, $2)`, [alongId, daceTruck]);
  await rows(`select nudge_truck($1, $2)`, [alongId, daceTruck]);
});
await as(U.dace, async () => {
  const n = await rows(`select id from notifications where user_id = $1 and posting_id = $2 and payload->>'nudge' = 'true'`, [U.dace, alongId]);
  check('0008: "call him again" reaches the carrier once, a second tap changes nothing', n.length === 1, JSON.stringify(n));
});
await as(U.boris, async () => {
  const err = await fails(`select nudge_truck($1, $2)`, [alongId, daceTruck]);
  check('0008: only the cargo\'s owner can call a carrier about it', /not found or not open/.test(err || ''), err);
});
await asAnon(async () => {
  const err = await fails(`select nudge_truck($1, $2)`, [alongId, daceTruck]);
  check('0008: a visitor cannot call anyone', !!err, err);
});

// --- 0009 (23.09.2026): facts about a carrier next to his offer ---------------------------------------
await db.exec(read('supabase/migrations/0009_carrier_facts.sql'));
await as(E.eva, async () => {
  const f = await rows(`select user_id, deals_done, vehicle_type_code, tonnage_t::float as t, member_since is not null as since from carrier_facts($1)`, [[U.boris, E.gatis]]);
  const boris = f.find((x) => x.user_id === U.boris), gatis = f.find((x) => x.user_id === E.gatis);
  check('0009: facts show the carrier\'s vehicle, payload and since when he is here', boris && boris.vehicle_type_code === 'VT10' && boris.t === 8 && boris.since, JSON.stringify(boris));
  check('0009: deals closed on Paceļam are counted (Gatis: 1)', gatis && gatis.deals_done === 1, JSON.stringify(gatis));
  const cols = Object.keys(f[0] || {});
  check('0009: no contacts or plates among the facts', !cols.some((c) => /phone|mail|plate|company/.test(c)), cols.join(','));
});
await asAnon(async () => {
  const err = await fails(`select * from carrier_facts($1)`, [[U.boris]]);
  check('0009: a visitor gets no facts', !!err, err);
});

console.log(`\n${results.length} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
