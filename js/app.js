// Paceļam — application shell and screens. Hash routing, no framework.
// One adaptive layout: cards below 1024 px, a sortable table with a filter sidebar from 1024 px,
// plus an inline details panel from 1440 px. Data and logic are shared; only rendering switches.
import { api } from './api.js';
import { t, setLang, getLang, detectLang, LANGS, nameOf, labelOf } from './i18n.js';
import { h, $, $$, clear, append, icon, toast, sheet, confirmSheet, field, input, chips, spinner, emptyState, fmtMoney, fmtInt, fmtNum, fmtDate, fmtDateRange, relTime, isoDate, addDays } from './ui.js';
import { CITIES, searchCities, findCity, nearestCity, haversineKm, detourKm } from './geo.js';
import { compressPhoto } from './photos.js';

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const num = (v) => { const s = String(v ?? '').trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };

// Decision of 23.09.2026: only the carrier names a price; the customer waits for offers and taps
// "Agree" or "Let me think". The customer's price field and the urgent/planned choice are switched
// off here, not removed — flip back if the client changes his mind (urgent mark: open question).
const CUSTOMER_PRICE = false;
const URGENT_CHOICE = false;

const mqTable = window.matchMedia('(min-width: 1024px)');
const mqWide = window.matchMedia('(min-width: 1440px)');
const layout = () => (mqTable.matches ? 'table' : 'cards');
const isWide = () => mqWide.matches;

const state = {
  session: api.getSession(),
  me: null,
  ref: { vehicleTypes: [], groups: [], cargoTypes: [] },
  route: store.get('pacelam.route'),
  filter: { kind: 'all', mode: 'all', vehicleTypes: [], cargoTypes: [] },
  sort: null,               // { key, dir } for the table; null = default
  selected: null,           // posting id shown in the board's details panel
  showAll: false,
  unread: 0,
  seenNotified: new Set(store.get('pacelam.notified', [])),
  after: null,
  postKind: null,
  myTab: 'postings',
  roleHint: null,
  bidSort: 'price',
};

const view = $('#view');
const nav = $('#nav');
const topActions = $('#top-actions');
const go = (hash) => { location.hash = hash; };
const myId = () => api.userId();
const vtype = (code) => state.ref.vehicleTypes.find((v) => v.code === code) || null;
const ctype = (id) => state.ref.cargoTypes.find((c) => c.id === id) || null;
const myCity = () => (state.me?.profile?.city_lat != null ? { lat: state.me.profile.city_lat, lng: state.me.profile.city_lng, name: state.me.profile.city_name } : null);
const isCustomer = () => state.me?.profile?.role === 'customer';
const photoThumb = (p) => (api.mode === 'demo' ? p : api.photoUrl(p.replace(/\.jpg$/, '_t.jpg')));
const photoFull = (p) => api.photoUrl(p);

function errorText(e) {
  const m = String(e?.message || '');
  if (/already taken|not open|is not open|not active|not pending/i.test(m)) return t('err_not_open');
  if (/own posting/i.test(m)) return t('err_own');
  if (/invalid login|invalid_grant|invalid credentials|Invalid login credentials/i.test(m)) return t('err_auth');
  if (/not authenticated|JWT|401/i.test(m)) return t('login_required');
  if (/profile required/i.test(m)) return t('profile_required');
  if (/instant price/i.test(m)) return t('err_no_instant');
  if (/rate limit|429|too many/i.test(m)) return t('err_rate');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('err_network');
  return m ? `${t('error_generic')} (${m})` : t('error_generic');
}
const fail = (e) => { console.error(e); toast(errorText(e), 'error'); };

// ---------------------------------------------------------------------------------------
// Theme and language
// ---------------------------------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  $('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F3F5F8' : '#0B0D11');
  store.set('pacelam.theme', theme);
}
// LV | RU | EN always in the header, big enough for a thumb: a driver who does not read Latvian
// must find his language without reading anything. The choice is remembered (i18n.setLang).
function langSwitch() {
  return h('div.langsw', { role: 'group', 'aria-label': t('lang_pick') }, LANGS.map((l) => h('button', {
    type: 'button', lang: l, class: l === getLang() ? 'is-on' : '', 'aria-pressed': l === getLang() ? 'true' : 'false',
    onclick: () => { if (l === getLang()) return; setLang(l); renderChrome(); render(); },
  }, l.toUpperCase())));
}
function langSheet() {
  const s = sheet({
    title: t('lang_pick'),
    body: h('div.stack.stack--tight', null, LANGS.map((l) => h('button.btn.btn--wide', {
      type: 'button', class: l === getLang() ? 'btn--primary' : '',
      onclick: () => { setLang(l); s.close(); renderChrome(); render(); },
    }, { lv: 'Latviešu', ru: 'Русский', en: 'English' }[l]))),
  });
}

// ---------------------------------------------------------------------------------------
// Chrome: header, desktop navigation, bottom navigation
// ---------------------------------------------------------------------------------------
function navItems() {
  const items = [
    ['#/', 'list', t('nav_feed'), 'feed'],
    ['#/search', 'bell', t('nav_search'), 'search'],
    ['#/post', 'plus', t('nav_post'), 'post'],
    ['#/my', 'box', t('nav_my'), 'my'],
    ['#/me', 'user', t('nav_profile'), 'me'],
  ];
  if (state.me?.profile?.is_operator) items.splice(3, 0, ['#/operator', 'bolt', t('nav_operator'), 'operator']);
  return items;
}
function renderChrome() {
  const current = route().name;
  clear(topActions);
  const desktopNav = h('nav.top__nav', { 'aria-label': t('nav_feed') });
  for (const [href, , label, name] of navItems()) {
    desktopNav.append(h('a', { href, class: current === name ? 'is-active' : '', 'aria-current': current === name ? 'page' : null }, label));
  }
  topActions.append(desktopNav);
  if (state.session) {
    const bell = h('button.icon-btn', { type: 'button', 'aria-label': t('notifications') + (state.unread ? ` (${state.unread})` : ''), onclick: () => go('#/inbox') }, icon('bell'));
    if (state.unread) bell.append(h('span.badge', { 'aria-hidden': 'true' }, String(state.unread)));
    topActions.append(bell);
  }
  topActions.append(h('a.lang-btn.top__about', { href: `../?lang=${getLang()}` }, t('about')));
  topActions.append(langSwitch());
  clear(nav);
  for (const [href, ic, label, name] of navItems().filter((i) => i[3] !== 'operator')) {
    const active = current === name;
    const a = h('a', { href, class: [name === 'post' ? 'nav__post' : '', active ? 'is-active' : ''].join(' ').trim(), 'aria-current': active ? 'page' : null });
    if (name === 'post') a.append(h('span.nav__plus', null, icon('plus')), label);
    else a.append(icon(ic), label);
    nav.append(a);
  }
  document.title = 'Paceļam — ' + t('brand_tag');
}

// ---------------------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------------------
function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = hash.split('/');
  return { name: name || 'feed', param: rest.join('/') };
}
let renderId = 0;
let currentScreen = null;
async function render() {
  const id = ++renderId;
  const r = route();
  const screens = { feed: screenFeed, post: screenPost, p: screenDetail, my: screenMy, search: screenSearch, me: screenProfile, auth: screenAuth, onboarding: screenOnboarding, inbox: screenInbox, operator: screenOperator };
  const fn = screens[r.name] || screenFeed;
  renderChrome();
  view.classList.toggle('view--board', r.name === 'feed');
  currentScreen?.cleanup?.();
  currentScreen = null;
  clear(view);
  view.append(spinner());
  try {
    const el = await fn(r.param);
    if (id !== renderId) return;
    clear(view);
    view.append(el);
    currentScreen = el;
    if (!(r.name === 'feed' && state.selected)) window.scrollTo(0, 0);
  } catch (e) {
    if (id !== renderId) return;
    clear(view);
    view.append(emptyState(t('error_generic'), e?.message || ''));
    console.error(e);
  }
}
function requireAuth() {
  if (!state.session) { state.after = location.hash || '#/'; go('#/auth'); return false; }
  if (!state.me?.profile) { state.after = location.hash || '#/'; go('#/onboarding'); return false; }
  return true;
}
const rerender = () => render();

// ---------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------
function tagRow(p, extra = []) {
  return h('div.pcard__top', null,
    h('span.tag', { class: p.kind === 'cargo' ? 'tag--cargo' : 'tag--truck' }, p.kind === 'cargo' ? t('kind_cargo') : t('kind_truck')),
    p.kind === 'cargo' && (p.mode === 'urgent' || URGENT_CHOICE) ? h('span.tag', { class: p.mode === 'urgent' ? 'tag--urgent' : 'tag--planned' }, p.mode === 'urgent' ? t('mode_urgent') : t('mode_planned')) : null,
    p.is_operator_posting ? h('span.tag.tag--op', { title: t('operator_hint') }, t('operator')) : null,
    p.status && p.status !== 'open' ? h('span.tag.tag--status', null, t('status_' + p.status)) : null,
    ...extra,
    h('span.pcard__age', null, relTime(p.created_at)));
}
function metricFor(p) {
  const from = { lat: p.from_lat, lng: p.from_lng };
  const to = { lat: p.to_lat, lng: p.to_lng };
  const trip = haversineKm(from.lat, from.lng, to.lat, to.lng);
  if (state.route?.from && state.route?.to && !isCustomer()) {
    const d = detourKm(state.route, from, to);
    return { detour: d, dist: null, trip, big: d <= 5 ? t('on_the_way') : t('detour', { km: fmtInt(d) }), good: d <= 5, sub: t('direct', { km: fmtInt(trip) }), sortKey: d };
  }
  const c = myCity();
  if (c) {
    const d = haversineKm(c.lat, c.lng, from.lat, from.lng);
    return { detour: null, dist: d, trip, big: d < 3 ? t('in_your_town') : t('from_you', { km: fmtInt(d) }), good: d <= 20, sub: t('direct', { km: fmtInt(trip) }), sortKey: d };
  }
  return { detour: null, dist: null, trip, big: t('direct', { km: fmtInt(trip) }), good: false, sub: '', sortKey: trip };
}
// A tiny route glyph: dotted straight line = my way, amber bump = the detour the cargo adds.
function detourGlyph(m) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 46 18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'dg' + (m.good ? ' is-good' : ''));
  const km = m.detour != null ? m.detour : (m.dist != null ? m.dist : 0);
  const bump = Math.min(11, 1 + km / 12);
  svg.innerHTML = `<line class="dg__base" x1="3" y1="14" x2="43" y2="14"/><path class="dg__bump" d="M3 14 C 14 14 16 ${14 - bump} 23 ${14 - bump} C 30 ${14 - bump} 32 14 43 14"/><circle cx="3" cy="14" r="2"/><circle cx="43" cy="14" r="2"/>`;
  return svg;
}
function factsLine(p) {
  const parts = [];
  if (p.weight_kg != null) parts.push(`${fmtInt(p.weight_kg)} ${t('kg')}`);
  if (p.length_m != null || p.width_m != null || p.height_m != null) parts.push([p.length_m, p.width_m, p.height_m].map((x) => (x == null ? '–' : fmtNum(x, 2))).join('×') + ' ' + t('m'));
  if (p.volume_m3 != null) parts.push(`${fmtNum(p.volume_m3, 1)} ${t('m3')}`);
  return parts.join(' · ');
}
function typeLine(p) {
  const bits = [];
  if (p.kind === 'cargo' && p.cargo_type_id) bits.push(nameOf(ctype(p.cargo_type_id)));
  if (p.vehicle_type_code) { const v = vtype(p.vehicle_type_code); if (v) bits.push(`${v.code} ${nameOf(v)}`); } else if (p.kind === 'cargo') bits.push(t('any_vehicle'));
  bits.push(fmtDateRange(p.date_from, p.date_to));
  return bits.join(' · ');
}
function priceLine(p) {
  const el = h('div.pcard__price');
  if (p.price != null) {
    if (p.kind === 'cargo' && p.mode === 'planned') el.append(h('b', null, fmtMoney(p.price)), h('span', null, t('price_instant', { p: '' }).replace(/^\s*€?\s*—\s*/, '')));
    else if (p.kind === 'truck') el.append(h('span', null, t('kv_asking').toLowerCase()), h('b', null, fmtMoney(p.price)));
    else el.append(h('b', null, fmtMoney(p.price)));
  }
  {
    el.append(h('span', null, p.bid_count ? t('bids_n', { n: p.bid_count }) : t('no_bids')));
    if (p.best_bid != null) el.append(h('span', null, t('best_bid', { p: fmtInt(p.best_bid) })));
  }
  return el.childNodes.length ? el : null;
}
function priceCell(p) {
  const bits = [];
  if (p.price != null) bits.push(fmtMoney(p.price));
  if (p.mode === 'planned' || p.kind === 'truck') bits.push(p.bid_count ? `${t('bids_n', { n: p.bid_count })}${p.best_bid != null ? ' · ' + fmtMoney(p.best_bid) : ''}` : t('no_bids'));
  return bits.join(' · ');
}
function actionButtons(p, opts = {}) {
  const me = myId();
  if (!me || p.owner_id === me || p.status !== 'open') return null;
  const row = h('div.pcard__actions');
  const cls = opts.big ? 'btn--big' : '';
  if (p.kind === 'truck' && !CUSTOMER_PRICE) {
    // transport: the carrier's price — agree to it; or put your cargo on this route and wait for his offer
    if (p.price != null) row.append(h('button.btn.btn--primary', { type: 'button', class: cls, onclick: () => doTake(p) }, icon('check'), t('agree_for', { p: fmtInt(p.price) })));
    row.append(h('button.btn', { type: 'button', class: [cls, p.price == null ? 'btn--primary' : 'btn--ghost'].join(' '), onclick: () => offerCargoFor(p) }, t('offer_my_cargo')));
    return row;
  }
  if (p.kind === 'cargo' && p.mode === 'urgent') {
    // urgent: price decides here too — agreeing to the customer's price is a bid at that price, the customer picks
    if (p.price != null && !opts.myBid) row.append(h('button.btn.btn--primary', { type: 'button', class: cls, onclick: () => doAgree(p) }, icon('bolt'), t('take_for', { p: fmtInt(p.price) })));
    row.append(h('button.btn', { type: 'button', class: [cls, p.price == null || opts.myBid ? 'btn--primary' : 'btn--ghost'].join(' '), onclick: () => bidSheet(p, opts.myBid) }, opts.myBid ? t('bid_update') : t('bid')));
    return row;
  }
  if (p.price != null) row.append(h('button.btn.btn--primary', { type: 'button', class: cls, onclick: () => doTake(p) }, t('take_for', { p: fmtInt(p.price) })));
  row.append(h('button.btn', { type: 'button', class: [cls, p.price == null ? 'btn--primary' : 'btn--ghost'].join(' '), onclick: () => bidSheet(p, opts.myBid) }, opts.myBid ? t('bid_update') : (p.kind === 'truck' ? t('offer_cargo') : t('bid'))));
  return row;
}
function postingCard(p, opts = {}) {
  const m = metricFor(p);
  const me = myId();
  const card = h('article.pcard.card', { class: [p.mode === 'urgent' && p.status === 'open' ? 'is-urgent' : '', p.owner_id === me ? 'is-mine' : ''].join(' ').trim() });
  const link = h('a.pcard__link', { href: `#/p/${p.id}`, 'aria-label': `${p.from_name} → ${p.to_name}` },
    tagRow(p),
    h('div.pcard__route', null, h('span', null, p.from_name), icon('arrow'), h('span', null, p.to_name)),
    h('div.pcard__metric', null, detourGlyph(m), h('b', { class: m.good ? 'is-good' : '' }, m.big), m.sub ? h('span', null, m.sub) : null),
    factsLine(p) ? h('div.pcard__facts', null, factsLine(p)) : null,
    h('div.pcard__meta', null, p.photos?.length ? h('img.pcard__thumb', { src: photoThumb(p.photos[0]), alt: '', loading: 'lazy', width: 44, height: 44 }) : null, h('span', null, typeLine(p))),
    priceLine(p));
  card.append(link);
  if (!opts.noActions) {
    const actions = actionButtons(p);
    if (actions) card.append(actions);
  }
  return card;
}
async function doAgree(p) {
  if (!requireAuth()) return;
  const ok = await confirmSheet(t('take_for', { p: fmtInt(p.price) }), `${p.from_name} → ${p.to_name} · ${fmtMoney(p.price)}\n${t('agree_hint')}`, t('take_for', { p: fmtInt(p.price) }));
  if (!ok) return;
  try {
    await api.placeBid(p.id, p.price, '');
    toast(t('agree_sent'));
    if (route().name === 'p' || (route().name === 'feed' && layout() === 'table')) { state.selected = p.id; rerender(); } else go(`#/p/${p.id}`);
  } catch (e) { fail(e); }
}
async function doTake(p) {
  if (!requireAuth()) return;
  const text = `${p.from_name} → ${p.to_name}` + (p.price != null ? ` · ${fmtMoney(p.price)}` : '') + '\n' + (p.mode === 'urgent' ? t('mode_urgent_hint') : t('deal_done'));
  const truck = p.kind === 'truck' && p.price != null;
  const ok = await confirmSheet(truck ? t('agree_for', { p: fmtInt(p.price) }) : (p.price != null ? t('take_for', { p: fmtInt(p.price) }) : t('take')), truck ? `${p.from_name} → ${p.to_name} · ${fmtMoney(p.price)}\n${t('agree_truck_hint')}` : text, truck ? t('agree') : t('take'));
  if (!ok) return;
  try {
    await api.takePosting(p.id);
    toast(t('deal_done'));
    if (route().name === 'p' || (route().name === 'feed' && layout() === 'table')) { state.selected = p.id; rerender(); } else go(`#/p/${p.id}`);
  } catch (e) { fail(e); }
}
// The customer never names a price: "offer my cargo" on a truck opens the cargo posting with that
// route and date filled in; carriers, this one included, then send their offers.
function offerCargoFor(p) {
  if (!requireAuth()) return;
  store.set('pacelam.prefill', { from: { name: p.from_name, lat: p.from_lat, lng: p.from_lng, radius: p.from_radius_km || 0 }, to: { name: p.to_name, lat: p.to_lat, lng: p.to_lng, radius: p.to_radius_km || 0 }, date_from: p.date_from, date_to: p.date_to });
  state.postKind = 'cargo';
  go('#/post/cargo');
}
function bidSheet(p, existing) {
  if (!requireAuth()) return;
  const amount = input({ inputmode: 'decimal', autocomplete: 'off', value: existing ? String(existing.amount) : '', class: 'input--num', placeholder: p.best_bid != null ? String(p.best_bid) : (p.price != null ? String(p.price) : '') });
  const note = input({ value: existing?.note || '', maxlength: 300 });
  const s = sheet({
    title: p.kind === 'truck' ? t('offer_cargo') : t('bid'),
    body: h('form.form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const a = num(amount.value);
        if (!(a > 0)) { amount.focus(); return; }
        try { await api.placeBid(p.id, a, note.value.trim()); s.close(); toast(t('bid_placed')); rerender(); } catch (err) { fail(err); }
      },
    },
    h('p.lead', null, p.kind === 'truck' ? t('bid_hint_truck') : (p.mode === 'urgent' ? t('bid_hint_urgent') : t('bid_hint_cargo'))),
    field(t('bid_amount'), amount),
    field(t('bid_note'), note),
    h('button.btn.btn--primary.btn--wide.btn--big', { type: 'submit' }, t('bid_send'))),
  });
}

// City picker (sheet) ---------------------------------------------------------------------
function pickPlace({ title, withRadius = false, current = null }) {
  return new Promise((resolve) => {
    let chosen = null;
    let radius = current?.radius ?? 0;
    const q = input({ placeholder: t('city_search'), autocomplete: 'off', enterkeyhint: 'search', 'aria-label': t('city_search') });
    const results = h('div.list');
    const recent = store.get('pacelam.recent', []);
    const finish = (place) => {
      chosen = place ? { ...place, radius: withRadius ? radius : 0 } : null;
      if (chosen) store.set('pacelam.recent', [chosen.name, ...recent.filter((n) => n !== chosen.name)].slice(0, 4));
      s.close(true);
    };
    const rowFor = (c) => h('button.cityrow', { type: 'button', onclick: () => finish({ name: c.name, lat: c.lat, lng: c.lng }) }, h('span', null, c.name), h('small', null, c.country));
    const showList = (list) => { clear(results); if (!list.length) results.append(h('p.muted.small', { style: { padding: '12px 0' } }, t('no_city'))); for (const c of list) results.append(rowFor(c)); };
    const initial = () => {
      const recentCities = recent.map((n) => findCity(n)).filter(Boolean);
      const defaults = ['Rīga', 'Daugavpils', 'Rēzekne', 'Jelgava', 'Liepāja', 'Vilnius', 'Tallinn'].map((n) => findCity(n)).filter(Boolean);
      showList(recentCities.length ? recentCities : defaults);
    };
    q.addEventListener('input', () => { const v = q.value.trim(); if (!v) initial(); else showList(searchCities(v, 10)); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = searchCities(q.value.trim(), 1)[0]; if (first) finish({ name: first.name, lat: first.lat, lng: first.lng }); } });
    // "My location" snaps to the nearest town: exact GPS coordinates are never stored or shown.
    const geoBtn = h('button.btn.btn--ghost.btn--wide', {
      type: 'button',
      onclick: () => {
        if (!navigator.geolocation) return;
        geoBtn.disabled = true;
        navigator.geolocation.getCurrentPosition((pos) => {
          const { city } = nearestCity(pos.coords.latitude, pos.coords.longitude);
          finish({ name: city.name, lat: city.lat, lng: city.lng });
        }, () => { geoBtn.disabled = false; toast(t('error_generic'), 'error'); }, { timeout: 8000, maximumAge: 60000 });
      },
    }, icon('target'), t('my_location'));
    const radiusChips = withRadius ? chips([0, 25, 50, 100].map((r) => ({ value: r, label: r ? t('km_plus', { km: r }) : '0 km' })), { value: radius, name: t('radius'), onChange: (v) => { radius = v; } }) : null;
    const s = sheet({
      title,
      body: h('div.stack', null, q, geoBtn, withRadius ? field(t('radius'), radiusChips) : null, results),
      onClose: () => resolve(chosen),
    });
    initial();
  });
}
function placeButton(labelKey, getPlace, onPick, withRadius = false) {
  const btn = h('button.picker', { type: 'button' });
  const paint = () => {
    const p = getPlace();
    clear(btn);
    btn.append(h('span', null, h('span.picker__k', null, t(labelKey)), h('span.picker__v', { class: p ? '' : 'is-empty' }, p ? p.name + (p.radius ? ` ${t('km_plus', { km: p.radius })}` : '') : t('pick_city'))), icon('pin'));
  };
  btn.addEventListener('click', async () => { const p = await pickPlace({ title: t(labelKey), withRadius, current: getPlace() }); if (p) { onPick(p); paint(); } });
  paint();
  btn.repaint = paint;
  return btn;
}
// Keyboard-first city field for the operator form (native datalist, resolved on submit).
let cityDatalist = null;
function cityField(labelKey, opts = {}) {
  if (!cityDatalist) {
    cityDatalist = h('datalist', { id: 'pacelam-cities' });
    for (const c of CITIES) cityDatalist.append(h('option', { value: c.name }, c.country));
    document.body.append(cityDatalist);
  }
  const inp = input({ list: 'pacelam-cities', autocomplete: 'off', placeholder: t('city_search'), required: true, value: opts.value || '' });
  inp.resolve = () => { const v = inp.value.trim(); if (!v) return null; return findCity(v) || searchCities(v, 1)[0] || null; };
  return field(t(labelKey), inp, opts.hint);
}

// Route and filters ------------------------------------------------------------------------
function routeSheet(after) {
  const draft = state.route ? { ...state.route } : { from: myCity() ? { ...myCity() } : null, to: null, maxDetour: state.me?.profile?.max_detour_km || 60 };
  const fromBtn = placeButton('from', () => draft.from, (p) => { draft.from = p; });
  const toBtn = placeButton('to', () => draft.to, (p) => { draft.to = p; });
  const rangeLabel = h('span', null, t('feed_detour_upto', { km: draft.maxDetour }));
  const range = h('input.range', { type: 'range', min: 10, max: 300, step: 10, value: draft.maxDetour, 'aria-label': t('max_detour'), oninput: () => { draft.maxDetour = Number(range.value); rangeLabel.textContent = t('feed_detour_upto', { km: draft.maxDetour }); } });
  const s = sheet({
    title: t('feed_route'),
    body: h('div.stack', null, fromBtn, toBtn, h('div.field', null, h('div.field__label', null, rangeLabel), range),
      h('div.row', null,
        h('button.btn.btn--ghost', { type: 'button', onclick: () => { state.route = null; store.set('pacelam.route', null); s.close(); (after || render)(); } }, t('delete')),
        h('button.btn.btn--primary', { type: 'button', style: { flex: '1' }, onclick: () => { if (!draft.from || !draft.to) { toast(t('validation_route'), 'error'); return; } state.route = draft; store.set('pacelam.route', draft); s.close(); (after || render)(); } }, t('save')))),
  });
}
const emptyFilter = () => ({ kind: 'all', mode: 'all', vehicleTypes: [], cargoTypes: [] });
const filterActive = () => state.filter.kind !== 'all' || state.filter.mode !== 'all' || state.filter.vehicleTypes.length || state.filter.cargoTypes.length;
function passesFilter(p) {
  const f = state.filter;
  if (f.kind !== 'all' && p.kind !== f.kind) return false;
  if (f.mode !== 'all' && p.kind === 'cargo' && p.mode !== f.mode) return false;
  if (f.vehicleTypes.length && p.vehicle_type_code && !f.vehicleTypes.includes(p.vehicle_type_code)) return false;
  if (f.cargoTypes.length && p.cargo_type_id && !f.cargoTypes.includes(p.cargo_type_id)) return false;
  return true;
}
function filterControls(onChange) {
  const f = state.filter;
  const kindSeg = chips([{ value: 'all', label: t('feed_all') }, { value: 'cargo', label: t('kind_cargo') }, { value: 'truck', label: t('kind_truck') }], { value: f.kind, name: t('kind_cargo'), onChange: (v) => { f.kind = v; onChange(); } });
  const modeSeg = chips([{ value: 'all', label: t('feed_all') }, { value: 'urgent', label: t('mode_urgent') }, { value: 'planned', label: t('mode_planned') }], { value: f.mode, name: t('mode'), onChange: (v) => { f.mode = v; onChange(); } });
  const vt = chips(state.ref.vehicleTypes.map((v) => ({ value: v.code, label: v.code })), { value: f.vehicleTypes, multi: true, name: t('search_vehicles'), onChange: (v) => { f.vehicleTypes = v; onChange(); } });
  const ct = chips(state.ref.cargoTypes.map((c) => ({ value: c.id, label: nameOf(c) })), { value: f.cargoTypes, multi: true, name: t('search_cargo'), onChange: (v) => { f.cargoTypes = v; onChange(); } });
  return [field(`${t('kind_cargo')} / ${t('kind_truck')}`, kindSeg), field(t('mode'), modeSeg), field(t('search_vehicles'), vt), field(t('search_cargo'), ct)];
}
function filterSheet() {
  const s = sheet({
    title: t('feed_filter'),
    body: h('div.stack', null, ...filterControls(() => {}),
      h('div.row', null,
        h('button.btn.btn--ghost', { type: 'button', onclick: () => { state.filter = emptyFilter(); s.close(); render(); } }, t('reset')),
        h('button.btn.btn--primary', { type: 'button', style: { flex: '1' }, onclick: () => { s.close(); render(); } }, t('save')))),
  });
}

// ---------------------------------------------------------------------------------------
// "Offer" — two big doors: cargo and transport. The client's wording (23.09.2026): the first thing
// on the site is "Предложить ⬇ Груз / Транспорт", understood from the pictures, not from the words.
// ---------------------------------------------------------------------------------------
function offerBlock({ page = false } = {}) {
  const door = (kind) => h('button.offer__btn', {
    type: 'button', class: `offer__btn--${kind}`, 'aria-label': kind === 'truck' ? t('offer_truck') : t('offer_cargo'),
    onclick: () => startOffer(kind),
  }, icon(kind === 'truck' ? 'truck' : 'box'), h('span', null, kind === 'truck' ? t('kind_truck') : t('kind_cargo')));
  return h('section.offer', { class: page ? 'offer--page' : '' },
    h(page ? 'h1.offer__title' : 'h2.offer__title', null, t('offer_title'), icon('down')),
    h('div.offer__row', null, door('cargo'), door('truck')));
}
// A visitor in the demo becomes the matching sample user at once: cargo — the customer, transport — the carrier.
async function startOffer(kind) {
  if (!state.session && api.mode === 'demo') {
    const u = api.demoUsers.find((x) => x.key === (kind === 'truck' ? 'demo_carrier' : 'demo_customer'));
    if (u) { await api.signInDemo(u.id); await loadMe(); }
  }
  if (!state.session) state.roleHint = kind === 'truck' ? 'carrier' : 'customer';
  state.postKind = kind;
  go(`#/post/${kind}`);
}

// ---------------------------------------------------------------------------------------
// Feed / board
// ---------------------------------------------------------------------------------------
const COLUMNS = [
  { key: 'kind', label: 'col_kind' },
  { key: 'route', label: 'col_route' },
  { key: 'metric', label: null },
  { key: 'date', label: 'col_date' },
  { key: 'vehicle', label: 'col_vehicle' },
  { key: 'cargo', label: 'col_cargo' },
  { key: 'weight', label: 'col_weight' },
  { key: 'price', label: 'col_price' },
  { key: 'age', label: 'col_age' },
];
function sortValue(x, key) {
  const p = x.p;
  switch (key) {
    case 'kind': return `${p.kind}-${p.mode}`;
    case 'route': return `${p.from_name} ${p.to_name}`;
    case 'metric': return x.m.sortKey;
    case 'date': return p.date_from;
    case 'vehicle': return p.vehicle_type_code || 'zzz';
    case 'cargo': return p.cargo_type_id ? nameOf(ctype(p.cargo_type_id)) : 'zzz';
    case 'weight': return p.weight_kg ?? -1;
    case 'price': return p.price ?? p.best_bid ?? Number.MAX_SAFE_INTEGER;
    case 'age': return p.created_at;
    default: return 0;
  }
}
const defaultSort = () => (state.route && !isCustomer() ? { key: 'metric', dir: 'asc' } : { key: 'age', dir: 'desc' });
function sortList(list) {
  const s = state.sort || defaultSort();
  const dir = s.dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const va = sortValue(a, s.key), vb = sortValue(b, s.key);
    if (va === vb) return 0;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), getLang()) * dir;
  });
}

async function screenFeed() {
  const postings = (await api.listPostings()) || [];
  const mode = layout();
  const routeUi = !isCustomer();
  const el = h('section.screen.board', { class: mode === 'table' ? 'board--table' : '' });
  const main = h('div.board__main');
  const detail = h('aside.board__detail', { 'aria-label': t('col_route') });
  let listWrap = h('div');

  const routeBtn = () => h('button.picker', { type: 'button', onclick: () => { if (state.session && !state.me?.profile) { requireAuth(); return; } routeSheet(() => render()); } },
    h('span', null, h('span.picker__k', null, state.route ? `${t('feed_route')} · ${t('feed_detour_upto', { km: state.route.maxDetour })}` : t('feed_route')), h('span.picker__v', { class: state.route ? '' : 'is-empty' }, state.route ? `${state.route.from.name} → ${state.route.to.name}` : t('feed_route_set'))), icon('route'));
  const aside = h('aside.board__filters.card', { 'aria-label': t('filters') },
    routeUi ? h('h2.board__h', null, t('feed_route')) : null, routeUi ? routeBtn() : null, routeUi && !state.route ? h('p.field__hint', null, t('feed_route_none')) : null,
    h('h2.board__h', null, t('filters')),
    ...filterControls(() => refresh()),
    h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => { state.filter = emptyFilter(); state.showAll = false; render(); } }, t('reset')));
  el.append(aside);

  main.append(offerBlock());
  if (api.mode === 'demo') main.append(h('div.banner', null, t('demo_banner')));
  if (!state.session) main.append(h('div.card.cta', null, h('p', null, t('feed_visitors_cta')), h('a.btn.btn--primary', { href: '#/auth' }, t('sign_in'))));
  const strip = h('div.strip', null, routeUi ? routeBtn() : h('div.picker', { style: { cursor: 'default' } }, h('span', null, h('span.picker__k', null, t('feed_title')), h('span.picker__v', null, myCity()?.name || ''))), h('button.icon-btn', { type: 'button', 'aria-label': t('feed_filter'), 'aria-pressed': filterActive() ? 'true' : 'false', class: filterActive() ? 'is-on' : '', onclick: filterSheet }, icon('list')));
  main.append(strip);
  if (routeUi && !state.route && state.session) main.append(h('p.lead.board__hint', null, t('feed_route_none')));
  const toolbar = h('div.board__toolbar');
  main.append(toolbar, listWrap, h('p.feed__about', null, h('a', { href: `../?lang=${getLang()}` }, t('about'))));
  el.append(main, detail);

  const compute = () => {
    let list = postings.filter(passesFilter).map((p) => ({ p, m: metricFor(p) }));
    let far = [];
    if (state.route && routeUi) {
      const max = state.route.maxDetour || 60;
      far = list.filter((x) => x.m.detour > max);
      if (!state.showAll) list = list.filter((x) => x.m.detour <= max);
    }
    return { list: sortList(list), far, total: postings.length };
  };
  const renderCards = (list) => {
    const cards = h('div.cards');
    if (!list.length) cards.append(emptyState(t('feed_empty'), postings.length ? '' : t('feed_empty_hint')));
    for (const x of list) cards.append(postingCard(x.p));
    return cards;
  };
  const renderTable = (list) => {
    const s = state.sort || defaultSort();
    const thead = h('thead', null, h('tr', null, COLUMNS.map((c) => {
      const label = c.label ? t(c.label) : (state.route && routeUi ? t('col_detour') : t('col_distance'));
      const active = s.key === c.key;
      return h('th', { scope: 'col', 'aria-sort': active ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
        h('button.tbl__sort', { type: 'button', class: active ? 'is-on' : '', onclick: () => { state.sort = { key: c.key, dir: active && s.dir === 'asc' ? 'desc' : 'asc' }; refresh(); } }, label, h('span.tbl__dir', { 'aria-hidden': 'true' }, active ? (s.dir === 'asc' ? '↑' : '↓') : '')));
    })));
    const tbody = h('tbody');
    if (!list.length) tbody.append(h('tr', null, h('td', { colspan: COLUMNS.length }, emptyState(t('feed_empty'), postings.length ? '' : t('feed_empty_hint')))));
    for (const x of list) {
      const p = x.p;
      const selected = state.selected === p.id;
      tbody.append(h('tr.tbl__row', {
        tabindex: 0, role: 'button', 'aria-label': `${p.from_name} → ${p.to_name}`, 'aria-pressed': selected ? 'true' : 'false',
        class: [selected ? 'is-selected' : '', p.mode === 'urgent' && p.status === 'open' ? 'is-urgent' : '', p.owner_id === myId() ? 'is-mine' : ''].join(' ').trim(),
        onclick: () => select(p.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.id); } },
      },
      h('td', null, h('span.tag', { class: p.kind === 'cargo' ? 'tag--cargo' : 'tag--truck' }, p.kind === 'cargo' ? t('kind_cargo') : t('kind_truck')), p.kind === 'cargo' ? h('span.tag', { class: p.mode === 'urgent' ? 'tag--urgent' : 'tag--planned' }, p.mode === 'urgent' ? t('mode_urgent') : t('mode_planned')) : null, p.is_operator_posting ? h('span.tag.tag--op', null, t('operator')) : null),
      h('td.tbl__route', null, h('b', null, p.from_name), h('span.muted', null, ' → '), h('b', null, p.to_name)),
      h('td.tbl__num', null, detourGlyph(x.m), h('b', { class: x.m.good ? 'is-good' : 'is-acc' }, x.m.detour != null ? (x.m.detour <= 5 ? t('on_the_way') : `+${fmtInt(x.m.detour)} km`) : `${fmtInt(x.m.dist ?? x.m.trip)} km`), h('small.muted', null, ` · ${fmtInt(x.m.trip)} km`)),
      h('td', null, fmtDateRange(p.date_from, p.date_to)),
      h('td.tbl__vehicle', { title: p.vehicle_type_code ? nameOf(vtype(p.vehicle_type_code)) || '' : '' }, p.vehicle_type_code ? `${p.vehicle_type_code} ${nameOf(vtype(p.vehicle_type_code)) || ''}` : (p.kind === 'cargo' ? t('any_vehicle') : '')),
      h('td.tbl__cargo', null, p.kind === 'cargo' && p.cargo_type_id ? nameOf(ctype(p.cargo_type_id)) : ''),
      h('td.tbl__num', null, factsLine(p)),
      h('td.tbl__num', null, priceCell(p)),
      h('td.muted', null, relTime(p.created_at))));
    }
    return h('div.tbl__wrap', null, h('table.tbl', null, h('caption.sr-only', null, t('feed_title')), thead, tbody));
  };
  const select = (id) => { state.selected = state.selected === id ? null : id; refresh(); };
  const renderDetail = async () => {
    clear(detail);
    if (mode !== 'table') return;
    if (!state.selected) { detail.classList.remove('is-open'); detail.append(h('div.board__placeholder', null, icon('box'), h('p', null, t('select_row')))); return; }
    detail.classList.add('is-open');
    const closeBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('close'), onclick: () => { state.selected = null; refresh(); } }, icon('x'));
    detail.append(h('div.board__detail-head', null, h('a.btn.btn--ghost.btn--sm', { href: `#/p/${state.selected}` }, t('open_full')), closeBtn));
    const body = h('div.board__detail-body', null, spinner());
    detail.append(body);
    const built = await buildDetail(state.selected, { inline: true });
    clear(body);
    body.append(built);
    if (!isWide()) closeBtn.focus({ preventScroll: true });
  };
  const refresh = () => {
    const { list, far, total } = compute();
    clear(toolbar);
    if (mode === 'table') append(toolbar, [h('span.muted', null, t('rows_shown', { n: list.length, total })), state.route && routeUi ? h('span.tag.tag--planned', null, state.showAll ? t('feed_all') : t('showing_near', { km: state.route.maxDetour })) : null]);
    const next = h('div', null, mode === 'table' ? renderTable(list) : renderCards(list));
    if (far.length) next.append(h('div', { style: { marginTop: '14px' } }, h('button.btn.btn--ghost.btn--wide', { type: 'button', onclick: () => { state.showAll = !state.showAll; refresh(); } }, state.showAll ? t('feed_show_near') : t('feed_show_all', { n: far.length }))));
    listWrap.replaceWith(next);
    listWrap = next;
    renderDetail();
  };
  const onKey = (e) => { if (e.key === 'Escape' && state.selected && !isWide()) { state.selected = null; refresh(); } };
  document.addEventListener('keydown', onKey);
  el.cleanup = () => document.removeEventListener('keydown', onKey);
  refresh();
  return el;
}

// ---------------------------------------------------------------------------------------
// Posting details (full page and inline panel share this)
// ---------------------------------------------------------------------------------------
async function buildDetail(id, { inline = false } = {}) {
  const data = await api.getPosting(id);
  if (!data?.posting) return emptyState(t('posting_not_found'));
  const { posting: p, bids, deal } = data;
  const me = myId();
  const isOwner = me && p.owner_id === me;
  const m = metricFor(p);
  const el = h('div.detail.stack', { class: inline ? 'detail--inline' : '' });
  el.append(h('div.card.detail__hero', null,
    tagRow(p),
    h(inline ? 'h2.detail__route' : 'h1.detail__route', null, h('span', null, p.from_name + (p.from_radius_km ? ` ${t('km_plus', { km: p.from_radius_km })}` : '')), icon('arrow'), h('span', null, p.to_name + (p.to_radius_km ? ` ${t('km_plus', { km: p.to_radius_km })}` : ''))),
    h('div.detail__metric', { class: m.good ? 'is-good' : '' }, detourGlyph(m), h('span', null, m.big), m.sub ? h('span.muted.small', null, ' · ' + m.sub) : null),
    h('p.muted', { style: { marginTop: '8px' } }, `${t('when')}: ${fmtDateRange(p.date_from, p.date_to)}`),
    h('p.muted.small', { style: { marginTop: '4px' } }, `${t('posted_by')}: ${p.owner?.display_name || ''}${p.owner?.city_name ? ', ' + p.owner.city_name : ''}`)));
  // what the person came for goes right under the route: contacts after a deal, offers for the owner
  const slot = h('div.stack');
  el.append(slot);
  const facts = h('div.facts');
  if (p.weight_kg != null) facts.append(h('div.card.fact', null, h('div.fact__k', null, t('weight')), h('div.fact__v', null, `${fmtInt(p.weight_kg)} ${t('kg')}`)));
  if (p.length_m != null || p.width_m != null || p.height_m != null) facts.append(h('div.card.fact', null, h('div.fact__k', null, t('dims')), h('div.fact__v', null, [p.length_m, p.width_m, p.height_m].map((x) => (x == null ? '–' : fmtNum(x, 2))).join('×') + ' ' + t('m'))));
  if (p.volume_m3 != null) facts.append(h('div.card.fact', null, h('div.fact__k', null, t('volume')), h('div.fact__v', null, `${fmtNum(p.volume_m3, 1)} ${t('m3')}`)));
  if (facts.childNodes.length) el.append(facts);
  if (p.photos?.length) {
    el.append(h('div.photos', null, p.photos.map((ph, i) => h('button', { type: 'button', 'aria-label': `${t('photos')} ${i + 1}`, onclick: () => sheet({ title: t('photos'), body: h('img', { src: photoFull(ph), alt: '', style: { width: '100%', borderRadius: '12px' } }) }) }, h('img', { src: photoThumb(ph), alt: '', loading: 'lazy' })))));
  }
  const kv = h('dl.kv');
  if (p.kind === 'cargo' && p.cargo_type_id) kv.append(h('dt', null, t('cargo_type')), h('dd', null, nameOf(ctype(p.cargo_type_id))));
  kv.append(h('dt', null, p.kind === 'cargo' ? t('vehicle_needed') : t('vehicle')), h('dd', null, p.vehicle_type_code && vtype(p.vehicle_type_code) ? `${p.vehicle_type_code} ${nameOf(vtype(p.vehicle_type_code))}` : t('any_vehicle')));
  const ct = p.cargo_type_id ? ctype(p.cargo_type_id) : null;
  for (const f of (ct?.fields || [])) {
    const v = p.cargo_fields?.[f.key];
    if (v == null || v === '') continue;
    let text = String(v);
    if (f.type === 'bool') text = v ? t('field_yes') : t('field_no');
    if (f.type === 'choice') text = labelOf((f.options || []).find((o) => o.value === v)) || text;
    kv.append(h('dt', null, labelOf(f)), h('dd', null, text));
  }
  if (p.price != null) kv.append(h('dt', null, p.kind === 'truck' ? t('kv_asking') : (p.mode === 'urgent' ? t('price') : t('kv_instant'))), h('dd', null, fmtMoney(p.price)));
  el.append(h('div.card', { style: { padding: '12px 14px' } }, kv));
  if (p.note) el.append(h('div.card.note', null, p.note));

  if (deal) {
    const otherId = deal.customer_id === me ? deal.carrier_id : deal.customer_id;
    if (deal.status === 'confirmed') {
      const c = await api.getContacts(otherId);
      const box = h('div.card.contacts', null, h('h2', null, t('contacts')), h('p.muted', null, `${t('deal_amount')}: ${deal.amount != null ? fmtMoney(deal.amount) : '—'}`));
      if (c) {
        const digits = String(c.phone || '').replace(/[^\d+]/g, '');
        box.append(h('a.btn.btn--primary.btn--big', { href: `tel:${digits}` }, icon('phone'), c.phone));
        box.append(h('a.btn.btn--ghost', { href: `https://wa.me/${digits.replace(/^\+/, '')}`, target: '_blank', rel: 'noopener' }, t('whatsapp')));
        if (c.email) box.append(h('a.btn.btn--ghost', { href: `mailto:${c.email}` }, icon('mail'), c.email));
        if (c.company) box.append(h('p.muted', null, `${t('company')}: ${c.company}`));
      } else box.append(h('p.muted', null, t('contacts_locked')));
      slot.append(box);
    } else if (deal.status === 'pending') {
      const mine = deal.customer_id === me ? deal.customer_confirmed_at : deal.carrier_confirmed_at;
      const box = h('div.card', { style: { padding: '14px' } }, h('p', null, mine ? t('deal_pending_other') : t('deal_pending_you')), h('p.muted.small', { style: { marginTop: '6px' } }, `${t('deal_amount')}: ${deal.amount != null ? fmtMoney(deal.amount) : '—'}`));
      const row = h('div.row', { style: { marginTop: '12px' } });
      if (!mine) row.append(h('button.btn.btn--primary.btn--big', { type: 'button', style: { flex: '1' }, onclick: async () => { try { await api.confirmDeal(deal.id); toast(t('deal_done')); rerender(); } catch (e) { fail(e); } } }, icon('check'), t('deal_confirm')));
      row.append(h('button.btn.btn--danger', { type: 'button', onclick: async () => { if (!(await confirmSheet(t('deal_cancel'), `${p.from_name} → ${p.to_name}`, t('deal_cancel'), true))) return; try { await api.cancelDeal(deal.id); rerender(); } catch (e) { fail(e); } } }, t('deal_cancel')));
      box.append(row);
      slot.append(box);
    }
  }

  if (isOwner) {
    if (['open', 'pending'].includes(p.status)) {
      const active = bids.filter((b) => b.status === 'active' || b.status === 'accepted');
      const sorted = [...active].sort((a, b) => (state.bidSort === 'time' ? (a.created_at < b.created_at ? 1 : -1) : (p.kind === 'truck' ? b.amount - a.amount : a.amount - b.amount)));
      const sortCtl = h('div.seg.seg--sm', { role: 'group', 'aria-label': t('sort_by') },
        h('button', { type: 'button', class: state.bidSort === 'price' ? 'is-on' : '', 'aria-pressed': state.bidSort === 'price' ? 'true' : 'false', onclick: () => { state.bidSort = 'price'; rerender(); } }, t('sort_price')),
        h('button', { type: 'button', class: state.bidSort === 'time' ? 'is-on' : '', 'aria-pressed': state.bidSort === 'time' ? 'true' : 'false', onclick: () => { state.bidSort = 'time'; rerender(); } }, t('sort_time')));
      const section = h('div.section', null, h('div.section__title', null, h('h2', null, `${t('owner_bids')}${active.length ? ` · ${active.length}` : ''}`), active.length > 1 ? sortCtl : null));
      if (!active.length) section.append(h('p.lead', null, t('owner_no_bids')));
      const list = h('div.bids');
      // "Agree" closes the deal at once and opens contacts; "Let me think" only moves the offer to the end
      // of the list on this device — the carrier is not told, the offer stays valid.
      const later = new Set(store.get('pacelam.later', []));
      const ordered = [...sorted.filter((b) => !later.has(b.id)), ...sorted.filter((b) => later.has(b.id))];
      ordered.forEach((b, i) => {
        const isLater = later.has(b.id);
        const agree = async () => {
          if (!(await confirmSheet(`${t('agree')} · ${fmtMoney(b.amount)}`, t('agree_confirm', { p: fmtInt(b.amount), name: b.bidder?.display_name || '' }), t('agree')))) return;
          try { await api.acceptBid(b.id); toast(p.kind === 'cargo' || p.mode === 'urgent' ? t('deal_done') : t('deal_pending_other')); rerender(); } catch (e) { fail(e); }
        };
        const think = () => { later.add(b.id); store.set('pacelam.later', [...later].slice(-200)); toast(t('think_ok')); rerender(); };
        list.append(h('div.card.bidrow', { class: [i === 0 && state.bidSort === 'price' && !isLater && b.status === 'active' && sorted.length > 1 ? 'is-best' : '', isLater ? 'is-later' : ''].join(' ').trim() },
          h('div.bidrow__who', null, h('b', null, b.bidder?.display_name || '—'), h('small', null, [isLater ? t('later_tag') : null, b.bidder?.city_name, relTime(b.created_at), b.note].filter(Boolean).join(' · '))),
          h('div.bidrow__amt', null, fmtMoney(b.amount)),
          b.status === 'active' && p.status === 'open'
            ? h('div.bidrow__actions', null,
              h('button.btn.btn--primary', { type: 'button', onclick: agree }, icon('check'), t('agree')),
              isLater ? null : h('button.btn.btn--ghost', { type: 'button', onclick: think }, t('think')))
            : h('span.tag.tag--planned', null, t(b.status))));
      });
      section.append(list);
      slot.append(section);
    }
    if (['open', 'pending'].includes(p.status)) {
      el.append(h('div.row.row--end', { style: { marginTop: '8px' } }, h('button.btn.btn--danger', { type: 'button', onclick: async () => { if (!(await confirmSheet(t('close_posting'), t('close_confirm'), t('close_posting'), true))) return; try { await api.closePosting(p.id); toast(t('closed_ok')); rerender(); } catch (e) { fail(e); } } }, t('close_posting'))));
    }
  }

  if (!isOwner && me) {
    const myBid = bids.find((b) => b.bidder_id === me && ['active', 'accepted'].includes(b.status));
    if (myBid) {
      el.append(h('div.card.status-line', null, h('span', null, `${t('your_bid')}: `), h('b', null, fmtMoney(myBid.amount)), myBid.status === 'accepted' ? h('span.tag.tag--planned', null, t('accepted')) : null,
        myBid.status === 'active' ? h('button.btn.btn--ghost.btn--sm', { type: 'button', style: { marginLeft: 'auto' }, onclick: async () => { try { await api.withdrawBid(myBid.id); rerender(); } catch (e) { fail(e); } } }, t('bid_withdraw')) : null));
    }
    const actions = actionButtons(p, { big: !inline, myBid });
    if (actions) { actions.classList.remove('pcard__actions'); el.append(h('div.actionbar', null, ...[...actions.childNodes].map((b, i) => { b.classList.add('btn--wide'); if (i > 0) b.classList.remove('btn--big'); return b; }))); }
    if (p.status === 'open' && !deal) el.append(h('p.muted.small', null, t('contacts_locked')));
  }
  if (!me && p.status === 'open') el.append(h('div.actionbar', null, h('a.btn.btn--primary.btn--big', { href: '#/auth' }, t('sign_in')), h('p.muted.small', { style: { textAlign: 'center' } }, t('feed_visitors_cta'))));
  if (!slot.childNodes.length) slot.remove();
  return el;
}
async function screenDetail(id) {
  return h('section.screen.narrow', null, await buildDetail(id));
}

// ---------------------------------------------------------------------------------------
// Posting forms
// ---------------------------------------------------------------------------------------
async function screenPost(param) {
  // #/post — the two doors; #/post/cargo, #/post/truck — the posting itself
  if (param !== 'cargo' && param !== 'truck') return h('section.screen.narrow', null, offerBlock({ page: true }));
  state.postKind = param;
  if (!requireAuth()) return h('div');
  const me = state.me;
  const kind = state.postKind || (me.profile.role === 'carrier' ? 'truck' : 'cargo');
  const el = h('section.screen.narrow');
  el.append(h('div.row.row--between', { style: { marginBottom: '12px' } }, h('h1', null, t('post_title')), me.profile.is_operator ? h('a.btn.btn--ghost.btn--sm', { href: '#/operator' }, icon('bolt'), t('operator_title')) : null));
  el.append(h('div.seg', { role: 'tablist' },
    h('button', { type: 'button', role: 'tab', 'aria-selected': kind === 'cargo' ? 'true' : 'false', class: kind === 'cargo' ? 'is-on' : '', onclick: () => { state.postKind = 'cargo'; render(); } }, t('kind_cargo_long')),
    h('button', { type: 'button', role: 'tab', 'aria-selected': kind === 'truck' ? 'true' : 'false', class: kind === 'truck' ? 'is-on' : '', onclick: () => { state.postKind = 'truck'; render(); } }, t('kind_truck_long'))));
  el.append(kind === 'truck' ? truckForm() : cargoForm());
  return el;
}
function dateChips(draft, allowRange) {
  const from = h('input.input', { type: 'date', value: draft.date_from, min: isoDate(), 'aria-label': t('date'), onchange: () => { draft.date_from = from.value; if (!draft.date_to || draft.date_to < from.value) { draft.date_to = from.value; to.value = from.value; } } });
  const to = h('input.input', { type: 'date', value: draft.date_to, min: isoDate(), 'aria-label': t('date_to'), onchange: () => { draft.date_to = to.value; } });
  const quick = chips([{ value: isoDate(), label: t('today') }, { value: addDays(1), label: t('tomorrow') }, { value: addDays(2), label: fmtDate(addDays(2)) }], {
    value: draft.date_from, name: t('when'), onChange: (v) => { draft.date_from = v; from.value = v; if (!allowRange || draft.date_to < v) { draft.date_to = v; to.value = v; } },
  });
  return h('div.form__section', null, h('div.form__title', null, t('when')), quick, allowRange ? h('div.grid2', null, field(t('date'), from), field(t('date_to'), to)) : field(t('date'), from));
}
function photoPicker(draft) {
  const grid = h('div.photo-grid');
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, 'aria-hidden': 'true', tabindex: -1 });
  const paint = () => {
    clear(grid);
    draft.photos.forEach((ph, i) => grid.append(h('div.ph', null, h('img', { src: ph.thumbUrl, alt: '' }), h('button', { type: 'button', 'aria-label': t('photo_remove'), onclick: () => { draft.photos.splice(i, 1); paint(); } }, icon('x')))));
    if (draft.photos.length < 4) grid.append(h('button.photo-add', { type: 'button', onclick: () => fileInput.click() }, icon('photo'), t('photo_add')));
  };
  fileInput.addEventListener('change', async () => {
    for (const file of [...fileInput.files].slice(0, 4 - draft.photos.length)) {
      try { const c = await compressPhoto(file); draft.photos.push({ full: c.full, thumb: c.thumb, thumbUrl: URL.createObjectURL(c.thumb) }); } catch (e) { fail(e); }
    }
    fileInput.value = '';
    paint();
  });
  paint();
  return h('div.form__section', null, h('div.form__title', null, t('photos')), grid, fileInput, h('p.field__hint', null, t('photos_hint')));
}
async function uploadPhotos(draft, postingId) {
  const paths = [];
  for (let i = 0; i < draft.photos.length; i++) {
    const ph = draft.photos[i];
    if (api.mode === 'demo') { paths.push(await api.uploadPhoto(ph.thumb)); continue; }
    const base = `${myId()}/${postingId}/${i + 1}`;
    await api.uploadPhoto(ph.full, `${base}.jpg`);
    await api.uploadPhoto(ph.thumb, `${base}_t.jpg`);
    paths.push(`${base}.jpg`);
  }
  return paths;
}
function dimsFields(draft) {
  const mk = (key, label, ph) => field(label, input({ inputmode: 'decimal', value: draft[key] ?? '', placeholder: ph, class: 'input--num', oninput: (e) => { draft[key] = e.target.value; } }));
  return h('div.form__section', null,
    h('div.grid2', null, mk('weight_kg', `${t('weight')}, ${t('kg')}`, '1200'), mk('volume_m3', `${t('volume')}, ${t('m3')}`, '4')),
    h('div.grid3', null, mk('length_m', `L, ${t('m')}`, '2.4'), mk('width_m', `W, ${t('m')}`, '1.2'), mk('height_m', `H, ${t('m')}`, '1.6')));
}
function afterPost(p) {
  store.set('pacelam.lastRoute', { from: { name: p.from_name, lat: p.from_lat, lng: p.from_lng, radius: p.from_radius_km }, to: { name: p.to_name, lat: p.to_lat, lng: p.to_lng, radius: p.to_radius_km } });
  if (p.kind === 'truck') { state.route = { from: { name: p.from_name, lat: p.from_lat, lng: p.from_lng }, to: { name: p.to_name, lat: p.to_lat, lng: p.to_lng }, maxDetour: state.route?.maxDetour || state.me?.profile?.max_detour_km || 60 }; store.set('pacelam.route', state.route); }
  toast(t('posted_ok'));
  go(`#/p/${p.id}`);
}
function vehicleChips(vehicles, draft) {
  return chips(vehicles.map((v) => ({ value: v.id, label: `${v.type_code} ${nameOf(vtype(v.type_code)) || ''}${v.plate ? ' · ' + v.plate : ''}` })), {
    value: draft.vehicle?.id, name: t('my_vehicle'), onChange: (id) => { const v = vehicles.find((x) => x.id === id); draft.vehicle = v; if (v?.tonnage_t != null) draft.weight_kg = Math.round(v.tonnage_t * 1000); if (v?.volume_m3 != null) draft.volume_m3 = v.volume_m3; },
  });
}
function truckForm() {
  const me = state.me;
  const last = store.get('pacelam.lastRoute');
  const vehicles = me.vehicles || [];
  const def = vehicles.find((v) => v.is_default) || vehicles[0] || null;
  const draft = { vehicle: def, from: last?.from || (myCity() ? { ...myCity(), radius: 0 } : null), to: last?.to || null, date_from: addDays(1), date_to: addDays(1), weight_kg: def?.tonnage_t != null ? Math.round(def.tonnage_t * 1000) : '', volume_m3: def?.volume_m3 ?? '', length_m: def?.length_m ?? '', width_m: def?.width_m ?? '', height_m: def?.height_m ?? '', price: '', note: '' };
  const form = h('form.form', { novalidate: true });
  if (!vehicles.length) form.append(h('div.card', { style: { padding: '14px' } }, h('p', null, t('add_vehicle_first')), h('a.btn.btn--primary', { href: '#/me', style: { marginTop: '10px' } }, t('add_vehicle'))));
  else form.append(h('div.form__section', null, h('div.form__title', null, t('my_vehicle')), vehicleChips(vehicles, draft)));
  const fromBtn = placeButton('from', () => draft.from, (p) => { draft.from = p; }, true);
  const toBtn = placeButton('to', () => draft.to, (p) => { draft.to = p; }, true);
  form.append(h('div.form__section', null, h('div.form__title', null, t('feed_route')), fromBtn, toBtn));
  form.append(dateChips(draft, false));
  form.append(h('div.form__title', null, t('capacity')), dimsFields(draft));
  form.append(field(t('price_truck_label'), input({ inputmode: 'decimal', class: 'input--num', oninput: (e) => { draft.price = e.target.value; } })));
  form.append(field(t('note'), h('textarea.textarea', { placeholder: t('note_ph'), maxlength: 600, oninput: (e) => { draft.note = e.target.value; } })));
  const submit = h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('submit_post'));
  form.append(h('div.submitbar', null, submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!draft.vehicle) { toast(t('validation_vehicle'), 'error'); return; }
    if (!draft.from || !draft.to) { toast(t('validation_route'), 'error'); return; }
    if (!draft.date_from) { toast(t('validation_date'), 'error'); return; }
    submit.disabled = true;
    try {
      const id = uuid();
      const p = await api.createPosting({ id, kind: 'truck', mode: 'planned', from_name: draft.from.name, from_lat: draft.from.lat, from_lng: draft.from.lng, from_radius_km: draft.from.radius || 0, to_name: draft.to.name, to_lat: draft.to.lat, to_lng: draft.to.lng, to_radius_km: draft.to.radius || 0, date_from: draft.date_from, date_to: draft.date_to || draft.date_from, vehicle_type_code: draft.vehicle.type_code, vehicle_id: draft.vehicle.id, weight_kg: num(draft.weight_kg), volume_m3: num(draft.volume_m3), length_m: num(draft.length_m), width_m: num(draft.width_m), height_m: num(draft.height_m), price: num(draft.price), note: draft.note.trim() || null });
      afterPost(p);
    } catch (err) { fail(err); submit.disabled = false; }
  });
  return form;
}
function cargoFieldsBlock(draft, mode = 'chips') {
  const dyn = h('div.stack.stack--tight');
  const paint = () => {
    clear(dyn);
    const ct = ctype(draft.cargo_type_id);
    for (const f of (ct?.fields || [])) {
      if (mode === 'select' && (f.type === 'bool' || f.type === 'choice')) {
        const sel = h('select.select', { onchange: (e) => { const v = e.target.value; draft.fields[f.key] = v === '' ? undefined : (f.type === 'bool' ? v === '1' : v); } }, h('option', { value: '' }, '—'));
        if (f.type === 'bool') sel.append(h('option', { value: '1' }, t('field_yes')), h('option', { value: '0' }, t('field_no')));
        else for (const o of (f.options || [])) sel.append(h('option', { value: o.value }, labelOf(o)));
        dyn.append(field(labelOf(f), sel));
      } else if (f.type === 'bool') dyn.append(field(labelOf(f), chips([{ value: true, label: t('field_yes') }, { value: false, label: t('field_no') }], { value: draft.fields[f.key], name: labelOf(f), onChange: (v) => { draft.fields[f.key] = v; } })));
      else if (f.type === 'choice') dyn.append(field(labelOf(f), chips((f.options || []).map((o) => ({ value: o.value, label: labelOf(o) })), { value: draft.fields[f.key], name: labelOf(f), onChange: (v) => { draft.fields[f.key] = v; } })));
      else if (f.type === 'number') dyn.append(field(labelOf(f), input({ inputmode: 'numeric', class: 'input--num', value: draft.fields[f.key] ?? '', oninput: (e) => { draft.fields[f.key] = num(e.target.value); } })));
      else dyn.append(field(labelOf(f), input({ maxlength: f.maxlength || 80, value: draft.fields[f.key] ?? '', oninput: (e) => { draft.fields[f.key] = e.target.value; } })));
    }
  };
  paint();
  dyn.repaint = paint;
  return dyn;
}
function vehicleSelect(draft, key = 'vehicle_type_code') {
  const sel = h('select.select', { 'aria-label': t('vehicle_needed'), onchange: (e) => { draft[key] = e.target.value || null; } }, h('option', { value: '' }, t('any_vehicle')));
  for (const g of state.ref.groups) {
    const types = state.ref.vehicleTypes.filter((v) => v.group_id === g.id);
    if (!types.length) continue;
    const og = h('optgroup', { label: nameOf(g) });
    for (const v of types) og.append(h('option', { value: v.code, selected: draft[key] === v.code }, `${v.code} · ${nameOf(v)}`));
    sel.append(og);
  }
  return sel;
}
function cargoPayload(draft, id, photos) {
  return { id, kind: 'cargo', mode: draft.mode, from_name: draft.from.name, from_lat: draft.from.lat, from_lng: draft.from.lng, from_radius_km: draft.from.radius || 0, to_name: draft.to.name, to_lat: draft.to.lat, to_lng: draft.to.lng, to_radius_km: draft.to.radius || 0, date_from: draft.date_from, date_to: draft.mode === 'urgent' ? draft.date_from : (draft.date_to || draft.date_from), vehicle_type_code: draft.vehicle_type_code, cargo_type_id: draft.cargo_type_id, cargo_fields: Object.fromEntries(Object.entries(draft.fields).filter(([, v]) => v !== undefined)), weight_kg: num(draft.weight_kg) != null ? Math.round(num(draft.weight_kg)) : null, volume_m3: num(draft.volume_m3), length_m: num(draft.length_m), width_m: num(draft.width_m), height_m: num(draft.height_m), photos, price: num(draft.price), note: draft.note.trim() || null, is_operator_posting: !!draft.operator };
}
function cargoForm() {
  const me = state.me;
  const last = store.get('pacelam.lastRoute');
  const pre = store.get('pacelam.prefill');   // "offer my cargo" on a truck card
  if (pre) store.set('pacelam.prefill', null);
  const draft = { mode: 'planned', from: pre?.from || last?.from || (myCity() ? { ...myCity(), radius: 0 } : null), to: pre?.to || last?.to || null, date_from: pre?.date_from || isoDate(), date_to: pre?.date_to || pre?.date_from || isoDate(), cargo_type_id: state.ref.cargoTypes[0]?.id || null, fields: {}, vehicle_type_code: null, weight_kg: '', volume_m3: '', length_m: '', width_m: '', height_m: '', photos: [], price: '', note: '', operator: false };
  const form = h('form.form', { novalidate: true });
  const fromBtn = placeButton('from', () => draft.from, (p) => { draft.from = p; }, true);
  const toBtn = placeButton('to', () => draft.to, (p) => { draft.to = p; }, true);
  form.append(h('div.form__section', null, h('div.form__title', null, t('feed_route')), fromBtn, toBtn));
  const modeHint = h('p.field__hint', null, t('mode_planned_hint'));
  const priceLabel = h('label.field__label', { for: 'price' }, t('price_instant_label'));
  const priceInput = input({ id: 'price', inputmode: 'decimal', class: 'input--num', oninput: (e) => { draft.price = e.target.value; } });
  let dateWrap = dateChips(draft, true);
  const modeChips = chips([{ value: 'urgent', label: t('mode_urgent') }, { value: 'planned', label: t('mode_planned') }], { value: draft.mode, name: t('mode'), onChange: (v) => { draft.mode = v; modeHint.textContent = v === 'urgent' ? t('mode_urgent_hint') : t('mode_planned_hint'); priceLabel.textContent = v === 'urgent' ? t('price_urgent_label') : t('price_instant_label'); if (v === 'urgent') { draft.date_from = isoDate(); draft.date_to = isoDate(); } const next = dateChips(draft, v === 'planned'); dateWrap.replaceWith(next); dateWrap = next; } });
  modeChips.querySelectorAll('.chip').forEach((c, i) => c.classList.add(i === 0 ? 'chip--urgent' : 'chip--planned'));
  if (URGENT_CHOICE) form.append(h('div.form__section', null, h('div.form__title', null, t('mode')), modeChips, modeHint));
  form.append(dateWrap);
  const dyn = cargoFieldsBlock(draft);
  const ctChips = chips(state.ref.cargoTypes.map((c) => ({ value: c.id, label: nameOf(c) })), { value: draft.cargo_type_id, name: t('cargo_type'), onChange: (v) => { draft.cargo_type_id = v; draft.fields = {}; dyn.repaint(); } });
  form.append(h('div.form__section', null, h('div.form__title', null, t('cargo_type')), ctChips, state.ref.cargoTypes.some((c) => c.is_provisional) ? h('p.field__hint', null, t('provisional')) : null, dyn));
  form.append(h('div.form__title', null, `${t('weight')} · ${t('dims')} · ${t('volume')}`), dimsFields(draft));
  form.append(field(t('vehicle_needed'), vehicleSelect(draft)));
  form.append(photoPicker(draft));
  form.append(CUSTOMER_PRICE ? h('div.field', null, priceLabel, priceInput) : h('p.card.price-note', null, icon('bolt'), h('span', null, t('cargo_price_hint'))));
  form.append(field(t('note'), h('textarea.textarea', { placeholder: t('note_ph'), maxlength: 600, oninput: (e) => { draft.note = e.target.value; } })));
  if (me.profile.is_operator) form.append(h('label.check', null, h('input', { type: 'checkbox', onchange: (e) => { draft.operator = e.target.checked; } }), h('span', null, `${t('operator')} — ${t('operator_hint')}`)));
  const submit = h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('submit_post'));
  form.append(h('div.submitbar', null, submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!draft.from || !draft.to) { toast(t('validation_route'), 'error'); return; }
    if (!draft.date_from) { toast(t('validation_date'), 'error'); return; }
    submit.disabled = true;
    try {
      const id = uuid();
      const photos = await uploadPhotos(draft, id);
      const p = await api.createPosting(cargoPayload(draft, id, photos));
      afterPost(p);
    } catch (err) { fail(err); submit.disabled = false; }
  });
  return form;
}

// Operator: post on behalf of a caller, keyboard only, form stays ready for the next call.
async function screenOperator() {
  if (!requireAuth()) return h('div');
  if (!state.me.profile.is_operator) { go('#/post'); return h('div'); }
  const el = h('section.screen.narrow');
  el.append(h('h1', null, t('operator_title')), h('p.lead', { style: { margin: '6px 0 16px' } }, t('operator_lead')));
  const draft = { mode: 'urgent', date_from: isoDate(), date_to: isoDate(), cargo_type_id: state.ref.cargoTypes.find((c) => c.id === 'vehicle')?.id || state.ref.cargoTypes[0]?.id || null, fields: {}, vehicle_type_code: null, weight_kg: '', volume_m3: '', length_m: '', width_m: '', height_m: '', photos: [], price: '', note: '', operator: true, from: null, to: null };
  const form = h('form.form.form--operator', { novalidate: true });
  const fromF = cityField('from');
  const toF = cityField('to');
  const fromIn = fromF.querySelector('input');
  const toIn = toF.querySelector('input');
  const dateIn = h('select.select', { onchange: (e) => { draft.date_from = e.target.value; draft.date_to = e.target.value; } }, Array.from({ length: 8 }, (_, i) => h('option', { value: addDays(i) }, i === 0 ? t('today') : i === 1 ? t('tomorrow') : fmtDate(addDays(i)))));
  const modeSel = h('select.select', { onchange: (e) => { draft.mode = e.target.value; } }, h('option', { value: 'urgent' }, t('mode_urgent')), h('option', { value: 'planned' }, t('mode_planned')));
  const dyn = cargoFieldsBlock(draft, 'select');
  const catSel = h('select.select', { onchange: (e) => { draft.cargo_type_id = e.target.value; draft.fields = {}; dyn.repaint(); } });
  for (const c of state.ref.cargoTypes) catSel.append(h('option', { value: c.id, selected: c.id === draft.cargo_type_id }, nameOf(c)));
  const mk = (key, label, ph, mode = 'decimal') => field(label, input({ inputmode: mode, placeholder: ph, class: 'input--num', oninput: (e) => { draft[key] = e.target.value; } }));
  const noteIn = h('textarea.textarea', { placeholder: t('note_ph'), maxlength: 600, rows: 3, oninput: (e) => { draft.note = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } } });
  const submit = h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('submit_post'));
  form.append(
    h('div.grid2', null, fromF, toF),
    h('div.grid3', null, field(t('date'), dateIn), field(t('mode'), modeSel), field(t('cargo_type'), catSel)),
    dyn,
    h('div.grid2', null, mk('weight_kg', `${t('weight')}, ${t('kg')}`, '1200'), mk('volume_m3', `${t('volume')}, ${t('m3')}`, '4')),
    h('div.grid3', null, mk('length_m', `L, ${t('m')}`, '2.4'), mk('width_m', `W, ${t('m')}`, '1.2'), mk('height_m', `H, ${t('m')}`, '1.6')),
    CUSTOMER_PRICE ? h('div.grid2', null, field(t('vehicle_needed'), vehicleSelect(draft)), mk('price', t('price_urgent_label'), '120')) : field(t('vehicle_needed'), vehicleSelect(draft)),
    field(t('note'), noteIn, t('operator_privacy')),
    submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const from = fromIn.resolve(); const to = toIn.resolve();
    if (!from) { toast(t('city_unknown'), 'error'); fromIn.focus(); return; }
    if (!to) { toast(t('city_unknown'), 'error'); toIn.focus(); return; }
    draft.from = { name: from.name, lat: from.lat, lng: from.lng, radius: 0 };
    draft.to = { name: to.name, lat: to.lat, lng: to.lng, radius: 0 };
    if (!draft.date_from) { toast(t('validation_date'), 'error'); dateIn.focus(); return; }
    submit.disabled = true;
    try {
      await api.createPosting(cargoPayload(draft, uuid(), []));
      toast(t('operator_posted'));
      form.querySelectorAll('input, textarea').forEach((i) => { i.value = ''; });
      for (const k of ['weight_kg', 'volume_m3', 'length_m', 'width_m', 'height_m', 'price', 'note']) draft[k] = '';
      draft.fields = {}; dyn.repaint(); draft.vehicle_type_code = null;
      form.querySelectorAll('select').forEach((s) => { if (s !== modeSel && s !== catSel && s !== dateIn) s.selectedIndex = 0; });
      submit.disabled = false;
      fromIn.focus();
    } catch (err) { fail(err); submit.disabled = false; }
  });
  el.append(form);
  setTimeout(() => fromIn.focus({ preventScroll: true }), 50);
  return el;
}

// ---------------------------------------------------------------------------------------
// My, searches, profile, auth, onboarding, inbox
// ---------------------------------------------------------------------------------------
async function screenMy() {
  if (!requireAuth()) return h('div');
  const el = h('section.screen.narrow');
  el.append(h('h1', { style: { marginBottom: '12px' } }, t('my_title')));
  const tabs = h('div.tabs', { role: 'tablist' });
  for (const [k, label] of [['postings', t('my_postings')], ['bids', t('my_bids')], ['deals', t('my_deals')]]) {
    tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': state.myTab === k ? 'true' : 'false', class: state.myTab === k ? 'is-on' : '', onclick: () => { state.myTab = k; render(); } }, label));
  }
  el.append(tabs);
  const cards = h('div.cards');
  if (state.myTab === 'postings') {
    const list = (await api.myPostings()) || [];
    if (!list.length) cards.append(emptyState(t('my_empty')));
    for (const p of list) cards.append(postingCard(p, { noActions: true }));
  } else if (state.myTab === 'bids') {
    const list = (await api.myBids()) || [];
    if (!list.length) cards.append(emptyState(t('my_empty')));
    for (const b of list) {
      if (!b.posting) continue;
      const card = postingCard(b.posting, { noActions: true });
      card.append(h('div.status-line', null, h('span.muted', null, `${t('your_bid')}: `), h('b', null, fmtMoney(b.amount)), h('span.tag', { class: b.status === 'accepted' ? 'tag--planned' : 'tag--status' }, t(b.status === 'active' ? 'status_open' : b.status))));
      cards.append(card);
    }
  } else {
    const list = (await api.myDeals()) || [];
    if (!list.length) cards.append(emptyState(t('my_empty')));
    for (const d of list) {
      if (!d.posting) continue;
      const card = postingCard(d.posting, { noActions: true });
      card.append(h('div.status-line', null, h('span.muted', null, `${t('deal_amount')}: `), h('b', null, d.amount != null ? fmtMoney(d.amount) : '—'), h('span.tag', { class: d.status === 'confirmed' ? 'tag--planned' : 'tag--status' }, d.status === 'confirmed' ? t('status_deal') : t(d.status === 'pending' ? 'status_pending' : 'status_cancelled'))));
      cards.append(card);
    }
  }
  el.append(cards);
  return el;
}

async function screenSearch() {
  if (!requireAuth()) return h('div');
  const searches = (await api.listSearches()) || [];
  const el = h('section.screen.stack.narrow');
  el.append(h('div', null, h('h1', null, t('search_title')), h('p.lead', { style: { marginTop: '6px' } }, t('search_hint'))));
  if ('Notification' in window) {
    if (Notification.permission === 'granted') el.append(h('p.small.muted', null, `✓ ${t('notify_allowed')}`));
    else if (Notification.permission === 'denied') el.append(h('p.small.muted', null, t('notify_denied')));
    else el.append(h('button.btn.btn--ghost.btn--wide', { type: 'button', onclick: async () => { await Notification.requestPermission(); render(); } }, icon('bell'), t('notify_allow')));
  }
  el.append(h('button.btn.btn--primary.btn--big.btn--wide', { type: 'button', onclick: searchSheet }, icon('plus'), t('search_new')));
  const list = h('div.list');
  if (!searches.length) list.append(emptyState(t('search_empty')));
  for (const s of searches) {
    const parts = [s.kind === 'cargo' ? t('kind_cargo') : t('kind_truck'), `${s.center_name} ${t('km_plus', { km: s.radius_km })}`];
    if (s.dest_name) parts.push(`→ ${s.dest_name}${s.dest_radius_km ? ' ' + t('km_plus', { km: s.dest_radius_km }) : ''}`);
    if (s.vehicle_type_codes?.length) parts.push(s.vehicle_type_codes.join(', '));
    if (s.cargo_type_ids?.length) parts.push(s.cargo_type_ids.map((id) => nameOf(ctype(id))).join(', '));
    list.append(h('div.card.vehicle-row', null,
      h('div.vehicle-row__main', null, h('b', null, parts.slice(0, 2).join(' · ')), h('small', null, parts.slice(2).join(' · ') || (s.modes || []).map((m) => t('mode_' + m)).join(', '))),
      h('button.btn.btn--ghost.btn--sm', { type: 'button', 'aria-label': t('search_delete'), onclick: async () => { try { await api.deleteSearch(s.id); render(); } catch (e) { fail(e); } } }, icon('x'))));
  }
  el.append(list);
  return el;
}
function searchSheet() {
  const draft = { kind: state.me.profile.role === 'carrier' ? 'cargo' : 'truck', center: myCity() ? { ...myCity(), radius: 50 } : null, dest: null, vehicleTypes: (state.me.vehicles || []).map((v) => v.type_code).filter((v, i, a) => a.indexOf(v) === i), cargoTypes: [], modes: ['urgent', 'planned'], browser: true, email: false };
  const kindSeg = chips([{ value: 'cargo', label: t('kind_cargo') }, { value: 'truck', label: t('kind_truck') }], { value: draft.kind, name: t('search_kind'), onChange: (v) => { draft.kind = v; } });
  const centerBtn = placeButton('search_center', () => draft.center, (p) => { draft.center = p; }, true);
  const destBtn = placeButton('search_dest', () => draft.dest, (p) => { draft.dest = p; }, true);
  const vt = chips(state.ref.vehicleTypes.map((v) => ({ value: v.code, label: `${v.code} ${nameOf(v)}` })), { value: draft.vehicleTypes, multi: true, name: t('search_vehicles'), onChange: (v) => { draft.vehicleTypes = v; } });
  const ct = chips(state.ref.cargoTypes.map((c) => ({ value: c.id, label: nameOf(c) })), { value: draft.cargoTypes, multi: true, name: t('search_cargo'), onChange: (v) => { draft.cargoTypes = v; } });
  const modes = chips([{ value: 'urgent', label: t('mode_urgent') }, { value: 'planned', label: t('mode_planned') }], { value: draft.modes, multi: true, name: t('search_modes'), onChange: (v) => { draft.modes = v; } });
  const s = sheet({
    title: t('search_new'),
    body: h('form.form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!draft.center) { toast(t('validation_route'), 'error'); return; }
        try {
          await api.saveSearch({ kind: draft.kind, center_name: draft.center.name, center_lat: draft.center.lat, center_lng: draft.center.lng, radius_km: draft.center.radius || 0, dest_name: draft.dest?.name || null, dest_lat: draft.dest?.lat ?? null, dest_lng: draft.dest?.lng ?? null, dest_radius_km: draft.dest ? (draft.dest.radius || 0) : null, vehicle_type_codes: draft.vehicleTypes, cargo_type_ids: draft.cargoTypes, modes: draft.modes.length ? draft.modes : ['urgent', 'planned'], notify_browser: draft.browser, notify_email: draft.email });
          s.close(); toast(t('search_saved')); render();
        } catch (err) { fail(err); }
      },
    },
    field(t('search_kind'), kindSeg), centerBtn, destBtn, field(t('search_vehicles'), vt), field(t('search_cargo'), ct), field(t('search_modes'), modes),
    h('label.check', null, h('input', { type: 'checkbox', checked: true, onchange: (e) => { draft.browser = e.target.checked; } }), h('span', null, t('notify_browser'))),
    h('label.check', null, h('input', { type: 'checkbox', onchange: (e) => { draft.email = e.target.checked; } }), h('span', null, t('notify_email'))),
    h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('search_save'))),
  });
}

async function screenProfile() {
  if (!state.session) { state.after = '#/me'; go('#/auth'); return h('div'); }
  if (!state.me?.profile) { go('#/onboarding'); return h('div'); }
  const me = state.me;
  const el = h('section.screen.stack.narrow');
  el.append(h('h1', null, t('profile_title')));
  const draft = { role: me.profile.role, display_name: me.profile.display_name, city: myCity(), max_detour_km: me.profile.max_detour_km || 60, phone: me.contacts?.phone || '', email: me.contacts?.email || state.session.user?.email || '', company: me.contacts?.company || '' };
  const form = h('form.form.card', { style: { padding: '16px' }, novalidate: true });
  form.append(field(t('role'), chips([{ value: 'carrier', label: t('role_carrier') }, { value: 'customer', label: t('role_customer') }], { value: draft.role, name: t('role'), onChange: (v) => { draft.role = v; } })));
  form.append(field(t('name'), input({ value: draft.display_name, maxlength: 80, autocomplete: 'name', oninput: (e) => { draft.display_name = e.target.value; } })));
  form.append(placeButton('city', () => draft.city, (p) => { draft.city = p; }));
  form.append(field(t('phone'), input({ type: 'tel', inputmode: 'tel', value: draft.phone, autocomplete: 'tel', placeholder: '+371 20000000', oninput: (e) => { draft.phone = e.target.value; } }), t('phone_hint')));
  form.append(field(t('email'), input({ type: 'email', inputmode: 'email', value: draft.email, autocomplete: 'email', oninput: (e) => { draft.email = e.target.value; } })));
  form.append(field(t('company'), input({ value: draft.company, maxlength: 120, autocomplete: 'organization', oninput: (e) => { draft.company = e.target.value; } })));
  const dl = h('span', null, `${t('max_detour')} ${draft.max_detour_km} km`);
  form.append(h('div.field', null, h('div.field__label', null, dl), h('input.range', { type: 'range', min: 10, max: 300, step: 10, value: draft.max_detour_km, 'aria-label': t('max_detour'), oninput: (e) => { draft.max_detour_km = Number(e.target.value); dl.textContent = `${t('max_detour')} ${draft.max_detour_km} km`; } })));
  form.append(h('label.check', null, h('input', { type: 'checkbox', checked: document.documentElement.dataset.theme === 'light', onchange: (e) => applyTheme(e.target.checked ? 'light' : 'dark') }), h('span', null, t('theme'))));
  form.append(h('button.btn.btn--primary.btn--wide', { type: 'submit' }, t('save')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const profile = await api.saveProfile({ role: draft.role, display_name: draft.display_name.trim() || me.profile.display_name, city_name: draft.city?.name || null, city_lat: draft.city?.lat ?? null, city_lng: draft.city?.lng ?? null, max_detour_km: draft.max_detour_km, lang: getLang() });
      const contacts = draft.phone.trim() ? await api.saveContacts({ phone: draft.phone.trim(), email: draft.email.trim() || null, company: draft.company.trim() || null }) : me.contacts;
      state.me = { ...me, profile, contacts };
      toast(t('saved'));
    } catch (err) { fail(err); }
  });
  el.append(form);
  const vs = h('div.section', null, h('div.section__title', null, h('h2', null, t('vehicles')), h('button.btn.btn--primary.btn--sm', { type: 'button', onclick: () => vehicleSheet() }, icon('plus'), t('add_vehicle'))));
  const list = h('div.list');
  for (const v of me.vehicles || []) {
    const ty = vtype(v.type_code);
    list.append(h('div.card.vehicle-row', null,
      h('div.vehicle-row__main', null, h('b', null, `${v.type_code} ${ty ? nameOf(ty) : ''}`), h('small', null, [v.plate, v.tonnage_t != null ? `${fmtNum(v.tonnage_t, 1)} ${t('t')}` : null, v.volume_m3 != null ? `${fmtNum(v.volume_m3, 0)} ${t('m3')}` : null, v.is_default ? t('default_vehicle') : null].filter(Boolean).join(' · '))),
      !v.is_default ? h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: async () => { try { await api.setDefaultVehicle(v.id); await loadMe(); render(); } catch (e) { fail(e); } } }, t('default_vehicle')) : null,
      h('button.btn.btn--ghost.btn--sm', { type: 'button', 'aria-label': t('delete'), onclick: async () => { if (!(await confirmSheet(t('delete'), `${v.type_code} ${v.plate || ''}`, t('delete'), true))) return; try { await api.deleteVehicle(v.id); await loadMe(); render(); } catch (e) { fail(e); } } }, icon('x'))));
  }
  if (!(me.vehicles || []).length) list.append(h('p.lead', null, me.profile.role === 'carrier' ? t('add_vehicle_first') : ''));
  vs.append(list);
  el.append(vs);
  const foot = h('div.row', { style: { marginTop: '10px' } }, h('button.btn.btn--ghost', { type: 'button', onclick: async () => { await api.signOut(); state.me = null; go('#/'); } }, t('sign_out')));
  if (api.mode === 'demo') foot.append(h('button.btn.btn--ghost', { type: 'button', onclick: () => { api.resetDemo(); state.me = null; state.route = null; state.selected = null; store.set('pacelam.route', null); store.set('pacelam.lastRoute', null); go('#/'); } }, 'Reset demo'));
  el.append(foot);
  return el;
}
function vehicleSheet() {
  const draft = { type_code: 'VT10', plate: '', tonnage_t: '', volume_m3: '', length_m: '', width_m: '', height_m: '', is_default: !(state.me.vehicles || []).length };
  const sel = h('select.select', { onchange: (e) => { draft.type_code = e.target.value; } });
  for (const g of state.ref.groups) {
    const types = state.ref.vehicleTypes.filter((v) => v.group_id === g.id);
    if (!types.length) continue;
    const og = h('optgroup', { label: nameOf(g) });
    for (const v of types) og.append(h('option', { value: v.code, selected: v.code === draft.type_code }, `${v.code} · ${nameOf(v)}`));
    sel.append(og);
  }
  const mk = (key, label, ph, mode = 'decimal') => field(label, input({ inputmode: mode, placeholder: ph, class: 'input--num', oninput: (e) => { draft[key] = e.target.value; } }));
  const s = sheet({
    title: t('add_vehicle'),
    body: h('form.form', {
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const added = await api.addVehicle({ type_code: draft.type_code, plate: draft.plate.trim() || null, tonnage_t: num(draft.tonnage_t), volume_m3: num(draft.volume_m3), length_m: num(draft.length_m), width_m: num(draft.width_m), height_m: num(draft.height_m), is_default: draft.is_default });
          if (draft.is_default && added?.id && (state.me.vehicles || []).length) await api.setDefaultVehicle(added.id);
          await loadMe(); s.close(); toast(t('saved')); render();
        } catch (err) { fail(err); }
      },
    },
    field(t('vehicle_type'), sel),
    h('div.grid2', null, field(t('plate'), input({ placeholder: 'AB-1234', maxlength: 16, oninput: (e) => { draft.plate = e.target.value; } })), mk('tonnage_t', t('tonnage'), '8')),
    h('div.grid2', null, mk('volume_m3', `${t('volume')}, ${t('m3')}`, '40'), mk('length_m', `L, ${t('m')}`, '7.2')),
    h('div.grid2', null, mk('width_m', `W, ${t('m')}`, '2.45'), mk('height_m', `H, ${t('m')}`, '2.4')),
    h('label.check', null, h('input', { type: 'checkbox', checked: draft.is_default, onchange: (e) => { draft.is_default = e.target.checked; } }), h('span', null, t('default_vehicle'))),
    h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('save'))),
  });
}

async function screenAuth() {
  if (state.session) { go(state.me?.profile ? (state.after || '#/') : '#/onboarding'); return h('div'); }
  const el = h('section.screen.auth');
  el.append(h('div.auth__hero', null, h('h1', null, t('auth_title')), h('p.lead', null, t('auth_lead'))));
  if (api.mode === 'demo') {
    el.append(h('p.field__label', null, t('demo_login')));
    el.append(h('div.stack.stack--tight', null, api.demoUsers.map((u) => h('button.btn.btn--big.btn--wide', { type: 'button', class: u.key === 'demo_operator' ? 'btn--ghost' : 'btn--primary', onclick: async () => { await api.signInDemo(u.id); await loadMe(); go(state.after || '#/'); state.after = null; } }, t(u.key)))));
    el.append(h('p.lead.demo-hint', null, t('demo_banner')));
    return el;
  }
  let mode = state.roleHint ? 'up' : 'in';
  const email = input({ type: 'email', inputmode: 'email', autocomplete: 'email', required: true });
  const pass = input({ type: 'password', autocomplete: 'current-password', minlength: 8, required: true });
  const submit = h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('sign_in'));
  const toggle = h('button.btn.btn--ghost.btn--wide', { type: 'button' }, t('no_account'));
  const forgot = h('button.btn.btn--ghost.btn--wide', { type: 'button', onclick: async () => { if (!email.value) { email.focus(); return; } try { await api.resetPassword(email.value.trim()); toast(t('reset_sent')); } catch (e) { fail(e); } } }, t('forgot'));
  const paint = () => { submit.textContent = mode === 'in' ? t('sign_in') : t('sign_up'); toggle.textContent = mode === 'in' ? t('no_account') : t('have_account'); pass.autocomplete = mode === 'in' ? 'current-password' : 'new-password'; forgot.hidden = mode !== 'in'; };
  toggle.addEventListener('click', () => { mode = mode === 'in' ? 'up' : 'in'; paint(); });
  const form = h('form.form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!email.value || !pass.value) { (email.value ? pass : email).focus(); return; }
    submit.disabled = true;
    try {
      if (mode === 'in') { await api.signIn(email.value.trim(), pass.value); }
      else { const r = await api.signUp(email.value.trim(), pass.value, getLang()); if (r.needsConfirmation) { toast(t('check_email')); submit.disabled = false; return; } }
      state.session = api.getSession();
      await loadMe();
      renderChrome();
      go(state.me?.profile ? (state.after || '#/') : '#/onboarding');
    } catch (err) { fail(err); submit.disabled = false; }
  } }, field(t('email'), email), field(t('password'), pass), submit, toggle, forgot);
  paint();
  el.append(form);
  return el;
}

async function screenOnboarding() {
  if (!state.session) { go('#/auth'); return h('div'); }
  if (state.me?.profile) { go(state.after || '#/'); return h('div'); }
  const el = h('section.screen.auth');
  el.append(h('div.auth__hero', null, h('h1', null, t('onboarding_title')), h('p.lead', null, t('onboarding_lead'))));
  const draft = { role: state.roleHint || 'carrier', display_name: '', city: null, phone: '', company: '' };
  const form = h('form.form', { novalidate: true });
  form.append(field(t('role'), chips([{ value: 'carrier', label: t('role_carrier') }, { value: 'customer', label: t('role_customer') }], { value: draft.role, name: t('role'), onChange: (v) => { draft.role = v; } })));
  const nameIn = input({ maxlength: 80, autocomplete: 'name', required: true, oninput: (e) => { draft.display_name = e.target.value; } });
  form.append(field(t('name'), nameIn));
  form.append(placeButton('city', () => draft.city, (p) => { draft.city = p; }));
  const phoneIn = input({ type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '+371 20000000', required: true, oninput: (e) => { draft.phone = e.target.value; } });
  form.append(field(t('phone'), phoneIn, t('phone_hint')));
  form.append(field(t('company'), input({ maxlength: 120, autocomplete: 'organization', oninput: (e) => { draft.company = e.target.value; } })));
  const submit = h('button.btn.btn--primary.btn--big.btn--wide', { type: 'submit' }, t('continue'));
  form.append(submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!draft.display_name.trim()) { nameIn.focus(); return; }
    if (!draft.phone.trim()) { phoneIn.focus(); return; }
    submit.disabled = true;
    try {
      await api.saveProfile({ role: draft.role, display_name: draft.display_name.trim(), city_name: draft.city?.name || null, city_lat: draft.city?.lat ?? null, city_lng: draft.city?.lng ?? null, lang: getLang() });
      await api.saveContacts({ phone: draft.phone.trim(), email: state.session.user?.email || null, company: draft.company.trim() || null });
      await loadMe();
      renderChrome();
      if (draft.role === 'carrier') { go('#/me'); setTimeout(vehicleSheet, 350); } else go(state.after || '#/');
      state.after = null;
    } catch (err) { fail(err); submit.disabled = false; }
  });
  el.append(form);
  return el;
}

function notifText(n) {
  const p = n.payload || {};
  const vars = { from: p.from || '', to: p.to || '', amount: p.amount != null ? fmtInt(p.amount) : '' };
  const key = { match: 'n_match', bid: p.above_price ? 'n_bid_above' : 'n_bid', accepted: 'n_accepted', deal: 'n_deal', taken: 'n_taken', cancelled: 'n_cancelled' }[n.type] || 'n_match';
  return t(key, vars);
}
async function screenInbox() {
  if (!requireAuth()) return h('div');
  const list = (await api.listNotifications()) || [];
  const el = h('section.screen.stack.narrow');
  el.append(h('h1', null, t('notifications')));
  const rows = h('div.list');
  if (!list.length) rows.append(emptyState(t('no_notifications')));
  for (const n of list) {
    rows.append(h('a.card.noterow', { href: n.posting_id ? `#/p/${n.posting_id}` : '#/my', class: n.read_at ? '' : 'is-unread' }, icon(n.type === 'deal' || n.type === 'accepted' ? 'check' : n.type === 'bid' ? 'box' : 'bell'), h('div', null, h('div.noterow__t', null, notifText(n)), h('div.noterow__s', null, relTime(n.created_at)))));
  }
  el.append(rows);
  const unread = list.filter((n) => !n.read_at).map((n) => n.id);
  if (unread.length) { api.markRead(unread).then(() => { state.unread = 0; renderChrome(); }).catch(() => {}); }
  return el;
}

// ---------------------------------------------------------------------------------------
// Notifications polling (browser channel)
// ---------------------------------------------------------------------------------------
async function pollNotifications() {
  if (!state.session || document.visibilityState !== 'visible') return;
  try {
    const list = (await api.listNotifications()) || [];
    const unread = list.filter((n) => !n.read_at);
    if (unread.length !== state.unread) { state.unread = unread.length; renderChrome(); }
    const fresh = unread.filter((n) => !state.seenNotified.has(n.id));
    if (fresh.length && 'Notification' in window && Notification.permission === 'granted') {
      for (const n of fresh.slice(0, 3)) {
        try { const note = new Notification('Paceļam', { body: notifText(n), tag: n.id }); note.onclick = () => { window.focus(); go(n.posting_id ? `#/p/${n.posting_id}` : '#/inbox'); }; } catch { /* ignore */ }
      }
    }
    fresh.forEach((n) => state.seenNotified.add(n.id));
    store.set('pacelam.notified', [...state.seenNotified].slice(-200));
  } catch { /* offline */ }
}

// ---------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------
async function loadMe() {
  state.session = api.getSession();
  state.me = state.session ? await api.getMe().catch(() => null) : null;
  return state.me;
}
async function boot() {
  applyTheme(store.get('pacelam.theme', 'dark'));
  setLang(detectLang());
  const params = new URLSearchParams(location.search);
  if (params.get('role')) state.roleHint = params.get('role') === 'customer' ? 'customer' : 'carrier';
  const [vehicleTypes, groups, cargoTypes] = await Promise.all([api.getVehicleTypes(), api.getVehicleGroups(), api.getCargoTypes()]).catch(() => [[], [], []]);
  state.ref = { vehicleTypes: vehicleTypes || [], groups: groups || [], cargoTypes: cargoTypes || [] };
  // Links from the public page: ?demo=carrier|customer|operator signs into the demo directly,
  // ?post=cargo|truck opens posting straight away (the "Offer: cargo / transport" doors).
  const demo = params.get('demo');
  const post = ['cargo', 'truck'].includes(params.get('post')) ? params.get('post') : null;
  // Not signed in, no invitation from the public page, straight to the board? Explain the service first.
  if (!api.getSession() && !demo && !post && !params.get('role') && !params.get('visit') && (route().name === 'feed')) {
    location.replace(`../?lang=${getLang()}`);
    return;
  }
  if (demo && api.mode === 'demo') {
    const u = api.demoUsers.find((x) => x.key === `demo_${demo}`);
    if (u && api.userId() !== u.id) await api.signInDemo(u.id);
  }
  if (post && !api.getSession()) {
    if (api.mode === 'demo') { const u = api.demoUsers.find((x) => x.key === (post === 'truck' ? 'demo_carrier' : 'demo_customer')); if (u) await api.signInDemo(u.id); }
    else state.roleHint = post === 'truck' ? 'carrier' : 'customer';
  }
  if (demo || post || params.get('role') || params.get('visit')) {
    const url = new URL(location.href);
    url.searchParams.delete('demo');
    url.searchParams.delete('post');
    url.searchParams.delete('role');
    url.searchParams.delete('visit');
    history.replaceState(null, '', url.pathname + url.search + (post ? `#/post/${post}` : (location.hash || '#/')));
  }
  await loadMe();
  api.onAuth(async () => { await loadMe(); renderChrome(); });
  window.addEventListener('hashchange', () => { if (route().name !== 'feed') state.selected = null; render(); });
  mqTable.addEventListener('change', () => render());
  mqWide.addEventListener('change', () => render());
  document.addEventListener('visibilitychange', pollNotifications);
  setInterval(pollNotifications, 30000);
  await render();
  pollNotifications();
}
boot();
