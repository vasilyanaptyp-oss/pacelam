// Small DOM helpers: no framework, the board must open instantly on a cheap phone.
import { t, locale } from './i18n.js?v=806ca22a';

export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string' && k !== 'value') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const icons = {
  truck: '<path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
  box: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12l4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  list: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
  phone: '<path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5a4 4 0 0 0 0-8H11a4 4 0 0 1 0-8h5"/>',
  down: '<path d="M12 4v15M6 13l6 6 6-6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  swap: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4"/>',
  // small vehicle silhouettes for the type groups (client's edit, 23.09.2026)
  car: '<path d="M5 16H3v-3.5L6 11.5 8 8h7l3.5 3.5H21V16h-1.5"/><path d="M9.5 16h5"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  van: '<path d="M4.5 17H2V7h12l4 4.5h3.5V17H19"/><path d="M14 7v4.5h4"/><path d="M8.5 17h6.5"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  tow: '<path d="M2 12.5 13 9.5"/><path d="M4.5 17H2v-2.5h11.5V10h3.5l3.5 4v3H19"/><path d="M8.5 17h6.5"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  semi: '<path d="M1.5 15V6h12.5v9"/><path d="M14 9h4l3.5 4V15"/><path d="M1.5 15h20"/><circle cx="5" cy="17.5" r="1.6"/><circle cx="9" cy="17.5" r="1.6"/><circle cx="18" cy="17.5" r="1.6"/>',
};
export function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  svg.innerHTML = icons[name] || '';
  return svg;
}

// ---------- formatting ----------
export const fmtInt = (n) => new Intl.NumberFormat(locale()).format(Math.round(Number(n) || 0));
export const fmtMoney = (n) => (n == null || n === '' ? '' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Number(n))} €`);
export const fmtNum = (n, digits = 1) => new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(Number(n));
export function fmtDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d;
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(date);
}
export function fmtDateRange(from, to) {
  if (!to || to === from) return fmtDate(from);
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}
export function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return t('just_now');
  if (min < 60) return t('min_ago', { n: min });
  const hrs = Math.round(min / 60);
  if (hrs < 24) return t('hours_ago', { n: hrs });
  return t('days_ago', { n: Math.round(hrs / 24) });
}
export const isoDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (n) => isoDate(new Date(Date.now() + n * 86400000));

// ---------- toasts ----------
let toastRoot;
export function toast(message, kind = 'ok') {
  if (!toastRoot) { toastRoot = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.append(toastRoot); }
  const el = h('div.toast', { class: kind === 'error' ? 'is-error' : '' }, message);
  toastRoot.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 220); }, 3800);
}

// ---------- bottom sheet (stackable: a city picker may open on top of a form sheet) ----------
const openSheets = [];
export function sheet({ title, body, onClose, label }) {
  const previous = document.activeElement;
  const panel = h('div.sheet__panel', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title || '' });
  const closeBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('cancel'), onclick: () => api.close() }, icon('x'));
  const head = h('div.sheet__head', null, h('h2.sheet__title', null, title || ''), closeBtn);
  const content = h('div.sheet__body');
  append(content, [body]);
  panel.append(head, content);
  const root = h('div.sheet', { onclick: (e) => { if (e.target === root) api.close(); } }, panel);
  const onKey = (e) => { if (e.key === 'Escape' && openSheets[openSheets.length - 1] === api) api.close(); };
  document.addEventListener('keydown', onKey);
  document.body.append(root);
  document.body.classList.add('has-sheet');
  requestAnimationFrame(() => root.classList.add('is-open'));
  const focusable = content.querySelector('input,button,select,textarea,[tabindex="0"]');
  (focusable || closeBtn).focus({ preventScroll: true });
  const api = {
    root, content,
    close(result) {
      if (!root.isConnected) return;
      document.removeEventListener('keydown', onKey);
      root.classList.remove('is-open');
      const i = openSheets.indexOf(api);
      if (i >= 0) openSheets.splice(i, 1);
      if (!openSheets.length) document.body.classList.remove('has-sheet');
      setTimeout(() => root.remove(), 200);
      onClose?.(result);
      if (previous && previous.focus) previous.focus({ preventScroll: true });
    },
  };
  openSheets.push(api);
  root.style.zIndex = String(40 + openSheets.length);
  return api;
}
export function confirmSheet(title, text, okLabel = t('ok'), danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet({
      title,
      body: h('div', null,
        h('p.sheet__text', null, text),
        h('div.row.row--end', null,
          h('button.btn.btn--ghost', { type: 'button', onclick: () => s.close(false) }, t('cancel')),
          h('button.btn', { type: 'button', class: danger ? 'btn--danger' : 'btn--primary', onclick: () => { done = true; s.close(true); } }, okLabel))),
      onClose: (r) => resolve(Boolean(r) && done),
    });
  });
}

// ---------- form bits ----------
export function field(label, input, hint) {
  const id = input.id || ('f' + Math.random().toString(36).slice(2, 8));
  input.id = id;
  return h('div.field', null, h('label.field__label', { for: id }, label), input, hint ? h('p.field__hint', null, hint) : null);
}
export function input(props = {}) {
  return h('input.input', { type: 'text', ...props });
}
export function chips(options, { value, multi = false, onChange, name }) {
  // options: [{value, label}] ; value: string | string[]
  const group = h('div.chips', { role: 'group', 'aria-label': name || '' });
  const selected = new Set(multi ? (value || []) : (value != null ? [value] : []));
  const render = () => {
    clear(group);
    for (const o of options) {
      const on = selected.has(o.value);
      group.append(h('button.chip', {
        type: 'button', 'aria-pressed': on ? 'true' : 'false', class: on ? 'is-on' : '',
        onclick: () => {
          if (multi) { if (on) selected.delete(o.value); else selected.add(o.value); }
          else { selected.clear(); selected.add(o.value); }
          render();
          onChange?.(multi ? [...selected] : [...selected][0]);
        },
      }, o.label));
    }
  };
  render();
  group.getValue = () => (multi ? [...selected] : [...selected][0]);
  return group;
}
export function spinner() { return h('div.spinner', { role: 'status', 'aria-label': t('loading') }); }
export function emptyState(title, text) { return h('div.empty', null, h('p.empty__title', null, title), text ? h('p.empty__text', null, text) : null); }
