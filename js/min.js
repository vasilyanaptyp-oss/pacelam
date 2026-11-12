// Paceļam, the minimal version (client's request, 08-10.11.2026: make the app simpler; the model is the
// insurers' tow app: a list of plain cards, then a card with a map on top and round buttons).
// The look is the app's own (dark, amber, blue for cargo, sheets that slide): the client's partner asked to keep it.
// Only screens live here. The data layer (api-demo.js / api-supabase.js) and every rule in the database are untouched:
// only the carrier names a price, offers are blind, phones open after a deal.
import { api } from './api.js?v=16d5107b';
import { setLang, getLang, detectLang, LANGS, nameOf, labelOf, locale } from './i18n.js?v=16d5107b';
import { t } from './i18n-min.js?v=16d5107b';
import { h, $, clear, icon, icons, toast, sheet, fmtInt, fmtNum, fmtDate, isoDate, addDays, navigate } from './ui.js?v=16d5107b';
import { searchCities, nearestCity, haversineKm, detourKm } from './geo.js?v=16d5107b';
import { compressPhoto } from './photos.js?v=16d5107b';

icons.nav = '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M9 14.5v-3h5.5M12.5 9l2.5 2.5-2.5 2.5"/>';
icons.chev = '<path d="M9 6l6 6-6 6"/>';

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked or full */ } },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
// "1 200" and "1,5" are numbers too
const num = (v) => { const s = String(v ?? '').trim().replace(/[\s  ]/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
// the same limits as the database (0011)
const LIMITS = { weight_kg: [1, 60000], length_m: [0.01, 60], width_m: [0.01, 10], height_m: [0.01, 10], amount: [1, 100000], tonnage_t: [0.1, 60] };
const badNumber = (obj, keys) => keys.find((k) => { const raw = obj[k]; if (raw == null || String(raw).trim() === '') return false; const n = num(raw); const [lo, hi] = LIMITS[k]; return n == null || n < lo || n > hi; }) || null;
const ZONES = [25, 50, 100, 200];
const WAITS = [30, 60, 120, 240];

const state = {
  session: api.getSession(),
  me: null,
  ref: { vehicleTypes: [], groups: [], cargoTypes: [] },
  role: ['customer', 'carrier'].includes(store.get('pacelam.min.role')) ? store.get('pacelam.min.role') : null,
  showAll: false,
  after: null,
};
const view = $('#view');
const bar = $('#bar');
const foot = $('#foot');
// the screens walked through inside the app: "back" in the header steps back along them, never out of the app
const trail = [location.hash];
const go = (hash) => navigate(hash);
const myId = () => api.userId();
const profile = () => state.me?.profile || null;
const ctype = (id) => state.ref.cargoTypes.find((c) => c.id === id) || null;
const vtype = (code) => state.ref.vehicleTypes.find((v) => v.code === code) || null;
const vtName = (code) => { const v = vtype(code); return v ? nameOf(v) : ''; };
// what is kept on the phone may be broken or foreign (red team, 12.11.2026): a place is a name and two numbers, or nothing
const isPlace = (x) => !!x && typeof x === 'object' && typeof x.name === 'string' && x.name.length > 0 && Number.isFinite(x.lat) && Number.isFinite(x.lng);
const place = (x) => (isPlace(x) ? { name: x.name, lat: x.lat, lng: x.lng } : null);
const here = () => (profile()?.city_lat != null ? place({ name: profile().city_name, lat: profile().city_lat, lng: profile().city_lng }) : place(store.get('pacelam.here')));
const zoneKm = () => { const z = Number(profile()?.zone_km ?? store.get('pacelam.min.zone', 50)); return Number.isFinite(z) && z > 0 && z <= 1000 ? z : 50; };
const maxDetour = () => profile()?.max_detour_km ?? 60;
const profileFields = () => { const p = profile() || {}; return { role: p.role || state.role || 'customer', display_name: p.display_name || '', city_name: p.city_name ?? null, city_lat: p.city_lat ?? null, city_lng: p.city_lng ?? null, max_detour_km: p.max_detour_km ?? 60, zone_km: p.zone_km ?? 50, lang: p.lang || getLang() }; };
const photoThumb = (p) => (api.mode === 'demo' ? p : api.photoUrl(p.replace(/\.jpg$/, '_t.jpg')));

function errorText(e) {
  const m = String(e?.message || '');
  if (/already taken|not open|not active|not pending|not found/i.test(m)) return t('err_closed');
  if (/invalid login|invalid_grant|invalid credentials/i.test(m)) return t('err_auth');
  if (/not authenticated|JWT|401/i.test(m)) return t('err_login');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('err_net');
  if (/from and to must differ/i.test(m)) return t('same_city');
  if (/must be positive|out of range/i.test(m)) return t('bad_numbers');
  if (/only carriers offer a price/i.test(m)) return t('err_only_carrier');
  if (/storage full/i.test(m)) return t('err_storage');
  return t('err_generic');
}
const fail = (e) => { console.warn(e); toast(errorText(e), 'error'); };
// a double tap is one action
let busy = false;
const once = (fn) => async (...a) => { if (busy) return; busy = true; try { return await fn(...a); } finally { busy = false; } };

// ---------------------------------------------------------------------------------------
// Words for a posting
// ---------------------------------------------------------------------------------------
const dayText = (d) => (!d ? '' : d === isoDate() ? t('today') : d === addDays(1) ? t('tomorrow') : fmtDate(d));
const whenText = (p) => (!p.date_to || p.date_to === p.date_from ? dayText(p.date_from) : `${fmtDate(p.date_from)} - ${fmtDate(p.date_to)}`);
const weightText = (p) => (p.weight_kg != null ? `${fmtInt(p.weight_kg)} ${t('kg')}` : '');
const dimsText = (p) => (p.length_m != null || p.width_m != null || p.height_m != null ? [p.length_m, p.width_m, p.height_m].map((x) => (x == null ? '?' : fmtNum(x, 2))).join(' × ') + ' ' + t('m') : '');
const km = (n) => `${fmtInt(n)} ${t('km')}`;
// a price is shown as it was named: 150,5 stays 150,5 (red team: it was shown as 151 and agreed as 150,5)
const amt = (n) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(Number(n));
const money = (n) => `${amt(n)} €`;
const distText = (d) => (d < 3 ? t('near') : km(d));
function typeTitle(p) {
  if (p.kind === 'truck') return vtName(p.vehicle_type_code) || t('have_truck');
  const c = ctype(p.cargo_type_id);
  return [c ? nameOf(c) : t('cargo'), p.cargo_fields?.model].filter(Boolean).join(' · ');
}
function waitText(until) {
  const m = Math.ceil((new Date(until).getTime() - Date.now()) / 60000);
  if (m <= 0) return t('wait_over');
  return t('waits', { t: m < 60 ? `${m} ${t('min')}` : `${Math.floor(m / 60)} ${t('h')}${m % 60 ? ` ${m % 60} ${t('min')}` : ''}` });
}
const tag = (text, kind = '', until = null) => h('span.tag', { class: kind ? `tag--${kind}` : '', dataset: until ? { until } : null }, text);
// green = act now, red = urgent and counting down, amber = waiting for prices, outlined = my own price
function statusTag(p, { bid = null, deal = null, own = false } = {}) {
  if (deal || p.status === 'deal') return tag(t('st_deal'), 'act');
  if (p.status === 'closed') return tag(t('st_closed'));
  if (own) return p.bid_count ? tag(t('st_prices', { n: p.bid_count }), 'act') : tag(t('st_wait_price'), 'wait');
  if (bid) return tag(t('st_my_price', { p: amt(bid.amount) }), 'mine');
  if (p.mode === 'urgent') return p.wait_until ? tag(waitText(p.wait_until), new Date(p.wait_until) > new Date() ? 'urgent' : '', p.wait_until) : tag(t('urgent'), 'urgent');
  return null;
}
setInterval(() => {
  for (const el of document.querySelectorAll('[data-until]')) {
    el.textContent = waitText(el.dataset.until);
    if (new Date(el.dataset.until) <= new Date()) { el.classList.remove('tag--urgent'); el.closest('.card')?.classList.remove('is-urgent'); }
  }
}, 20000);

const routeLine = (p) => h('div.route', null, h('span', null, p.from_name), icon('arrow'), h('span', null, p.to_name));
const urgentNow = (p) => p.kind === 'cargo' && p.mode === 'urgent' && p.status === 'open' && (!p.wait_until || new Date(p.wait_until) > new Date());
function card(p, { status, right, good = false, deal = false }) {
  return h('a.card', { href: `#/p/${p.id}`, class: [urgentNow(p) && !deal ? 'is-urgent' : '', deal ? 'is-deal' : ''].join(' ').trim() },
    h('div.card__top', null, h('span.card__type', null, typeTitle(p)), status),
    routeLine(p),
    h('div.card__bot', null, h('span', null, [whenText(p), weightText(p)].filter(Boolean).join(' · ')), right ? h('b.num', { class: good ? 'is-good' : '' }, right) : null));
}

// ---------------------------------------------------------------------------------------
// Sheets: a question, a town, a price
// ---------------------------------------------------------------------------------------
// a double tap opens one sheet of a kind, never two on top of each other (red team)
const openKinds = new Set();
function oneSheet(kind, opts) {
  openKinds.add(kind);
  const onClose = opts.onClose;
  return sheet({ ...opts, onClose: (r) => { openKinds.delete(kind); onClose?.(r); } });
}
function ask(title, text, okLabel, danger = false) {
  return new Promise((resolve) => {
    if (openKinds.has('ask')) { resolve(false); return; }
    let ok = false;
    const s = oneSheet('ask', {
      title,
      body: h('div.stack', null, text ? h('p', null, text) : null,
        h('button.btn.btn--main', { type: 'button', class: danger ? 'btn--danger' : '', onclick: () => { ok = true; s.close(); } }, okLabel),
        h('button.btn.btn--wide', { type: 'button', onclick: () => s.close() }, t('cancel'))),
      onClose: () => resolve(ok),
    });
  });
}
// "My location" snaps to the nearest town: exact coordinates are never stored
function locate(onCity) {
  if (!navigator.geolocation) { toast(t('err_generic'), 'error'); return; }
  navigator.geolocation.getCurrentPosition((pos) => onCity(nearestCity(pos.coords.latitude, pos.coords.longitude).city), () => toast(t('err_generic'), 'error'), { timeout: 8000, maximumAge: 60000 });
}
const DEFAULT_TOWNS = ['Rīga', 'Daugavpils', 'Rēzekne', 'Jelgava', 'Liepāja', 'Ventspils', 'Valmiera'];
function pickCity(title) {
  return new Promise((resolve) => {
    if (openKinds.has('city')) { resolve(null); return; }
    let chosen = null;
    const q = h('input.input', { type: 'text', placeholder: t('city_search'), autocomplete: 'off', enterkeyhint: 'search', 'aria-label': t('city_search') });
    const list = h('div.rows');
    const finish = (c) => { chosen = { name: c.name, lat: c.lat, lng: c.lng }; s.close(); };
    const show = (items) => { clear(list); if (!items.length) list.append(h('p.muted', null, t('no_city'))); for (const c of items) list.append(h('button.row', { type: 'button', onclick: () => finish(c) }, h('b', null, c.name), h('span.muted', null, c.country))); };
    const initial = () => show(DEFAULT_TOWNS.map((n) => searchCities(n, 1)[0]).filter(Boolean));
    q.addEventListener('input', () => { const v = q.value.trim(); if (v) show(searchCities(v, 8)); else initial(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const c = searchCities(q.value.trim(), 1)[0]; if (c) finish(c); } });
    const s = oneSheet('city', { title, body: h('div.stack', null, q, h('button.btn.btn--wide', { type: 'button', onclick: () => locate(finish) }, icon('target'), t('my_place')), list), onClose: () => resolve(chosen) });
    initial();
  });
}

function priceSheet(p, mine) {
  if (openKinds.has('price') || !requireAuth()) return;
  const today = isoDate();
  const first = p.mode === 'urgent' || !p.date_from || p.date_from <= today ? today : p.date_from;
  const days = [...new Set([today, addDays(1), first])].sort();
  let day = mine?.can_date && mine.can_date >= today ? mine.can_date : first;
  if (!days.includes(day)) days.push(day);
  const amount = h('input.input.input--big', { type: 'text', inputmode: 'decimal', enterkeyhint: 'send', autocomplete: 'off', value: mine ? amt(mine.amount).replace(/[\s\u00A0\u202F]/g, '') : '', 'aria-label': t('price_eur') });
  const note = h('input.input', { type: 'text', maxlength: 300, value: mine?.note || '', placeholder: t('comment'), 'aria-label': t('comment') });
  const dayRow = h('div.chips', { role: 'group', 'aria-label': t('can_when') });
  const paintDays = () => { clear(dayRow); for (const d of days) dayRow.append(h('button.chip', { type: 'button', class: d === day ? 'is-on' : '', 'aria-pressed': d === day ? 'true' : 'false', onclick: () => { day = d; paintDays(); } }, dayText(d))); };
  paintDays();
  const send = h('button.btn.btn--main', { type: 'submit' }, t('send'));
  const form = h('form.stack', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    const a = num(amount.value);
    if (!(a > 0) || badNumber({ amount: amount.value }, ['amount'])) { toast(t('bad_price'), 'error'); amount.focus(); return; }
    send.disabled = true;
    try { await api.placeBid(p.id, a, note.value.trim(), day); s.close(); toast(t('price_sent')); render(); } catch (err) { fail(err); send.disabled = false; }
  } },
  h('label.field', null, h('span.field__l', null, t('price_eur')), amount),
  h('div.field', null, h('span.field__l', null, t('can_when')), dayRow),
  note, send,
  mine ? h('button.btn.btn--quiet', { type: 'button', onclick: async () => { try { await api.withdrawBid(mine.id); s.close(); toast(t('price_removed')); render(); } catch (err) { fail(err); } } }, t('remove_price')) : null);
  const s = oneSheet('price', { title: t('price_title'), body: form });
}

function vehicleSheet(onSaved, onClosed = null) {
  if (openKinds.has('vehicle')) return;
  const sel = h('select.input', { 'aria-label': t('truck_type') });
  for (const g of state.ref.groups) {
    const types = state.ref.vehicleTypes.filter((v) => v.group_id === g.id);
    if (!types.length) continue;
    const og = h('optgroup', { label: nameOf(g) });
    for (const v of types) og.append(h('option', { value: v.code }, nameOf(v)));
    sel.append(og);
  }
  const ton = h('input.input', { type: 'text', inputmode: 'decimal', enterkeyhint: 'done', autocomplete: 'off' });
  const save = h('button.btn.btn--main', { type: 'submit' }, t('save'));
  const s = oneSheet('vehicle', { title: t('add_truck'), onClose: () => onClosed?.(), body: h('form.stack', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (save.disabled) return;
    if (badNumber({ tonnage_t: ton.value }, ['tonnage_t'])) { toast(t('bad_numbers'), 'error'); ton.focus(); return; }
    save.disabled = true;
    try {
      await api.addVehicle({ type_code: sel.value, plate: null, tonnage_t: num(ton.value), volume_m3: null, length_m: null, width_m: null, height_m: null, note: null, is_default: !(state.me?.vehicles || []).length });
      await loadMe(); s.close(); onSaved?.();
    } catch (err) { fail(err); save.disabled = false; }
  } }, h('label.field', null, h('span.field__l', null, t('truck_type')), sel), h('label.field', null, h('span.field__l', null, t('tonnage')), ton), save) });
}

// Where a carrier looks for jobs: his town and a radius (client's model of 29.09.2026), plus the trip when he drives empty.
function whereSheet(trips) {
  if (openKinds.has('where')) return;
  const draft = { city: here(), km: zoneKm() };
  const cityBtn = h('button.row', { type: 'button', onclick: async () => { const c = await pickCity(t('city')); if (c) { draft.city = c; paintCity(); } } });
  const paintCity = () => { clear(cityBtn); cityBtn.append(h('span.muted', null, t('city')), h('b', null, draft.city?.name || t('my_city')), icon('chev')); };
  paintCity();
  const radius = h('div.chips.chips--row', { role: 'group', 'aria-label': t('radius') });
  const paintRadius = () => { clear(radius); for (const z of ZONES) radius.append(h('button.chip', { type: 'button', class: z === draft.km ? 'is-on' : '', 'aria-pressed': z === draft.km ? 'true' : 'false', onclick: () => { draft.km = z; paintRadius(); } }, km(z))); };
  paintRadius();
  const tripBox = h('div.stack');
  for (const tr of trips) {
    tripBox.append(h('div.row.row--static', null, h('b', null, `${tr.from_name} → ${tr.to_name} · ${whenText(tr)}`),
      h('button.btn', { type: 'button', onclick: once(async () => {
        if (!(await ask(t('trip_remove_q'), `${tr.from_name} → ${tr.to_name} · ${whenText(tr)}`, t('remove'), true))) return;
        try { await api.closePosting(tr.id); s.close(); render(); } catch (e) { fail(e); }
      }) }, t('remove'))));
  }
  tripBox.append(h('button.btn.btn--wide', { type: 'button', onclick: () => { s.close(); go('#/trip'); } }, t('set_trip')));
  const save = h('button.btn.btn--main', { type: 'button', onclick: async () => {
    save.disabled = true;
    try {
      if (state.session && profile()) { const p = await api.saveProfile({ ...profileFields(), city_name: draft.city?.name ?? null, city_lat: draft.city?.lat ?? null, city_lng: draft.city?.lng ?? null, zone_km: draft.km }); if (p) state.me = { ...state.me, profile: p }; }
      else { store.set('pacelam.here', draft.city); store.set('pacelam.min.zone', draft.km); }
      state.showAll = false; s.close(); render();
    } catch (e) { fail(e); save.disabled = false; }
  } }, t('done'));
  const s = oneSheet('where', { title: t('where_title'), body: h('div.stack', null, cityBtn, h('div.field', null, h('span.field__l', null, t('radius')), radius), h('div.field', null, h('span.field__l', null, t('empty_trip')), tripBox), save) });
}

// ---------------------------------------------------------------------------------------
// Map: two towns and a line. Leaflet loads only when a map is on the screen.
// ---------------------------------------------------------------------------------------
let leafletReady = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: '../vendor/leaflet/leaflet.css' }));
      const s = document.createElement('script');
      s.src = '../vendor/leaflet/leaflet.js';
      s.onload = () => resolve(window.L);
      s.onerror = () => { leafletReady = null; reject(new Error('map')); };
      document.head.append(s);
    });
  }
  return leafletReady;
}
const BALTICS = [[55.6, 20.9], [58.1, 28.3]];
function routeMap(getPoints, { onTap = null } = {}) {
  const canvas = h('div.map__canvas', { 'aria-hidden': 'true' });
  const box = h('div.map', null, canvas,
    h('a.map__attr', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' }, '© OpenStreetMap'));
  let map = null; let layer = null; let L = null;
  const draw = () => {
    if (!map) return;
    layer.clearLayers();
    const { from, to } = getPoints();
    const pts = [];
    for (const [key, c] of [['from', from], ['to', to]]) {
      if (!c) continue;
      L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: `<span class="pin pin--${key}"><b>${key === 'from' ? 'A' : 'B'}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 34] }), keyboard: false, interactive: false }).addTo(layer);
      pts.push([c.lat, c.lng]);
    }
    if (pts.length === 2) { L.polyline(pts, { color: '#F5A623', weight: 4, opacity: 0.95, dashArray: '8 8' }).addTo(layer); map.fitBounds(pts, { padding: [48, 48], maxZoom: 10, animate: false }); }
    else if (pts.length === 1) map.setView(pts[0], 8, { animate: false });
    else map.fitBounds(BALTICS, { animate: false });
  };
  const start = (tries = 120) => {
    if (!box.isConnected) { if (tries > 0) requestAnimationFrame(() => start(tries - 1)); return; }
    loadLeaflet().then((lib) => {
      if (!box.isConnected) return;
      L = lib;
      const still = !onTap;   // the card's map is a picture: it never catches a scroll
      map = L.map(canvas, { attributionControl: false, zoomControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, zoomSnap: 1, minZoom: 5, maxZoom: 12, maxBounds: [[52.5, 18.5], [61, 31]], dragging: !still, touchZoom: !still, doubleClickZoom: !still, scrollWheelZoom: !still, boxZoom: false, keyboard: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, minZoom: 5 }).addTo(map);
      layer = L.layerGroup().addTo(map);
      if (onTap) map.on('click', (e) => onTap(nearestCity(e.latlng.lat, e.latlng.lng).city));
      draw();
    }).catch(() => { canvas.replaceWith(h('p.map__off', null, t('map_off'))); });
  };
  start();
  box.redraw = draw;
  box.cleanup = () => { try { map?.off(); map?.remove(); } catch { /* gone */ } map = null; };
  return box;
}

// ---------------------------------------------------------------------------------------
// 1. Start: two doors
// ---------------------------------------------------------------------------------------
async function demoUserFor(role) {
  const u = api.demoUsers.find((x) => x.key === (role === 'carrier' ? 'demo_carrier' : 'demo_customer'));
  if (u && myId() !== u.id) { await api.signInDemo(u.id); await loadMe(); }
}
const chooseRole = once(async (role, then = null) => {
  state.role = role; store.set('pacelam.min.role', role); state.showAll = false;
  try {
    if (api.mode === 'demo') await demoUserFor(role);
    else if (state.session && profile() && profile().role !== role) { const p = await api.saveProfile({ ...profileFields(), role }); if (p) state.me = { ...state.me, profile: p }; }
    if (then) { go(then); return; }
    // somebody with nothing posted yet starts with the request itself
    const mine = role === 'customer' && state.session ? ((await api.myPostings().catch(() => [])) || []).filter((p) => p.kind === 'cargo') : [];
    go(role === 'customer' && !mine.length ? '#/new' : '#/list');
  } catch (e) { fail(e); }
});
function screenStart() {
  const door = (role, ic, label) => h('button.door', { type: 'button', class: role === 'customer' ? 'door--cargo' : 'door--truck', onclick: () => chooseRole(role) }, icon(ic), h('span', null, label));
  return h('section.start', null, h('h1.sr-only', null, 'Paceļam'), door('customer', 'box', t('have_cargo')), door('carrier', 'truck', t('have_truck')), api.mode === 'demo' ? h('p.muted.center', null, t('demo')) : null);
}

// ---------------------------------------------------------------------------------------
// 2. Lists
// ---------------------------------------------------------------------------------------
async function screenList() {
  if (!state.role) { leave('#/start'); return h('div'); }
  return state.role === 'customer' ? listCustomer() : listCarrier();
}
async function listCustomer() {
  const all = state.session ? (((await api.myPostings()) || []).filter((p) => p.kind === 'cargo')) : [];
  const byNew = (a, b) => (a.created_at < b.created_at ? 1 : -1);
  // what is going on stays; what is over (closed, or agreed and already driven) keeps its last three
  const going = (p) => ['open', 'pending'].includes(p.status) || (p.status === 'deal' && p.date_to >= addDays(-2));
  const shown = [...all.filter(going).sort(byNew), ...all.filter((p) => !going(p)).sort(byNew).slice(0, 3)];
  const el = h('section.screen', null, h('h1', null, t('my_requests')));
  if (!shown.length) el.append(h('p.muted', null, t('no_requests')));
  const list = h('div.cards');
  for (const p of shown) list.append(card(p, { status: statusTag(p, { own: true }), right: p.status === 'open' && p.bid_count && p.best_bid != null ? t('from_price', { p: amt(p.best_bid) }) : null, deal: p.status === 'deal' }));
  el.append(list);
  el.foot = h('a.btn.btn--main', { href: '#/new' }, icon('plus'), t('new_request'));
  return el;
}
async function listCarrier() {
  const me = myId();
  const [all, bids, deals, mine] = await Promise.all([api.listPostings(), me ? api.myBids() : [], me ? api.myDeals() : [], me ? api.myPostings() : []]);
  const today = isoDate();
  const trips = (mine || []).filter((p) => p.kind === 'truck' && p.status === 'open' && p.date_to >= today);
  const bidBy = new Map((bids || []).filter((b) => b.status === 'active').map((b) => [b.posting_id, b]));
  const mineDeals = (deals || []).filter((d) => d.status === 'confirmed' && d.carrier_id === me && d.posting?.kind === 'cargo' && d.posting.date_to >= addDays(-2));
  const c = here();
  const zone = zoneKm();
  const rows = ((all || []).filter((p) => p.kind === 'cargo' && p.owner_id !== me && p.status === 'open')).map((p) => {
    const dist = c ? haversineKm(c.lat, c.lng, p.from_lat, p.from_lng) : null;
    const near = !!c && (dist <= zone + (p.from_radius_km || 0) || haversineKm(c.lat, c.lng, p.to_lat, p.to_lng) <= zone + (p.to_radius_km || 0));
    // a trip when driving empty: the cargo fits when its days overlap and the detour is within the carrier's limit (0008)
    const dets = trips.filter((tr) => tr.date_from <= p.date_to && p.date_from <= tr.date_to).map((tr) => detourKm({ from: { lat: tr.from_lat, lng: tr.from_lng }, to: { lat: tr.to_lat, lng: tr.to_lng } }, { lat: p.from_lat, lng: p.from_lng }, { lat: p.to_lat, lng: p.to_lng }));
    const det = dets.length ? Math.min(...dets) : null;
    const onWay = det != null && det <= maxDetour();
    const bid = bidBy.get(p.id) || null;
    const urgentNow = p.mode === 'urgent' && (!p.wait_until || new Date(p.wait_until) > new Date());
    return { p, dist, det, onWay, bid, urgentNow, keep: !c || near || onWay || !!bid, sort: onWay && (dist == null || det < dist) ? det : (dist ?? 0) };
  });
  const order = (a, b) => (!!b.bid - !!a.bid) || (b.urgentNow - a.urgentNow) || (c ? a.sort - b.sort : (a.p.created_at < b.p.created_at ? 1 : -1));
  const hidden = rows.filter((r) => !r.keep);
  const shown = (state.showAll ? rows : rows.filter((r) => r.keep)).sort(order);
  const el = h('section.screen', null,
    h('div.head', null, h('h1', null, t('jobs')),
      h('button.pill', { type: 'button', onclick: () => whereSheet(trips) }, icon('pin'), h('span', null, c ? `${c.name} · ${km(zone)}` : t('my_city')))));
  const list = h('div.cards');
  for (const d of mineDeals) list.append(card(d.posting, { status: statusTag(d.posting, { deal: d }), right: d.amount != null ? money(d.amount) : null, deal: true }));
  for (const r of shown) list.append(card(r.p, { status: statusTag(r.p, { bid: r.bid }), right: r.onWay && (r.dist == null || r.det < r.dist) ? (r.det <= 5 ? t('on_way') : `+${km(r.det)}`) : (r.dist != null ? distText(r.dist) : null), good: r.onWay && (r.dist == null || r.det < r.dist) ? r.det <= 5 : r.dist != null && r.dist < 3 }));
  if (!mineDeals.length && !shown.length) el.append(h('p.muted', null, hidden.length ? t('no_jobs_near') : t('no_jobs')));
  el.append(list);
  if (hidden.length && !state.showAll) el.append(h('button.btn.btn--wide', { type: 'button', onclick: () => { state.showAll = true; render(); } }, t('show_all', { n: hidden.length })));
  else if (state.showAll && c) el.append(h('button.btn.btn--wide', { type: 'button', onclick: () => { state.showAll = false; render(); } }, t('only_near')));
  return el;
}

// ---------------------------------------------------------------------------------------
// 3. A request: map on top, a few facts, each round button next to its fact
// ---------------------------------------------------------------------------------------
async function screenPosting(id) {
  const data = await api.getPosting(id);
  const back = state.role ? '#/list' : '#/start';
  if (!data?.posting) { const el = h('section.screen', null, h('p.muted', null, t('not_found'))); el.back = back; return el; }
  const { posting: p, bids, deal } = data;
  const me = myId();
  const own = !!me && p.owner_id === me;
  const active = (bids || []).filter((b) => b.status === 'active');
  if (own) { p.bid_count = active.length; p.best_bid = active.length ? Math.min(...active.map((b) => b.amount)) : null; }
  const myBid = !own && me ? active.find((b) => b.bidder_id === me) || null : null;
  const done = deal && deal.status === 'confirmed' ? deal : null;
  const from = { lat: p.from_lat, lng: p.from_lng };
  const to = { lat: p.to_lat, lng: p.to_lng };
  const trip = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const c = here();
  const el = h('section.screen');
  el.back = back;
  const map = routeMap(() => ({ from, to }));
  el.cleanup = map.cleanup;
  el.append(map);

  const facts = h('div.facts');
  facts.append(h('div.fact.fact--title', null, h('h1', null, typeTitle(p)), statusTag(p, { deal: done, own })));   // my own price has its own line below, not a second tag
  const dist = !own && c ? haversineKm(c.lat, c.lng, from.lat, from.lng) : null;
  facts.append(h('div.fact', null,
    h('div', null, routeLine(p),
      h('div.muted', null, dist != null ? `${dist < 3 ? t('near') : t('from_you', { km: fmtInt(dist) })} · ${t('with_cargo', { km: fmtInt(trip) })}` : km(trip))),
    own ? null : h('a.round', { href: `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&waypoints=${from.lat},${from.lng}&travelmode=driving`, target: '_blank', rel: 'noopener', 'aria-label': t('route_btn') }, icon('nav'))));
  facts.append(h('div.fact', null, h('div', null, h('div.muted', null, t('when')), h('div.strong', null, whenText(p)))));
  if (myBid) facts.append(h('div.fact', null, h('div', null, h('div.muted', null, t('my_price')), h('div.num', null, `${money(myBid.amount)}${myBid.can_date ? ' · ' + dayText(myBid.can_date) : ''}`), h('div.muted', null, t('phone_later')))));
  if (done) {
    const otherId = done.customer_id === me ? done.carrier_id : done.customer_id;
    const contact = await api.getContacts(otherId).catch(() => null);
    const who = own ? (bids || []).find((b) => b.id === done.bid_id)?.bidder?.display_name : p.owner?.display_name;
    const digits = String(contact?.phone || '').replace(/[^\d+]/g, '');
    el.append(facts, h('div.deal', null,
      h('div', null, h('div.muted', null, [who, done.amount != null ? money(done.amount) : null].filter(Boolean).join(' · ')), h('div.num', null, contact?.phone || '')),
      digits ? h('a.round.round--fill', { href: `tel:${digits}`, 'aria-label': t('call') }, icon('phone')) : null));
  } else el.append(facts);

  const more = h('div.more');
  if (p.photos?.length) more.append(h('div.photos', null, p.photos.map((ph, i) => h('button', { type: 'button', 'aria-label': `${t('photo')} ${i + 1}`, onclick: () => { if (!openKinds.has('photo')) oneSheet('photo', { title: t('photo'), body: h('img.photo-full', { src: api.photoUrl(ph), alt: '' }) }); } }, h('img', { src: photoThumb(ph), alt: '', loading: 'lazy' })))));
  const size = [weightText(p), dimsText(p)].filter(Boolean).join(' · ');
  if (size) more.append(h('p.strong', null, size));
  for (const f of (ctype(p.cargo_type_id)?.fields || [])) {
    const v = p.cargo_fields?.[f.key];
    if (v == null || v === '' || f.key === 'model') continue;
    const text = f.type === 'bool' ? (v ? t('yes') : t('no')) : f.type === 'choice' ? (labelOf((f.options || []).find((o) => o.value === v)) || String(v)) : String(v);
    more.append(h('p', null, `${labelOf(f)}: ${text}`));
  }
  if (p.note) more.append(h('p', null, p.note));
  if (p.is_operator_posting) more.append(h('p', null, tag(t('operator'))));
  if (more.childNodes.length) el.append(more);

  if (own && p.kind === 'truck' && p.status === 'open') {
    el.append(h('button.btn.btn--quiet.btn--danger-text', { type: 'button', onclick: once(async () => {
      if (!(await ask(t('trip_remove_q'), `${p.from_name} → ${p.to_name} · ${whenText(p)}`, t('remove'), true))) return;
      try { await api.closePosting(p.id); go('#/list'); } catch (e) { fail(e); }
    }) }, t('remove')));
  }
  if (own && p.kind === 'cargo' && p.status === 'open') {
    const box = h('div.block', null, h('h2', null, active.length ? `${t('prices')} · ${active.length}` : t('prices')));
    if (!active.length) box.append(h('p.muted', null, t('wait_prices')));
    // who is behind a price: his vehicle and payload, nothing else; cheapest first
    const about = new Map(((active.length ? await api.carrierFacts?.(active.map((b) => b.bidder_id)).catch(() => []) : []) || []).map((f) => [f.user_id, f]));
    const sorted = [...active].sort((x, y) => x.amount - y.amount);
    for (const b of sorted) {
      const f = about.get(b.bidder_id);
      const truck = f?.vehicle_type_code ? [vtName(f.vehicle_type_code), f.tonnage_t != null ? `${fmtNum(f.tonnage_t, 1)} ${t('t_unit')}` : null].filter(Boolean).join(' · ') : '';
      const name = b.bidder?.display_name || '';
      box.append(h('div.offer', { class: b === sorted[0] && sorted.length > 1 ? 'is-best' : '' },
        h('div.offer__top', null, h('b', null, name), h('b.num', null, money(b.amount))),
        h('span.muted', null, [b.can_date ? dayText(b.can_date) : null, truck, b.note].filter(Boolean).join(' · ')),
        h('button.btn.btn--fill.btn--wide', { type: 'button', onclick: once(async () => {
          if (!(await ask(t('pick_q', { name, p: amt(b.amount) }), t('pick_hint'), t('pick')))) return;
          try { await api.acceptBid(b.id); toast(t('st_deal')); render(); } catch (e) { fail(e); }
        }) }, icon('check'), t('pick'))));
    }
    box.append(h('button.btn.btn--quiet.btn--danger-text', { type: 'button', onclick: once(async () => {
      if (!(await ask(t('close_q'), t('close_hint'), t('close_request'), true))) return;
      try { await api.closePosting(p.id); toast(t('closed_ok')); go('#/list'); } catch (e) { fail(e); }
    }) }, t('close_request')));
    el.append(box);
  }
  // only a carrier names a price (decision of 23.09.2026; the database refuses anyone else, 0011)
  const carrierHere = (profile()?.role || state.role) === 'carrier';
  if (!own && !done && p.kind === 'cargo' && p.status === 'open' && carrierHere) {
    el.foot = h('button.btn.btn--main', { type: 'button', onclick: () => priceSheet(p, myBid) }, myBid ? t('change_price') : t('offer_price'));
  }
  return el;
}

// ---------------------------------------------------------------------------------------
// 4. A new request in three steps (what + photo → from and to → when); a carrier's empty trip in two
// ---------------------------------------------------------------------------------------
const wizPhotos = [];   // photos stay in memory
const wizKey = (kind) => `pacelam.min.wiz.${kind}.${myId() || 'guest'}`;
const STEPS = { cargo: ['what', 'where', 'when'], truck: ['where', 'when'] };
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= isoDate() && d <= addDays(366);
function loadDraft(kind) {
  const firstDay = kind === 'truck' ? addDays(1) : isoDate();
  const last = store.get(`pacelam.lastRoute.${myId() || 'guest'}`);
  const blank = { cargo_type_id: null, fields: {}, weight_kg: '', length_m: '', width_m: '', height_m: '', note: '',
    from: place(last?.from) || here(), to: place(last?.to), day: firstDay, urgent: false, wait: 60 };
  const saved = store.get(wizKey(kind));
  const d = saved && typeof saved === 'object' ? saved.draft : null;
  if (!d || typeof d !== 'object' || !Number.isFinite(saved.at) || Date.now() - saved.at > 86400000) return blank;
  // rebuilt field by field: a broken or foreign record cannot bring the request down (red team)
  const text = (v, max = 40) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '');
  const fields = {};
  if (d.fields && typeof d.fields === 'object' && !Array.isArray(d.fields)) for (const [k, v] of Object.entries(d.fields)) if (['string', 'number', 'boolean'].includes(typeof v)) fields[k] = typeof v === 'string' ? v.slice(0, 80) : v;
  const out = { cargo_type_id: ctype(d.cargo_type_id) ? d.cargo_type_id : null, fields: ctype(d.cargo_type_id) ? fields : {},
    weight_kg: text(d.weight_kg), length_m: text(d.length_m), width_m: text(d.width_m), height_m: text(d.height_m), note: text(d.note, 600),
    from: place(d.from) || blank.from, to: place(d.to), day: isDay(d.day) ? d.day : firstDay, urgent: d.urgent === true, wait: WAITS.includes(d.wait) ? d.wait : 60 };
  out.resume = Date.now() - saved.at < 30 * 60000 && Number.isInteger(saved.step) ? saved.step : 1;   // left a moment ago: back on the same step
  out.lostPhotos = kind === 'cargo' && saved.photos > 0 && !wizPhotos.length;   // photos live in memory only: a reload drops them
  return out;
}
function wizard(kind, param) {
  const steps = STEPS[kind];
  const base = kind === 'cargo' ? '#/new' : '#/trip';
  const draft = loadDraft(kind);
  const n = Math.min(Math.max(1, parseInt(param, 10) || draft.resume || 1), steps.length);
  delete draft.resume;
  const lostPhotos = draft.lostPhotos; delete draft.lostPhotos;
  const name = steps[n - 1];
  const keep = () => store.set(wizKey(kind), { at: Date.now(), step: n, photos: kind === 'cargo' ? wizPhotos.length : 0, draft });
  // the photos did not survive a reload: say so once instead of sending the request without them (red team)
  if (lostPhotos) { keep(); setTimeout(() => toast(t('photos_again')), 400); }
  const el = h('section.screen');
  // the whole wizard is one entry in the phone's history: steps replace each other, so a sent request leaves none behind
  el.back = n > 1 ? () => leave(`${base}/${n - 1}`) : (state.role ? '#/list' : '#/start');
  el.addEventListener('input', keep);
  // a number of the category (pallets and the like) keeps to its own limits and is whole (red team: -3 pallets went through)
  const badField = () => (ctype(draft.cargo_type_id)?.fields || []).some((f) => { if (f.type !== 'number') return false; const raw = draft.fields[f.key]; if (raw == null || String(raw).trim() === '') return false; const v = num(raw); return v == null || !Number.isInteger(v) || v < (f.min ?? 1) || v > (f.max ?? 100000); });
  const validWhat = () => (!draft.cargo_type_id ? t('pick_what') : badNumber(draft, ['weight_kg', 'length_m', 'width_m', 'height_m']) || badField() ? t('bad_numbers') : null);
  const validWhere = () => (!draft.from || !draft.to ? t('need_route') : draft.from.name === draft.to.name ? t('same_city') : null);
  // a later step opened by its address without the earlier ones: back to the first gap
  const gap = steps.findIndex((s, i) => i < n - 1 && ((s === 'what' && validWhat()) || (s === 'where' && validWhere())));
  if (gap >= 0) { leave(`${base}/${gap + 1}`); return h('div'); }

  const title = { what: t('what'), where: t('where'), when: kind === 'truck' ? t('when_go') : t('when_q') }[name];
  el.append(h('div.head', null, h('h1', null, title), h('div.dots', { role: 'img', 'aria-label': t('step', { n, total: steps.length }) }, steps.map((s, i) => h('i', { class: i === n - 1 ? 'is-on' : (i < n - 1 ? 'is-done' : '') })))));
  const body = h('div.stack');
  el.append(body);
  let valid = () => null;

  if (name === 'what') {
    valid = validWhat;
    const dyn = h('div.stack');
    const chipRow = (options, value, onPick, label) => {
      const row = h('div.chips', { role: 'group', 'aria-label': label });
      const paint = (cur) => { clear(row); for (const o of options) row.append(h('button.chip', { type: 'button', class: o.value === cur ? 'is-on' : '', 'aria-pressed': o.value === cur ? 'true' : 'false', onclick: () => { onPick(o.value); paint(o.value); keep(); } }, o.label)); };
      paint(value);
      return row;
    };
    const paintDyn = () => {
      clear(dyn);
      for (const f of (ctype(draft.cargo_type_id)?.fields || [])) {
        if (f.type === 'bool') dyn.append(h('div.field.field--line', null, h('span.field__l', null, labelOf(f)), chipRow([{ value: true, label: t('yes') }, { value: false, label: t('no') }], draft.fields[f.key], (v) => { draft.fields[f.key] = v; }, labelOf(f))));
        else if (f.type === 'choice') dyn.append(h('div.field', null, h('span.field__l', null, labelOf(f)), chipRow((f.options || []).map((o) => ({ value: o.value, label: labelOf(o) })), draft.fields[f.key], (v) => { draft.fields[f.key] = v; }, labelOf(f))));
        else dyn.append(h('label.field', null, h('span.field__l', null, labelOf(f)), h('input.input', { type: 'text', inputmode: f.type === 'number' ? 'numeric' : 'text', maxlength: f.maxlength || 80, value: draft.fields[f.key] ?? '', oninput: (e) => { draft.fields[f.key] = e.target.value; } })));
      }
    };
    paintDyn();
    const numIn = (key, ph, label) => h('input.input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: draft[key] ?? '', placeholder: ph || '', 'aria-label': label, oninput: (e) => { draft[key] = e.target.value; } });
    const thumbs = h('div.photos');
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, tabindex: -1 });
    const paintPhotos = () => {
      clear(thumbs);
      wizPhotos.forEach((ph, i) => thumbs.append(h('button', { type: 'button', 'aria-label': t('photo_remove'), onclick: () => { wizPhotos.splice(i, 1); paintPhotos(); keep(); } }, h('img', { src: ph.thumbUrl, alt: '' }), icon('x'))));
      if (wizPhotos.length < 4) thumbs.append(h('button.photo-add', { type: 'button', onclick: () => file.click() }, icon('photo'), h('span', null, t('photo'))));
    };
    file.addEventListener('change', async () => {
      for (const f of [...file.files].slice(0, 4 - wizPhotos.length)) { try { const c = await compressPhoto(f); wizPhotos.push({ full: c.full, thumb: c.thumb, thumbUrl: URL.createObjectURL(c.thumb) }); } catch (e) { fail(e); } }
      file.value = ''; paintPhotos(); keep();
    });
    paintPhotos();
    // first only the question itself: seven answers. The rest appears once it is clear what is carried,
    // and the answers fold into the chosen one (a tap on it opens them again).
    const pickWhat = h('div');
    const rest = h('div.stack', null, dyn, thumbs, file,
      h('label.field', null, h('span.field__l', null, t('weight')), numIn('weight_kg', '', t('weight'))),
      h('div.field', null, h('span.field__l', null, t('dims')), h('div.grid3', null, numIn('length_m', t('dim_l'), t('dim_l')), numIn('width_m', t('dim_w'), t('dim_w')), numIn('height_m', t('dim_h'), t('dim_h')))),
      h('textarea.input.input--area', { rows: 2, maxlength: 600, placeholder: t('note_ph'), 'aria-label': t('note_ph'), oninput: (e) => { draft.note = e.target.value; } }, draft.note || ''));
    let choosing = !draft.cargo_type_id;
    const paintWhat = () => {
      clear(pickWhat);
      if (choosing) pickWhat.append(chipRow(state.ref.cargoTypes.map((c) => ({ value: c.id, label: nameOf(c) })), draft.cargo_type_id, (v) => { if (v !== draft.cargo_type_id) { draft.cargo_type_id = v; draft.fields = {}; paintDyn(); } choosing = false; paintWhat(); }, t('what')));
      else pickWhat.append(h('button.row', { type: 'button', 'aria-label': `${t('what')} ${nameOf(ctype(draft.cargo_type_id))}`, onclick: () => { choosing = true; paintWhat(); } }, h('b', null, nameOf(ctype(draft.cargo_type_id))), icon('chev')));
      rest.hidden = !draft.cargo_type_id;
    };
    paintWhat();
    body.append(pickWhat, rest);
  }

  if (name === 'where') {
    valid = validWhere;
    let active = !draft.from ? 'from' : 'to';
    const map = routeMap(() => ({ from: draft.from, to: draft.to }), { onTap: (c) => set(active, c) });
    el.cleanup = map.cleanup;
    const q = h('input.input', { type: 'text', autocomplete: 'off', enterkeyhint: 'search' });
    const list = h('div.rows', { hidden: true });
    const pt = (key) => h('button.pt', { type: 'button', onclick: () => { active = key; paint(); q.focus({ preventScroll: true }); } }, h('span.pin', { class: `pin--${key}`, 'aria-hidden': 'true' }, h('b', null, key === 'from' ? 'A' : 'B')), h('span.pt__v'));
    const fromBtn = pt('from');
    const toBtn = pt('to');
    const paint = () => {
      for (const [key, b] of [['from', fromBtn], ['to', toBtn]]) {
        const v = b.querySelector('.pt__v');
        v.textContent = draft[key]?.name || t(key);
        v.classList.toggle('muted', !draft[key]);
        b.classList.toggle('is-on', active === key);
        b.setAttribute('aria-pressed', active === key ? 'true' : 'false');
        b.setAttribute('aria-label', `${t(key)}${draft[key] ? ': ' + draft[key].name : ''}`);
      }
      q.placeholder = `${t(active)}: ${t('city_search').toLowerCase()}`;
      q.setAttribute('aria-label', q.placeholder);
    };
    const set = (key, c) => {
      draft[key] = { name: c.name, lat: c.lat, lng: c.lng };
      active = key === 'from' && !draft.to ? 'to' : key === 'from' ? 'from' : 'to';
      q.value = ''; list.hidden = true;
      paint(); map.redraw(); keep();
    };
    const show = (items) => { clear(list); list.hidden = !items.length; for (const c of items) list.append(h('button.row', { type: 'button', onclick: () => set(active, c) }, h('b', null, c.name), h('span.muted', null, c.country))); };
    q.addEventListener('input', () => { const v = q.value.trim(); show(v ? searchCities(v, 5) : []); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const c = searchCities(q.value.trim(), 1)[0]; if (c) set(active, c); } });
    paint();
    body.append(
      h('div.fact.fact--plain', null, fromBtn, h('button.round', { type: 'button', 'aria-label': t('my_place'), onclick: () => locate((c) => set('from', c)) }, icon('target'))),
      toBtn, h('div.search', null, q, list), map);
  }

  if (name === 'when') {
    valid = () => (draft.urgent || isDay(draft.day) ? null : t('bad_day'));
    const days = [isoDate(), addDays(1), addDays(2), addDays(3)];
    const box = h('div.stack.stack--tight');
    const wd = (d) => new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T00:00:00'));
    const paint = () => {
      clear(box);
      const opt = (on, label, sub, pick) => h('button.opt', { type: 'button', class: on ? 'is-on' : '', 'aria-pressed': on ? 'true' : 'false', onclick: () => { pick(); keep(); paint(); } }, h('b', null, label), sub ? h('span.muted', null, sub) : null, on ? icon('check') : null);
      if (kind === 'cargo') {
        box.append(opt(draft.urgent, t('urgent'), '', () => { draft.urgent = true; draft.day = isoDate(); }));
        if (draft.urgent) {
          const waits = h('div.chips.chips--row', { role: 'group', 'aria-label': t('can_wait') });
          for (const m of WAITS) waits.append(h('button.chip', { type: 'button', class: m === draft.wait ? 'is-on' : '', 'aria-pressed': m === draft.wait ? 'true' : 'false', onclick: () => { draft.wait = m; keep(); paint(); } }, m < 60 ? `${m} ${t('min')}` : `${m / 60} ${t('h')}`));
          box.append(h('div.field', null, h('span.field__l', null, t('can_wait')), waits));
        }
      }
      days.forEach((d, i) => box.append(opt(!draft.urgent && draft.day === d, i === 0 ? t('today') : i === 1 ? t('tomorrow') : wd(d), i < 2 ? wd(d) : '', () => { draft.urgent = false; draft.day = d; })));
      // any other day: the phone's own calendar
      const other = !draft.urgent && !days.includes(draft.day);
      const date = h('input.opt__date', { type: 'date', min: isoDate(), value: other ? draft.day : '', 'aria-label': t('other_day'), max: addDays(366), onchange: () => { if (!date.value) return; if (!isDay(date.value)) { toast(t('bad_day'), 'error'); date.value = ''; return; } draft.urgent = false; draft.day = date.value; keep(); paint(); } });
      box.append(h('label.opt', { class: other ? 'is-on' : '', onclick: (e) => { if (e.target !== date) { try { date.showPicker(); } catch { /* the field itself opens it */ } } } }, h('b', null, t('other_day')), date, other ? icon('check') : null));
    };
    paint();
    body.append(box);
    if (kind === 'cargo') body.append(h('p.muted', null, t('prices_come')));
  }

  const last = n === steps.length;
  const next = h('button.btn.btn--main', { type: 'button', onclick: once(async () => {
    const err = valid();
    if (err) { toast(err, 'error'); return; }
    keep();
    if (!last) { store.set(wizKey(kind), { at: Date.now(), step: n + 1, draft }); leave(`${base}/${n + 1}`); return; }
    if (!requireAuth(`${base}/${n}`)) return;
    if (kind === 'truck' && !(state.me?.vehicles || []).length) { toast(t('need_truck')); vehicleSheet(() => next.click()); return; }
    next.disabled = true;
    try {
      const id = uuid();
      const place = { from_name: draft.from.name, from_lat: draft.from.lat, from_lng: draft.from.lng, from_radius_km: 0, to_name: draft.to.name, to_lat: draft.to.lat, to_lng: draft.to.lng, to_radius_km: 0 };
      if (kind === 'cargo') {
        const photos = [];
        for (let i = 0; i < wizPhotos.length; i++) {
          if (api.mode === 'demo') { photos.push(await api.uploadPhoto(wizPhotos[i].thumb)); continue; }
          const path = `${myId()}/${id}/${i + 1}`;
          await api.uploadPhoto(wizPhotos[i].full, `${path}.jpg`); await api.uploadPhoto(wizPhotos[i].thumb, `${path}_t.jpg`); photos.push(`${path}.jpg`);
        }
        const day = draft.urgent ? isoDate() : draft.day;
        const w = num(draft.weight_kg);
        await api.createPosting({ id, kind: 'cargo', mode: draft.urgent ? 'urgent' : 'planned', ...place, date_from: day, date_to: day, vehicle_type_code: null, cargo_type_id: draft.cargo_type_id,
          cargo_fields: Object.fromEntries((ctype(draft.cargo_type_id)?.fields || []).map((f) => [f.key, f.type === 'number' ? num(draft.fields[f.key]) : (typeof draft.fields[f.key] === 'string' ? draft.fields[f.key].trim() : draft.fields[f.key])]).filter(([, v]) => v !== undefined && v !== null && v !== '')), weight_kg: w != null ? Math.round(w) : null, volume_m3: null, length_m: num(draft.length_m), width_m: num(draft.width_m), height_m: num(draft.height_m),
          photos, price: null, note: String(draft.note || '').trim() || null, is_operator_posting: false, ...(draft.urgent ? { wait_until: new Date(Date.now() + draft.wait * 60000).toISOString() } : {}) });
      } else {
        const v = state.me.vehicles.find((x) => x.is_default) || state.me.vehicles[0];
        await api.createPosting({ id, kind: 'truck', mode: 'planned', ...place, date_from: draft.day, date_to: draft.day, vehicle_type_code: v.type_code, vehicle_id: v.id, weight_kg: v.tonnage_t != null ? Math.round(v.tonnage_t * 1000) : null, volume_m3: v.volume_m3 ?? null, length_m: v.length_m ?? null, width_m: v.width_m ?? null, height_m: v.height_m ?? null, price: null, note: null });
      }
      store.set(`pacelam.lastRoute.${myId() || 'guest'}`, { from: draft.from, to: draft.to });
      store.set(wizKey(kind), null); wizPhotos.length = 0;
      toast(kind === 'cargo' ? t('sent_ok') : t('trip_ok'));
      leave(kind === 'cargo' ? `#/p/${id}` : '#/list');
    } catch (e) { fail(e); next.disabled = false; }
  }) }, last ? (kind === 'cargo' ? t('send') : t('done')) : t('next'));
  el.foot = next;
  return el;
}
// leaving the wizard: its steps do not stay behind in the phone's "back"
// A sheet that is just closing still owns a step of the phone's history; replacing the address before that step is
// taken sends the person back into the wizard (red team: a trip added right after its vehicle). So wait for the step.
function leave(hash) {
  trail[trail.length - 1] = hash;
  if (!(history.state && history.state.pacelamSheet)) { location.replace(hash); return; }
  let done = false;
  const goNow = () => { if (done) return; done = true; window.removeEventListener('popstate', goNow); location.replace(hash); };
  window.addEventListener('popstate', goNow);
  setTimeout(goNow, 700);
}

// ---------------------------------------------------------------------------------------
// 5. Profile
// ---------------------------------------------------------------------------------------
async function screenMe() {
  const el = h('section.screen', null, h('h1', null, t('profile')));
  el.back = state.role ? '#/list' : '#/start';
  if (state.session && profile()) {
    const name = h('input.input', { type: 'text', maxlength: 80, autocomplete: 'name', value: profile().display_name || '' });
    const phone = h('input.input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', value: state.me?.contacts?.phone || '' });
    const save = h('button.btn.btn--wide', { type: 'submit' }, t('save'));
    el.append(h('form.stack', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (!name.value.trim() || !phone.value.trim()) { toast(t('need_name_phone'), 'error'); return; }
      save.disabled = true;
      try { await api.saveProfile({ ...profileFields(), display_name: name.value.trim() }); await api.saveContacts({ phone: phone.value.trim(), email: state.me?.contacts?.email ?? state.session.user?.email ?? null, company: state.me?.contacts?.company ?? null }); await loadMe(); toast(t('saved')); } catch (err) { fail(err); }
      save.disabled = false;
    } }, h('label.field', null, h('span.field__l', null, t('name')), name), h('label.field', null, h('span.field__l', null, t('phone')), phone), save));
    if (state.role === 'carrier') {
      const box = h('div.stack.stack--tight', null, h('h2', null, t('my_trucks')));
      for (const v of (state.me?.vehicles || [])) {
        box.append(h('div.row.row--static', null, h('b', null, [vtName(v.type_code), v.tonnage_t != null ? `${fmtNum(v.tonnage_t, 1)} ${t('t_unit')}` : null].filter(Boolean).join(' · ')),
          h('button.btn', { type: 'button', onclick: once(async () => {
            if (!(await ask(t('truck_remove_q'), [vtName(v.type_code), v.tonnage_t != null ? `${fmtNum(v.tonnage_t, 1)} ${t('t_unit')}` : null].filter(Boolean).join(' · '), t('remove'), true))) return;
            try { await api.deleteVehicle(v.id); await loadMe(); render(); } catch (e) { fail(e); }
          }) }, t('remove'))));
      }
      box.append(h('button.btn.btn--wide', { type: 'button', onclick: () => vehicleSheet(() => render()) }, icon('plus'), t('add_truck')));
      el.append(box);
    }
  }
  el.append(h('div.stack.stack--tight.sep', null,
    h('a.btn.btn--wide', { href: '#/start' }, t('switch_role')),
    state.session && api.mode !== 'demo' ? h('button.btn.btn--wide', { type: 'button', onclick: async () => { await api.signOut(); state.role = null; store.set('pacelam.min.role', null); await loadMe(); leave('#/start'); } }, t('sign_out')) : null,
    h('button.btn.btn--wide', { type: 'button', onclick: () => { applyTheme(store.get('pacelam.theme', 'dark') === 'light' ? 'dark' : 'light'); render(); } }, store.get('pacelam.theme', 'dark') === 'light' ? t('theme_dark') : t('theme_light')),
    api.mode === 'demo' ? h('button.btn.btn--wide', { type: 'button', onclick: once(async () => { if (!(await ask(t('demo_reset_q'), t('demo_reset_hint'), t('demo_reset'), true))) return; api.resetDemo(); if (state.role) await demoUserFor(state.role); await loadMe(); leave('#/list'); }) }, t('demo_reset')) : null));
  return el;
}

// ---------------------------------------------------------------------------------------
// Sign-in and "about you": asked once, right before the first request or price (real database only)
// ---------------------------------------------------------------------------------------
function requireAuth(after) {
  if (state.session && profile()) return true;
  state.after = after || location.hash || '#/list';
  go(state.session ? '#/hello' : '#/auth');
  return false;
}
const afterAuth = () => { const to = state.after || '#/list'; state.after = null; leave(to); };
async function screenAuth() {
  if (state.session) { leave(profile() ? (state.after || '#/list') : '#/hello'); return h('div'); }
  if (api.mode === 'demo') { leave('#/start'); return h('div'); }
  let mode = 'up';
  const el = h('section.screen', null, h('h1', null, t('auth_title')));
  el.back = state.role ? '#/list' : '#/start';
  const email = h('input.input', { type: 'email', inputmode: 'email', autocomplete: 'email' });
  const pass = h('input.input', { type: 'password', autocomplete: 'new-password', minlength: 8 });
  const submit = h('button.btn.btn--main', { type: 'submit' });
  const toggle = h('button.btn.btn--wide', { type: 'button', onclick: () => { mode = mode === 'in' ? 'up' : 'in'; paint(); } });
  const forgot = h('button.btn.btn--quiet', { type: 'button', onclick: async () => { if (!email.value) { email.focus(); return; } try { await api.resetPassword(email.value.trim()); toast(t('reset_sent')); } catch (e) { fail(e); } } }, t('forgot'));
  const paint = () => { submit.textContent = mode === 'in' ? t('sign_in') : t('sign_up'); toggle.textContent = mode === 'in' ? t('no_account') : t('have_account'); pass.autocomplete = mode === 'in' ? 'current-password' : 'new-password'; forgot.hidden = mode !== 'in'; };
  paint();
  el.append(h('form.stack', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!email.value || !pass.value) { (email.value ? pass : email).focus(); return; }
    submit.disabled = true;
    try {
      if (mode === 'in') await api.signIn(email.value.trim(), pass.value);
      else { const r = await api.signUp(email.value.trim(), pass.value, getLang()); if (r.needsConfirmation) { toast(t('check_email')); submit.disabled = false; return; } }
      await loadMe();
      if (profile()) afterAuth(); else leave('#/hello');
    } catch (err) { fail(err); submit.disabled = false; }
  } }, h('label.field', null, h('span.field__l', null, t('email')), email), h('label.field', null, h('span.field__l', null, t('password')), pass), submit, toggle, forgot));
  return el;
}
async function screenHello() {
  if (!state.session) { leave('#/auth'); return h('div'); }
  if (profile()) { afterAuth(); return h('div'); }
  const carrier = state.role === 'carrier';
  const draft = { city: store.get('pacelam.here') };
  const el = h('section.screen', null, h('h1', null, t('hello_title')), h('p.muted', null, t('hello_hint')));
  const name = h('input.input', { type: 'text', maxlength: 80, autocomplete: 'name' });
  const phone = h('input.input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '+371' });
  const cityBtn = h('button.row', { type: 'button', onclick: async () => { const c = await pickCity(t('city')); if (c) { draft.city = c; paintCity(); } } });
  const paintCity = () => { clear(cityBtn); cityBtn.append(h('span.muted', null, t('city')), h('b', null, draft.city?.name || t('my_city')), icon('chev')); };
  paintCity();
  const submit = h('button.btn.btn--main', { type: 'submit' }, t('done'));
  el.append(h('form.stack', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!name.value.trim() || !phone.value.trim()) { toast(t('need_name_phone'), 'error'); (name.value.trim() ? phone : name).focus(); return; }
    submit.disabled = true;
    try {
      await api.saveProfile({ role: state.role || 'customer', display_name: name.value.trim(), city_name: draft.city?.name || null, city_lat: draft.city?.lat ?? null, city_lng: draft.city?.lng ?? null, zone_km: store.get('pacelam.min.zone', 50), lang: getLang() });
      await api.saveContacts({ phone: phone.value.trim(), email: state.session.user?.email || null, company: null });
      await loadMe();
      if (carrier && !(state.me?.vehicles || []).length) vehicleSheet(null, afterAuth); else afterAuth();
    } catch (err) { fail(err); submit.disabled = false; }
  } }, h('label.field', null, h('span.field__l', null, t('name')), name), h('label.field', null, h('span.field__l', null, t('phone')), phone), cityBtn, submit));
  return el;
}

// ---------------------------------------------------------------------------------------
// Shell: one bar on top (back or profile, language), the screen, one main button at the bottom
// ---------------------------------------------------------------------------------------
function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = hash.split('/');
  return { name: name || (state.role ? 'list' : 'start'), param: rest.join('/') };
}
// a wizard opened by its address is a role too: a request means "I have cargo", a trip means "I have a truck"
async function asRole(role) {
  if (state.role !== role) { state.role = role; store.set('pacelam.min.role', role); }
  if (api.mode === 'demo') await demoUserFor(role);
}
const SCREENS = { start: screenStart, list: screenList, p: screenPosting, new: async (p) => { await asRole('customer'); return wizard('cargo', p); }, trip: async (p) => { await asRole('carrier'); return wizard('truck', p); }, me: screenMe, auth: screenAuth, hello: screenHello };
function langSwitch() {
  return h('div.lang', { role: 'group', 'aria-label': t('lang') }, LANGS.map((l) => h('button', { type: 'button', lang: l, class: l === getLang() ? 'is-on' : '', 'aria-pressed': l === getLang() ? 'true' : 'false', onclick: () => { if (l !== getLang()) { setLang(l); render(); } } }, l.toUpperCase())));
}
function paintBar(r, el) {
  clear(bar);
  let left;
  if (el?.back) left = h('button.round.round--plain', { type: 'button', 'aria-label': t('back'), onclick: () => { if (typeof el.back === 'function') el.back(); else if (trail.length > 1) history.back(); else leave(el.back); } }, icon('back'));
  else if (r.name === 'list') left = h('a.round.round--plain', { href: '#/me', 'aria-label': t('profile') }, icon('user'));
  else left = h('span.brand', { 'aria-label': 'Paceļam' }, 'Pace', h('span', null, 'ļ'), 'am');
  bar.append(left, langSwitch());
  const skip = $('.skip'); if (skip) skip.textContent = t('skip');
}
let renderId = 0;
let current = null;
let shownKey = null;   // the screen on show: only a new one moves in, scrolls to the top and is announced
const announcer = h('div.sr-only', { 'aria-live': 'polite', role: 'status' });
async function render() {
  const id = ++renderId;
  const r = route();
  // an address the app does not know (an old link, a typo) leads to the list or the doors, never to a dead end
  if (!SCREENS[r.name]) { leave(state.role ? '#/list' : '#/start'); return; }
  const fn = SCREENS[r.name];
  current?.cleanup?.(); current = null;
  paintBar(r, null);
  const slow = setTimeout(() => { if (id === renderId) { clear(view); clear(foot); view.append(h('div.spinner', { role: 'status', 'aria-label': t('loading') })); } }, 500);
  let el;
  try { el = await fn(r.param); } catch (e) { console.warn(e); el = h('section.screen', null, h('p.muted', null, errorText(e))); el.back = state.role ? '#/list' : null; }
  clearTimeout(slow);
  if (id !== renderId) { el?.cleanup?.(); return; }
  clear(view); clear(foot);
  view.append(el);
  current = el;
  paintBar(r, el);
  if (el.foot) foot.append(el.foot);
  document.body.classList.toggle('has-foot', !!el.foot);
  const heading = view.querySelector('h1')?.textContent || 'Paceļam';
  document.title = [view.querySelector('h1')?.textContent, 'Paceļam'].filter(Boolean).join(' · ');
  const key = `${r.name}/${r.param}`;
  if (key !== shownKey) {
    // a refresh of the same screen (news, a language) neither jumps to the top nor replays the entrance
    shownKey = key;
    el.classList.add('is-fresh');
    window.scrollTo(0, 0);
    if (!announcer.isConnected) document.body.append(announcer);
    announcer.textContent = heading;   // a screen reader hears where it is now (red team: it heard nothing)
    if (!document.querySelector('.sheet.is-open')) view.focus({ preventScroll: true });
  }
}

// News only inside the app (client's answer, October 2026): a line on the screen, and the list is fresh.
const seenKept = store.get('pacelam.min.seen', []);
const seen = new Set(Array.isArray(seenKept) ? seenKept.filter((x) => typeof x === 'string') : []);
let firstPoll = true;
async function poll() {
  if (!state.session || document.visibilityState !== 'visible') return;
  try {
    const unread = ((await api.listNotifications()) || []).filter((n) => !n.read_at);
    const fresh = unread.filter((n) => !seen.has(n.id));
    unread.forEach((n) => seen.add(n.id));
    store.set('pacelam.min.seen', [...seen].slice(-200));
    if (unread.length) api.markRead(unread.map((n) => n.id)).catch(() => {});
    // what waited while the app was closed is already in the list; a line is for what arrives while it is open
    if (fresh.length && !firstPoll) {
      const n = fresh[0]; const p = n.payload || {};
      toast(n.type === 'bid' ? t('n_bid', { p: p.amount != null ? amt(p.amount) : '' }) : (n.type === 'deal' || n.type === 'accepted' || n.type === 'taken') ? t('n_deal', { from: p.from || '', to: p.to || '' }) : t('n_job', { from: p.from || '', to: p.to || '' }));
      if (route().name === 'list' && !document.querySelector('.sheet.is-open')) render();
    }
    firstPoll = false;
  } catch { /* offline */ }
}

async function loadMe() {
  state.session = api.getSession();
  state.me = state.session ? await api.getMe().catch(() => null) : null;
  // what a guest filled in before signing in stays his after it: the request he was about to send, his last route
  const id = myId();
  if (id) for (const key of ['pacelam.min.wiz.cargo', 'pacelam.min.wiz.truck', 'pacelam.lastRoute']) {
    const guest = store.get(`${key}.guest`);
    if (guest == null) continue;
    if (store.get(`${key}.${id}`) == null) store.set(`${key}.${id}`, guest);
    store.set(`${key}.guest`, null);
  }
  return state.me;
}
// dark first; the light theme is one tap away in the profile and is remembered (the same key as the full version)
function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  $('meta[name="theme-color"]')?.setAttribute('content', light ? '#F3F5F8' : '#0B0D11');
  store.set('pacelam.theme', light ? 'light' : 'dark');
}
async function boot() {
  applyTheme(store.get('pacelam.theme', 'dark'));
  setLang(detectLang());
  const [vehicleTypes, groups, cargoTypes] = await Promise.all([api.getVehicleTypes(), api.getVehicleGroups(), api.getCargoTypes()]).catch(() => [[], [], []]);
  state.ref = { vehicleTypes: vehicleTypes || [], groups: groups || [], cargoTypes: cargoTypes || [] };
  await loadMe();
  // links from the public page: ?post=cargo|truck, ?demo=carrier|customer, ?role=…
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo'); const post = params.get('post'); const roleParam = params.get('role');
  if (demo === 'operator') { location.replace(`classic.html${location.search}#/operator`); return; }   // the dispatcher's desk stays in the full version
  let target = null;
  const want = post === 'cargo' || demo === 'customer' || roleParam === 'customer' ? 'customer' : post === 'truck' || demo === 'carrier' || roleParam === 'carrier' ? 'carrier' : null;
  if (want) { state.role = want; store.set('pacelam.min.role', want); target = post === 'cargo' ? '#/new' : post === 'truck' ? '#/trip' : (location.hash.length > 2 ? location.hash : '#/list'); }
  if (demo || post || roleParam || params.get('visit')) {
    const url = new URL(location.href);
    for (const k of ['demo', 'post', 'role', 'visit']) url.searchParams.delete(k);
    history.replaceState(null, '', url.pathname + url.search + (target || location.hash));
  }
  if (!state.role && profile()?.role && api.mode !== 'demo') { state.role = profile().role; store.set('pacelam.min.role', state.role); }
  if (api.mode === 'demo' && state.role) await demoUserFor(state.role);
  api.onAuth(async (s, why) => { await loadMe(); if (why === 'expired') { toast(t('err_login')); state.after = location.hash || '#/list'; go('#/auth'); } });
  window.addEventListener('hashchange', () => {
    const now = location.hash;
    if (trail.length > 1 && trail[trail.length - 2] === now) trail.pop(); else if (trail[trail.length - 1] !== now) trail.push(now);
    render();
  });
  document.addEventListener('visibilitychange', poll);
  setInterval(poll, 30000);
  await render();
  poll();
}
boot();
