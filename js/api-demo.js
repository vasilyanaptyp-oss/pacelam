// Demo backend: the same API surface as api-supabase.js, kept in this browser only.
// Lets the client click through every flow before the database is connected. The rules
// mirror supabase/migrations/0001_init.sql; the database version is the source of truth.
import { VEHICLE_GROUPS, VEHICLE_TYPES, CARGO_TYPES } from './data.js?v=806ca22a';
import { blobToDataUrl } from './photos.js?v=806ca22a';

const KEY = 'pacelam.demo';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const iso = (d) => new Date(d).toISOString();
const day = (n) => { const d = new Date(Date.now() + n * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const ago = (min) => iso(Date.now() - min * 60000);

const toRad = (d) => (d * Math.PI) / 180;
const km = (a, b, c, d) => 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(Math.sin(toRad(c - a) / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(toRad(d - b) / 2) ** 2)));

const U = {
  boris: 'd0000000-0000-4000-8000-000000000001',
  anna: 'd0000000-0000-4000-8000-000000000002',
  op: 'd0000000-0000-4000-8000-000000000003',
  janis: 'd0000000-0000-4000-8000-000000000004',
  ilze: 'd0000000-0000-4000-8000-000000000005',
  tomas: 'd0000000-0000-4000-8000-000000000006',
};
const P = { riga: [56.95, 24.11], dgp: [55.87, 26.52], rez: [56.51, 27.33], jel: [56.65, 23.71], lie: [56.51, 21.01], ven: [57.39, 21.56], kra: [55.90, 27.17], vil: [54.69, 25.28], ces: [57.31, 25.27], val: [57.54, 25.43], tar: [58.38, 26.72], jek: [56.50, 25.86], liv: [56.35, 26.18] };

function seed() {
  const profiles = {
    [U.boris]: { created_at: ago(9000), id: U.boris, role: 'carrier', display_name: 'Boriss', city_name: 'Daugavpils', city_lat: 55.87, city_lng: 26.52, lang: 'ru', max_detour_km: 60, is_operator: false, subscription_until: null },
    [U.anna]: { created_at: ago(8000), id: U.anna, role: 'customer', display_name: 'Anna', city_name: 'Rīga', city_lat: 56.95, city_lng: 24.11, lang: 'lv', max_detour_km: 60, is_operator: false, subscription_until: null },
    [U.op]: { created_at: ago(12000), id: U.op, role: 'customer', display_name: 'SOS Evakuators', city_name: 'Daugavpils', city_lat: 55.87, city_lng: 26.52, lang: 'lv', max_detour_km: 60, is_operator: true, subscription_until: null },
    [U.janis]: { created_at: ago(15000), id: U.janis, role: 'carrier', display_name: 'Jānis K.', city_name: 'Rēzekne', city_lat: 56.51, city_lng: 27.33, lang: 'lv', max_detour_km: 80, is_operator: false, subscription_until: null },
    [U.ilze]: { created_at: ago(10000), id: U.ilze, role: 'customer', display_name: 'Ilze SIA Būvnieks', city_name: 'Jelgava', city_lat: 56.65, city_lng: 23.71, lang: 'lv', max_detour_km: 60, is_operator: false, subscription_until: null },
    [U.tomas]: { created_at: ago(4000), id: U.tomas, role: 'carrier', display_name: 'Tomas', city_name: 'Vilnius', city_lat: 54.69, city_lng: 25.28, lang: 'en', max_detour_km: 100, is_operator: false, subscription_until: null },
  };
  const contacts = {
    [U.boris]: { profile_id: U.boris, phone: '+371 20000002', email: 'boriss@example.com', company: 'SIA Boriss Trans' },
    [U.anna]: { profile_id: U.anna, phone: '+371 20000001', email: 'anna@example.com', company: null },
    [U.op]: { profile_id: U.op, phone: '+371 22002700', email: 'tktrans@example.com', company: 'SIA TK Trans' },
    [U.janis]: { profile_id: U.janis, phone: '+371 20000004', email: null, company: null },
    [U.ilze]: { profile_id: U.ilze, phone: '+371 20000005', email: 'ilze@example.com', company: 'SIA Būvnieks' },
    [U.tomas]: { profile_id: U.tomas, phone: '+370 60000006', email: null, company: 'UAB Tomas' },
  };
  const vehicles = [
    { id: uuid(), owner_id: U.boris, type_code: 'VT10', plate: 'KM-1234', tonnage_t: 8, volume_m3: 40, length_m: 7.2, width_m: 2.45, height_m: 2.4, note: null, is_default: true, created_at: ago(9000) },
    { id: uuid(), owner_id: U.janis, type_code: 'VT16', plate: null, tonnage_t: 20, volume_m3: 90, length_m: 13.6, width_m: 2.45, height_m: 2.7, note: null, is_default: true, created_at: ago(14000) },
    { id: uuid(), owner_id: U.tomas, type_code: 'VT10', plate: null, tonnage_t: 5, volume_m3: 30, length_m: 7.2, width_m: 2.45, height_m: 2.4, note: null, is_default: true, created_at: ago(3900) },
    { id: uuid(), owner_id: U.boris, type_code: 'VT08', plate: 'KM-5678', tonnage_t: 3.5, volume_m3: null, length_m: 5.5, width_m: 2.2, height_m: null, note: null, is_default: false, created_at: ago(8000) },
  ];
  const mk = (o) => ({ id: uuid(), currency: 'EUR', status: 'open', from_radius_km: 0, to_radius_km: 0, cargo_fields: {}, photos: [], note: null, is_operator_posting: false, bid_count: 0, best_bid: null, vehicle_id: null, weight_kg: null, length_m: null, width_m: null, height_m: null, volume_m3: null, price: null, ...o });
  const at = (name, [lat, lng]) => ({ name, lat, lng });
  const route = (f, fp, t, tp) => ({ from_name: f, from_lat: fp[0], from_lng: fp[1], to_name: t, to_lat: tp[0], to_lng: tp[1] });
  const postings = [
    mk({ kind: 'cargo', mode: 'urgent', owner_id: U.op, ...route('Daugavpils', P.dgp, 'Rīga', P.riga), date_from: day(0), date_to: day(0), vehicle_type_code: 'VT08', cargo_type_id: 'vehicle', weight_kg: 1450, length_m: 4.5, width_m: 1.8, height_m: 1.5, cargo_fields: { rolls: false, all_wheels: true, location: 'roadside', model: 'VW Passat 2012' }, price: null, is_operator_posting: true, note: 'Pēc avārijas, stāv uz A6 pie Līvāniem. Zvanīt uzreiz.', created_at: ago(14), demo_wait_min: 75 }),
    mk({ kind: 'cargo', mode: 'planned', owner_id: U.anna, ...route('Rēzekne', P.rez, 'Rīga', P.riga), date_from: day(2), date_to: day(3), vehicle_type_code: 'VT10', cargo_type_id: 'pallets', weight_kg: 2400, length_m: 2.4, width_m: 1.2, height_m: 1.6, volume_m3: 4.6, cargo_fields: { pallet_count: 4, stackable: false }, price: null, bid_count: 2, best_bid: 170, created_at: ago(95) }),
    mk({ kind: 'cargo', mode: 'planned', owner_id: U.ilze, ...route('Jelgava', P.jel, 'Daugavpils', P.dgp), date_from: day(1), date_to: day(4), vehicle_type_code: null, cargo_type_id: 'building', weight_kg: 1800, length_m: 2.4, width_m: 1.2, height_m: 1.2, cargo_fields: { packed: 'pallets' }, price: null, bid_count: 1, best_bid: 210, note: 'Ģipškartons, 3 paletes. Iekraušana ar iekrāvēju.', created_at: ago(200) }),
    mk({ kind: 'truck', mode: 'planned', owner_id: U.janis, ...route('Rīga', P.riga, 'Daugavpils', P.dgp), date_from: day(1), date_to: day(1), vehicle_type_code: 'VT16', weight_kg: 20000, volume_m3: 90, length_m: 13.6, width_m: 2.45, height_m: 2.7, price: 350, created_at: ago(40) }),
    mk({ kind: 'cargo', mode: 'planned', owner_id: U.ilze, ...route('Liepāja', P.lie, 'Ventspils', P.ven), date_from: day(3), date_to: day(5), vehicle_type_code: 'VT11', cargo_type_id: 'machinery', weight_kg: 2800, length_m: 3.9, width_m: 1.6, height_m: 2.4, cargo_fields: { self_propelled: true, tracked: true }, price: null, created_at: ago(310) }),
    mk({ kind: 'cargo', mode: 'urgent', owner_id: U.op, ...route('Krāslava', P.kra, 'Daugavpils', P.dgp), date_from: day(0), date_to: day(0), vehicle_type_code: 'VT08', cargo_type_id: 'vehicle', weight_kg: 1200, cargo_fields: { rolls: true, all_wheels: true, location: 'parking', model: 'Toyota Yaris' }, price: null, is_operator_posting: true, created_at: ago(3), demo_wait_min: 55 }),
    mk({ kind: 'truck', mode: 'planned', owner_id: U.boris, ...route('Vilnius', P.vil, 'Rīga', P.riga), date_from: day(2), date_to: day(2), vehicle_type_code: 'VT10', weight_kg: 5000, volume_m3: 30, length_m: 7.2, width_m: 2.45, height_m: 2.4, price: null, note: 'Atpakaļceļš, brīva puse kravas kastes.', created_at: ago(600) }),
    mk({ kind: 'cargo', mode: 'planned', owner_id: U.anna, ...route('Cēsis', P.ces, 'Rīga', P.riga), date_from: day(1), date_to: day(2), vehicle_type_code: 'LTL', cargo_type_id: 'pallets', weight_kg: 600, length_m: 1.2, width_m: 0.8, height_m: 1.4, volume_m3: 1.3, cargo_fields: { pallet_count: 2, stackable: true }, price: null, created_at: ago(1300) }),
    mk({ kind: 'cargo', mode: 'planned', owner_id: U.ilze, ...route('Daugavpils', P.dgp, 'Vilnius', P.vil), date_from: day(4), date_to: day(6), vehicle_type_code: 'VT20', cargo_type_id: 'bulk', weight_kg: 11000, volume_m3: 8, cargo_fields: { material: 'gravel' }, price: null, created_at: ago(2000) }),
    mk({ kind: 'cargo', mode: 'planned', owner_id: U.anna, ...route('Valmiera', P.val, 'Tartu', P.tar), date_from: day(5), date_to: day(7), vehicle_type_code: 'VT18', cargo_type_id: 'oversize', weight_kg: 9000, length_m: 12, width_m: 3.2, height_m: 3.4, cargo_fields: { escort_needed: true }, price: null, created_at: ago(2900) }),
  ];
  const bids = [
    { id: uuid(), posting_id: postings[1].id, bidder_id: U.janis, amount: 170, note: null, status: 'active', created_at: ago(60) },
    { id: uuid(), posting_id: postings[1].id, bidder_id: U.tomas, amount: 190, note: 'Rīt no rīta', status: 'active', created_at: ago(50) },
    { id: uuid(), posting_id: postings[2].id, bidder_id: U.tomas, amount: 210, note: null, status: 'active', created_at: ago(120) },
  ];
  const searches = [
    { id: uuid(), owner_id: U.boris, name: null, kind: 'cargo', center_name: 'Daugavpils', center_lat: 55.87, center_lng: 26.52, radius_km: 77, dest_name: null, dest_lat: null, dest_lng: null, dest_radius_km: null, vehicle_type_codes: ['VT10', 'VT08'], cargo_type_ids: [], modes: ['urgent', 'planned'], notify_browser: true, notify_email: false, is_active: true, created_at: ago(5000) },
  ];
  const notifications = [
    { id: uuid(), user_id: U.boris, type: 'match', posting_id: postings[0].id, bid_id: null, deal_id: null, payload: { from: 'Daugavpils', to: 'Rīga', kind: 'cargo', mode: 'urgent', price: 140 }, deliver_after: ago(14), created_at: ago(14), read_at: null },
    { id: uuid(), user_id: U.anna, type: 'bid', posting_id: postings[1].id, bid_id: bids[0].id, deal_id: null, payload: { amount: 170, from: 'Rēzekne', to: 'Rīga', above_price: false }, deliver_after: ago(60), created_at: ago(60), read_at: null },
  ];
  return { profiles, contacts, vehicles, postings, bids, deals: [], unlocks: [], searches, notifications, settings: { free_delay_minutes: 0 }, session: null, lastRoute: {} };
}

export function createDemoApi() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  // version 8 (23.09.2026 evening): a fresh demo after the client's edits — a truck posted under the sample customer
  // (his 22:49 screenshot) should not stay in anyone's browser
  if (!db || db.version !== 8) { db = { version: 8, seededOn: day(0), ...seed() }; }
  // sample urgent calls keep counting down: a finished sample wait is re-armed on load
  for (const p of db.postings) if (p.demo_wait_min && p.status === 'open' && (!p.wait_until || new Date(p.wait_until) <= new Date())) p.wait_until = iso(Date.now() + p.demo_wait_min * 60000);
  // Demo dates are relative to "today": shift everything by the days elapsed since seeding so the
  // board never goes stale for someone who opens the link a week later.
  {
    const elapsed = Math.round((new Date(day(0)) - new Date(db.seededOn || day(0))) / 86400000);
    if (elapsed > 0) {
      const shift = (d) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + elapsed); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
      const shiftIso = (s) => new Date(new Date(s).getTime() + elapsed * 86400000).toISOString();
      for (const p of db.postings) { p.date_from = shift(p.date_from); p.date_to = shift(p.date_to); p.created_at = shiftIso(p.created_at); if (p.updated_at) p.updated_at = shiftIso(p.updated_at); }
      for (const b of db.bids) b.created_at = shiftIso(b.created_at);
      for (const n of db.notifications) { n.created_at = shiftIso(n.created_at); n.deliver_after = shiftIso(n.deliver_after); }
      db.seededOn = day(0);
    }
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const listeners = new Set();
  const uid = () => db.session?.user?.id || null;
  const need = () => { if (!uid()) throw new Error('not authenticated'); return uid(); };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const owner = (id) => { const p = db.profiles[id]; return p ? { id: p.id, display_name: p.display_name, city_name: p.city_name } : null; };
  const withOwner = (p) => ({ ...clone(p), owner: owner(p.owner_id) });
  const canSee = (me, ownerId) => me && (me === ownerId || db.unlocks.some((u) => u.viewer_id === me && u.owner_id === ownerId));
  const notify = (user_id, type, posting, extra = {}) => {
    db.notifications.unshift({ id: uuid(), user_id, type, posting_id: posting?.id || null, bid_id: extra.bid_id || null, deal_id: extra.deal_id || null,
      payload: { from: posting?.from_name, to: posting?.to_name, kind: posting?.kind, mode: posting?.mode, amount: extra.amount ?? null, above_price: extra.above_price ?? false, ...(extra.payload || {}) }, deliver_after: iso(Date.now()), created_at: iso(Date.now()), read_at: null });
  };
  const recount = (postingId) => {
    const p = db.postings.find((x) => x.id === postingId);
    const active = db.bids.filter((b) => b.posting_id === postingId && b.status === 'active');
    p.bid_count = active.length;
    p.best_bid = active.length ? (p.kind === 'truck' ? Math.max(...active.map((b) => b.amount)) : Math.min(...active.map((b) => b.amount))) : null;
  };
  const unlock = (deal) => {
    for (const [v, o] of [[deal.customer_id, deal.carrier_id], [deal.carrier_id, deal.customer_id]]) {
      if (!db.unlocks.some((u) => u.viewer_id === v && u.owner_id === o)) db.unlocks.push({ viewer_id: v, owner_id: o, deal_id: deal.id, created_at: iso(Date.now()) });
    }
  };
  const matchSearches = (p) => {
    for (const s of db.searches) {
      if (!s.is_active || s.kind !== p.kind || s.owner_id === p.owner_id || !s.modes.includes(p.mode)) continue;
      if (s.vehicle_type_codes.length && p.vehicle_type_code && !s.vehicle_type_codes.includes(p.vehicle_type_code)) continue;
      if (s.cargo_type_ids.length && p.cargo_type_id && !s.cargo_type_ids.includes(p.cargo_type_id)) continue;
      if (km(s.center_lat, s.center_lng, p.from_lat, p.from_lng) > s.radius_km + p.from_radius_km) continue;
      if (s.dest_lat != null && km(s.dest_lat, s.dest_lng, p.to_lat, p.to_lng) > (s.dest_radius_km || 0) + p.to_radius_km) continue;
      notify(s.owner_id, 'match', p, { amount: p.price });
    }
  };
  // 0008: a cargo fits a truck when the detour it adds is within the carrier's max_detour_km and the days overlap
  const detourOf = (t, c) => Math.max(0, km(t.from_lat, t.from_lng, c.from_lat, c.from_lng) + km(c.from_lat, c.from_lng, c.to_lat, c.to_lng) + km(c.to_lat, c.to_lng, t.to_lat, t.to_lng) - km(t.from_lat, t.from_lng, t.to_lat, t.to_lng));
  const fits = (t, c) => t.status === 'open' && c.status === 'open' && t.owner_id !== c.owner_id && t.date_from <= c.date_to && c.date_from <= t.date_to && detourOf(t, c) <= (db.profiles[t.owner_id]?.max_detour_km ?? 60);
  const told = (user, postingId) => db.notifications.some((n) => n.user_id === user && n.posting_id === postingId);
  const notifyPairs = (row) => {
    const seen = new Set();
    for (const other of db.postings) {
      if (other.kind === row.kind) continue;
      const truck = row.kind === 'truck' ? row : other, cargo = row.kind === 'cargo' ? row : other;
      if (seen.has(other.owner_id) || !fits(truck, cargo) || told(other.owner_id, row.id)) continue;
      seen.add(other.owner_id);
      notify(other.owner_id, 'match', row, { payload: row.kind === 'cargo' ? { for_truck: truck.id } : { kind: 'truck', for_cargo: cargo.id } });
    }
  };
  const emit = () => listeners.forEach((fn) => fn(db.session));

  const api = {
    mode: 'demo',
    demoUsers: [{ id: U.boris, key: 'demo_carrier' }, { id: U.anna, key: 'demo_customer' }, { id: U.op, key: 'demo_operator' }],
    onAuth: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    getSession: () => db.session,
    userId: uid,
    photoUrl: (p) => p,
    resetDemo() { db = { version: 8, seededOn: day(0), ...seed() }; for (const p of db.postings) if (p.demo_wait_min) p.wait_until = iso(Date.now() + p.demo_wait_min * 60000); save(); emit(); },

    async signInDemo(id) { db.session = { user: { id, email: db.contacts[id]?.email || '' } }; save(); emit(); return db.session; },
    async signUp() { throw new Error('demo'); },
    async signIn() { throw new Error('demo'); },
    async signOut() { db.session = null; save(); emit(); },
    async resetPassword() { return null; },

    async getVehicleTypes() { return VEHICLE_TYPES.map((t) => ({ code: t.code, group_id: t.group, sort: t.sort, name_lv: t.name.lv, name_ru: t.name.ru, name_en: t.name.en, tonnage_from: t.tonnage_from ?? null, tonnage_to: t.tonnage_to ?? null, length_m: t.length_m ?? null, volume_m3: t.volume_m3 ?? null, flags: {} })); },
    async getVehicleGroups() { return VEHICLE_GROUPS.map((g) => ({ id: g.id, sort: g.sort, name_lv: g.name.lv, name_ru: g.name.ru, name_en: g.name.en })); },
    async getCargoTypes() { return CARGO_TYPES.map((c) => ({ id: c.id, sort: c.sort, name_lv: c.name.lv, name_ru: c.name.ru, name_en: c.name.en, fields: c.fields, is_provisional: !!c.provisional, is_active: true })); },

    async getMe() {
      const id = uid(); if (!id) return null;
      return { profile: clone(db.profiles[id] || null), contacts: clone(db.contacts[id] || null), vehicles: clone(db.vehicles.filter((v) => v.owner_id === id)) };
    },
    async saveProfile(p) { const id = need(); const prev = db.profiles[id] || { id, is_operator: false, subscription_until: null }; db.profiles[id] = { ...prev, ...p, id, is_operator: prev.is_operator, subscription_until: prev.subscription_until }; save(); return clone(db.profiles[id]); },
    async saveContacts(c) { const id = need(); db.contacts[id] = { ...(db.contacts[id] || {}), ...c, profile_id: id }; save(); return clone(db.contacts[id]); },
    async addVehicle(v) { const id = need(); const row = { id: uuid(), created_at: iso(Date.now()), is_default: false, ...v, owner_id: id }; if (row.is_default) db.vehicles.forEach((x) => { if (x.owner_id === id) x.is_default = false; }); db.vehicles.push(row); save(); return clone(row); },
    async updateVehicle(vid, v) { const row = db.vehicles.find((x) => x.id === vid && x.owner_id === uid()); Object.assign(row, v); save(); return clone(row); },
    async deleteVehicle(vid) { db.vehicles = db.vehicles.filter((x) => !(x.id === vid && x.owner_id === uid())); save(); },
    async setDefaultVehicle(vid) { db.vehicles.forEach((x) => { if (x.owner_id === uid()) x.is_default = x.id === vid; }); save(); },
    async getContacts(ownerId) { return canSee(uid(), ownerId) ? clone(db.contacts[ownerId] || null) : null; },

    async listPostings() {
      const t = day(0);
      return db.postings.filter((p) => ['open', 'pending'].includes(p.status) && p.date_to >= t).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(withOwner);
    },
    async getPosting(id) {
      const p = db.postings.find((x) => x.id === id);
      if (!p) return null;
      const me = uid();
      const deal = db.deals.find((d) => d.posting_id === id && (d.customer_id === me || d.carrier_id === me)) || null;
      const visible = p.owner_id === me || !!deal || ['open', 'pending'].includes(p.status);
      if (!visible) return null;
      const bids = me ? db.bids.filter((b) => b.posting_id === id && (b.bidder_id === me || p.owner_id === me)).sort((a, b) => a.amount - b.amount).map((b) => ({ ...clone(b), bidder: owner(b.bidder_id) })) : [];
      return { posting: withOwner(p), bids, deal: clone(deal) };
    },
    async createPosting(p) {
      const id = need();
      const row = { id: uuid(), currency: 'EUR', from_radius_km: 0, to_radius_km: 0, cargo_fields: {}, photos: [], note: null, weight_kg: null, length_m: null, width_m: null, height_m: null, volume_m3: null, price: null, vehicle_id: null, vehicle_type_code: null, cargo_type_id: null, ...p, owner_id: id, status: 'open', bid_count: 0, best_bid: null, created_at: iso(Date.now()), updated_at: iso(Date.now()) };
      row.is_operator_posting = !!(p.is_operator_posting && db.profiles[id]?.is_operator);
      if (row.kind === 'truck') { row.mode = 'planned'; row.cargo_type_id = null; row.cargo_fields = {}; }
      if (row.kind !== 'cargo' || row.mode !== 'urgent') row.wait_until = null;   // 0007: only urgent cargo waits, 5 min .. 24 h
      else if (row.wait_until) row.wait_until = iso(Math.min(Math.max(new Date(row.wait_until).getTime(), Date.now() + 5 * 60000), Date.now() + 24 * 3600000));
      // "offer my cargo" on a truck: the link counts only for someone else's open truck, and its owner is told (0006)
      const truck = row.for_posting_id ? db.postings.find((x) => x.id === row.for_posting_id) : null;
      if (row.for_posting_id && (row.kind !== 'cargo' || !truck || truck.kind !== 'truck' || truck.status !== 'open' || truck.owner_id === id)) row.for_posting_id = null;
      db.postings.unshift(row); matchSearches(row);
      if (row.for_posting_id && !db.notifications.some((n) => n.user_id === truck.owner_id && n.posting_id === row.id)) notify(truck.owner_id, 'match', row);
      notifyPairs(row);
      save();
      return withOwner(row);
    },
    async updatePosting(id, p) { const row = db.postings.find((x) => x.id === id && x.owner_id === uid()); if (!row) throw new Error('posting not found'); if (row.status !== 'open') throw new Error('posting is not open'); Object.assign(row, p, { updated_at: iso(Date.now()), for_posting_id: row.for_posting_id ?? null, wait_until: row.wait_until ?? null }); save(); return withOwner(row); },
    async myPostings() { return db.postings.filter((p) => p.owner_id === uid()).map(withOwner); },
    async myBids() { return db.bids.filter((b) => b.bidder_id === uid()).map((b) => ({ ...clone(b), posting: withOwner(db.postings.find((p) => p.id === b.posting_id)) })); },
    async myDeals() { const me = uid(); return db.deals.filter((d) => d.customer_id === me || d.carrier_id === me).map((d) => ({ ...clone(d), posting: withOwner(db.postings.find((p) => p.id === d.posting_id)) })); },
    async closePosting(id) {
      const p = db.postings.find((x) => x.id === id && x.owner_id === uid());
      if (!p || !['open', 'pending'].includes(p.status)) throw new Error('posting not found or not open');
      p.status = 'closed';
      db.deals.forEach((d) => { if (d.posting_id === id && d.status === 'pending') d.status = 'cancelled'; });
      db.bids.forEach((b) => { if (b.posting_id === id && b.status === 'active') b.status = 'rejected'; });
      recount(id); save();
    },

    async placeBid(postingId, amount, note) {
      const me = need();
      const p = db.postings.find((x) => x.id === postingId);
      if (!p) throw new Error('posting not found');
      if (p.owner_id === me) throw new Error('own posting');
      if (p.status !== 'open') throw new Error('posting is not open');
      if (!(amount > 0)) throw new Error('amount must be positive');
      let b = db.bids.find((x) => x.posting_id === postingId && x.bidder_id === me);
      if (b) Object.assign(b, { amount, note: note || null, status: 'active' });
      else { b = { id: uuid(), posting_id: postingId, bidder_id: me, amount, note: note || null, status: 'active', created_at: iso(Date.now()) }; db.bids.push(b); }
      recount(postingId);
      notify(p.owner_id, 'bid', p, { amount, bid_id: b.id, above_price: p.price != null && amount > p.price });
      save(); return b.id;
    },
    async withdrawBid(bidId) { const b = db.bids.find((x) => x.id === bidId && x.bidder_id === uid() && x.status === 'active'); if (!b) throw new Error('bid not found or not active'); b.status = 'withdrawn'; recount(b.posting_id); save(); },
    async acceptBid(bidId) {
      const me = need();
      const b = db.bids.find((x) => x.id === bidId); if (!b) throw new Error('bid not found');
      const p = db.postings.find((x) => x.id === b.posting_id);
      if (p.owner_id !== me) throw new Error('only the posting owner can accept');
      if (p.status !== 'open') throw new Error('posting is not open');
      if (b.status !== 'active') throw new Error('bid is not active');
      b.status = 'accepted';
      if (p.mode === 'urgent' || p.kind === 'cargo') {
        // the carrier committed by naming his price: the customer's "Agree" closes the deal at once
        // (urgent since 13.09; every cargo since 23.09 — mirrors 0005_carrier_price.sql)
        const d = { id: uuid(), posting_id: p.id, customer_id: p.kind === 'cargo' ? p.owner_id : b.bidder_id, carrier_id: p.kind === 'cargo' ? b.bidder_id : p.owner_id, bid_id: b.id, amount: b.amount, status: 'confirmed', customer_confirmed_at: iso(Date.now()), carrier_confirmed_at: iso(Date.now()), created_at: iso(Date.now()) };
        db.deals.push(d); p.status = 'deal';
        db.bids.forEach((x) => { if (x.posting_id === p.id && x.status === 'active') x.status = 'rejected'; });
        recount(p.id); unlock(d);
        notify(b.bidder_id, 'deal', p, { amount: b.amount, deal_id: d.id }); notify(p.owner_id, 'deal', p, { amount: b.amount, deal_id: d.id });
        save(); return d.id;
      }
      const d = { id: uuid(), posting_id: p.id, customer_id: p.kind === 'cargo' ? p.owner_id : b.bidder_id, carrier_id: p.kind === 'cargo' ? b.bidder_id : p.owner_id, bid_id: b.id, amount: b.amount, status: 'pending',
        customer_confirmed_at: p.kind === 'cargo' ? iso(Date.now()) : null, carrier_confirmed_at: p.kind === 'truck' ? iso(Date.now()) : null, created_at: iso(Date.now()) };
      db.deals.push(d); p.status = 'pending'; recount(p.id);
      notify(b.bidder_id, 'accepted', p, { amount: b.amount, bid_id: b.id, deal_id: d.id });
      save(); return d.id;
    },
    async takePosting(postingId) {
      const me = need();
      const p = db.postings.find((x) => x.id === postingId); if (!p) throw new Error('posting not found');
      if (p.owner_id === me) throw new Error('own posting');
      if (p.status !== 'open') throw new Error('already taken');
      if (p.mode === 'urgent') throw new Error('urgent postings are bid on, not taken');
      if (p.price == null) throw new Error('no instant price, place a bid');
      const d = { id: uuid(), posting_id: p.id, customer_id: p.kind === 'cargo' ? p.owner_id : me, carrier_id: p.kind === 'cargo' ? me : p.owner_id, bid_id: null, amount: p.price, status: 'confirmed', customer_confirmed_at: iso(Date.now()), carrier_confirmed_at: iso(Date.now()), created_at: iso(Date.now()) };
      db.deals.push(d); p.status = 'deal';
      db.bids.forEach((b) => { if (b.posting_id === p.id && b.status === 'active') b.status = 'rejected'; });
      recount(p.id); unlock(d);
      notify(p.owner_id, 'taken', p, { amount: p.price, deal_id: d.id }); notify(me, 'deal', p, { amount: p.price, deal_id: d.id });
      save(); return d.id;
    },
    async confirmDeal(dealId) {
      const me = need();
      const d = db.deals.find((x) => x.id === dealId); if (!d) throw new Error('deal not found');
      if (d.status !== 'pending') throw new Error('deal is not pending');
      if (me === d.customer_id) d.customer_confirmed_at = d.customer_confirmed_at || iso(Date.now());
      else if (me === d.carrier_id) d.carrier_confirmed_at = d.carrier_confirmed_at || iso(Date.now());
      else throw new Error('not a party of this deal');
      if (d.customer_confirmed_at && d.carrier_confirmed_at) {
        d.status = 'confirmed';
        const p = db.postings.find((x) => x.id === d.posting_id); p.status = 'deal';
        db.bids.forEach((b) => { if (b.posting_id === p.id && b.status === 'active') b.status = 'rejected'; });
        recount(p.id); unlock(d);
        notify(d.customer_id, 'deal', p, { amount: d.amount, deal_id: d.id }); notify(d.carrier_id, 'deal', p, { amount: d.amount, deal_id: d.id });
      }
      save();
    },
    async cancelDeal(dealId) {
      const me = need();
      const d = db.deals.find((x) => x.id === dealId); if (!d) throw new Error('deal not found');
      if (me !== d.customer_id && me !== d.carrier_id) throw new Error('not a party of this deal');
      if (d.status !== 'pending') throw new Error('only pending deals can be cancelled');
      d.status = 'cancelled';
      const b = db.bids.find((x) => x.id === d.bid_id); if (b) b.status = 'rejected';
      const p = db.postings.find((x) => x.id === d.posting_id); if (p.status === 'pending') p.status = 'open';
      recount(p.id);
      notify(me === d.customer_id ? d.carrier_id : d.customer_id, 'cancelled', p, { deal_id: d.id });
      save();
    },

    // 0009: facts next to an offer — vehicle and payload, deals closed here, since when; no contacts, no plates
    async carrierFacts(ids) {
      need();
      return (ids || []).slice(0, 50).filter((id) => db.profiles[id]).map((id) => {
        const v = db.vehicles.filter((x) => x.owner_id === id).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))[0];
        return { user_id: id, deals_done: db.deals.filter((d) => d.carrier_id === id && d.status === 'confirmed').length, vehicle_type_code: v?.type_code || null, tonnage_t: v?.tonnage_t ?? null, member_since: db.profiles[id].created_at || null };
      });
    },
    async nudgeTruck(cargoId, truckId) {
      const me = need();
      const c = db.postings.find((x) => x.id === cargoId), t = db.postings.find((x) => x.id === truckId);
      if (!c || c.owner_id !== me || c.kind !== 'cargo' || c.status !== 'open' || !t || t.kind !== 'truck' || t.status !== 'open' || t.owner_id === me) throw new Error('posting not found or not open');
      if (db.notifications.some((n) => n.user_id === t.owner_id && n.posting_id === c.id && n.payload?.nudge)) return;   // once per pair
      notify(t.owner_id, 'match', c, { payload: { for_truck: t.id, nudge: true } }); save();
    },
    async listSearches() { return clone(db.searches.filter((s) => s.owner_id === uid())); },
    async saveSearch(s) { const row = { id: uuid(), created_at: iso(Date.now()), is_active: true, name: null, dest_name: null, dest_lat: null, dest_lng: null, dest_radius_km: null, vehicle_type_codes: [], cargo_type_ids: [], modes: ['urgent', 'planned'], notify_browser: true, notify_email: false, ...s, owner_id: need() }; db.searches.push(row); save(); return clone(row); },
    async deleteSearch(id) { db.searches = db.searches.filter((s) => !(s.id === id && s.owner_id === uid())); save(); },

    async listNotifications() { return clone(db.notifications.filter((n) => n.user_id === uid())); },
    async markRead(ids) { db.notifications.forEach((n) => { if (n.user_id === uid() && ids.includes(n.id) && !n.read_at) n.read_at = iso(Date.now()); }); save(); },

    async uploadPhoto(blob) { return blobToDataUrl(blob); },
  };
  return api;
}
