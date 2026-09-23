// Public page: Latvian is baked into the HTML; ru/en are swapped in. ?lang= beats the saved
// choice, the saved choice beats the browser, document.documentElement.lang follows.
(function () {
  const LANGS = ['lv', 'ru', 'en'];
  const KEY = 'pacelam.lang';
  const D = {
    ru: {
      skip: 'К содержанию', sign_in: 'Войти',
      eyebrow: 'Биржа обратной загрузки · Латвия и Балтия',
      h1: 'Возвращайся <em>с грузом</em>, а не пустым.',
      lead: 'Перевозчик едет обратно порожним — это чистый убыток. Заказчику надо отправить груз ровно туда. <b>Paceļam</b> сводит обоих: объявление за 20 секунд, крюк в километрах на каждой карточке, контакты только после сделки.',
      cta_customer: 'ИЩУ транспорт', cta_carrier: 'ПРЕДЛАГАЮ транспорт',
      offer_h: 'Предложить', offer_cargo: 'Груз', offer_truck: 'Транспорт', offer_cargo_aria: 'Предложить груз', offer_truck_aria: 'Предложить транспорт',
      demo_p: 'Посмотреть без регистрации — демо с примерными данными:', demo_carrier: 'Попробовать как перевозчик', demo_customer: 'Попробовать как заказчик',
      m_cargo: 'Груз', m_cargo2: 'Груз', m_urgent: 'Срочно', m_urgent2: 'Срочно', m_planned: 'Планово', m_planned2: 'Планово', m_age1: '3 мин назад', m_age2: '1 ч назад',
      m_metric1: 'по пути<small>41 км пути</small>', m_meta1: 'Автомобиль · VT08 Эвакуатор до 5 т · сегодня', m_take: 'Предложить цену',
      m_metric2: '+38 км крюка<small>202 км пути</small>', m_meta2: 'предложений: 2 · лучшее 170 €',
      how_k: 'Как это работает', how_h: 'Пять шагов от звонка до груза в кузове.',
      s1_h: 'Заявка', s1_p: 'Перевозчик предлагает транспорт или заказчик выкладывает груз: откуда, куда, когда.',
      s2_h: 'Совпадения', s2_p: 'Биржа находит тех, кому это по пути, и шлёт уведомление.',
      s3_h: 'Цена', s3_p: 'Цену называет только перевозчик. Заказчик видит все предложения и жмёт «Согласиться» или «Ещё подумаю».',
      s4_h: 'Согласие', s4_p: '«Согласиться» — и сделка заключена.',
      s5_h: 'Контакты', s5_p: 'Только теперь открываются телефоны. До этого они закрыты.',
      modes_k: 'Два режима — выбирает заказчик', modes_h: 'Когда человек стоит на дороге, счёт идёт на минуты. Когда груз не горит — можно подождать лучшую цену. Но цена решает в обоих режимах.',
      mode_u_h: 'Цена решает — но быстро', mode_u_p: 'Заявка падает всем, кому по пути. Перевозчик соглашается с ценой заказчика или предлагает свою. Заказчик выбирает предложение сразу, как оно пришло, — и контакты открываются в ту же минуту.', mode_u_ex: '<b>Пример:</b> эвакуация после аварии.',
      mode_p_h: 'Выигрывает меньшая цена', mode_p_p: 'Перевозчики ставят цену, выигрывает меньшая. Заказчик может указать цену, по которой отдаёт сразу. Если цена занижена и никто не берёт — перевозчики ставят выше, и заказчику приходит уведомление.', mode_p_ex: '<b>Пример:</b> груз на следующей неделе.',
      who_k: 'Кто что получает', who_h: 'Перевозчику — крюк. Заказчику — цена.',
      carrier_h: 'Перевозчику',
      c1: '<b>Транспорт регистрируешь один раз</b> — тип, тоннаж, габариты, номер. Дальше объявление — три касания: откуда, куда, когда.',
      c2: '<b>Крюк, а не радиус.</b> На каждой карточке видно, сколько километров груз добавляет к твоему пути.',
      c3: '<b>Сохранённый поиск звонит тебе сам:</b> появился подходящий груз — приходит уведомление.',
      c4: '<b>Несколько единиц транспорта</b> в одном профиле — диспетчер подаёт и раздаёт с одного экрана.',
      c5: '<b>Бесплатно</b> на старте.',
      cta_carrier2: 'Предложить транспорт',
      customer_h: 'Заказчику',
      k1: '<b>Всегда бесплатно.</b> Груз из офиса или с телефона.',
      k2: '<b>Все предложения рядом</b> — «Согласиться» или «Ещё подумаю».',
      k3: '<b>Фото до четырёх</b> — перевозчик сразу понимает, что везти.',
      k4: '<b>Контакты закрыты до сделки:</b> телефон не попадает к тем, кто не едет.',
      k5: '<b>Цену не указываешь</b> — перевозчики пришлют свою, ты выбираешь.',
      cta_customer2: 'Выложить груз',
      n1: '— по пути. Груз там, куда ты и так едешь.', n_slogan: 'Попутный груз. Обратно — не порожняком.',
      cta_h: 'Начни с демо — без регистрации, с примерными данными.', demo_carrier2: 'Как перевозчик', demo_customer2: 'Как заказчик',
      foot_app: 'Открыть биржу',
      hud_load: 'В кузове', hud_detour: 'Крюк', hud_empty: 'Порожняком',
      m_cargo3: 'Груз', m_planned3: 'Планово', m_age3: '20 мин назад', m3_metric: '+12 км крюка<small>96 км пути</small>', m4_metric: '+25 км крюка<small>153 км пути</small>', m4_meta: '11 000 кг · 8 м³',
      f1: 'на объявление — три касания: откуда, куда, когда', f2: 'крюк, а не радиус — сколько километров груз добавляет к твоему пути', f3: 'телефонов до сделки — контакты открываются только после подтверждения',
      title: 'Paceļam — биржа обратной загрузки для Латвии и Балтии',
      description: 'Paceļam: перевозчик едет обратно пустым, заказчику надо отправить груз — биржа сводит обоих. Объявление за 20 секунд, крюк в километрах, контакты только после сделки.',
    },
    en: {
      skip: 'Skip to content', sign_in: 'Sign in',
      eyebrow: 'Backload exchange · Latvia and the Baltics',
      h1: 'Drive back <em>with cargo</em>, not empty.',
      lead: 'A carrier returning empty is a straight loss. A customer needs cargo sent exactly that way. <b>Paceļam</b> brings them together: a posting in 20 seconds, the detour in kilometres on every card, contacts only after a deal.',
      cta_customer: 'I NEED transport', cta_carrier: 'I OFFER transport',
      offer_h: 'Offer', offer_cargo: 'Cargo', offer_truck: 'Transport', offer_cargo_aria: 'Offer cargo', offer_truck_aria: 'Offer transport',
      demo_p: 'Look around without signing up — a demo with sample data:', demo_carrier: 'Try as a carrier', demo_customer: 'Try as a customer',
      m_cargo: 'Cargo', m_cargo2: 'Cargo', m_urgent: 'Urgent', m_urgent2: 'Urgent', m_planned: 'Planned', m_planned2: 'Planned', m_age1: '3 min ago', m_age2: '1 h ago',
      m_metric1: 'on the way<small>41 km trip</small>', m_meta1: 'Vehicle · VT08 Tow truck up to 5 t · today', m_take: 'Offer a price',
      m_metric2: '+38 km detour<small>202 km trip</small>', m_meta2: 'offers: 2 · best 170 €',
      how_k: 'How it works', how_h: 'Five steps from a phone call to cargo on board.',
      s1_h: 'Posting', s1_p: 'A carrier offers transport or a customer posts cargo: from, to, when.',
      s2_h: 'Matches', s2_p: 'The exchange finds carriers who have it on their way and notifies them.',
      s3_h: 'Price', s3_p: 'Only the carrier names a price. The customer sees all offers and taps “Agree” or “Let me think”.',
      s4_h: 'Agreement', s4_p: '“Agree” — and the deal is made.',
      s5_h: 'Contacts', s5_p: 'Only now do the phone numbers open. Until then they are closed.',
      modes_k: 'Two modes — the customer chooses', modes_h: 'When someone is stuck on the road, minutes count. When the cargo can wait, you can wait for a better price. Price decides in both modes.',
      mode_u_h: 'Price decides — fast', mode_u_p: 'The posting reaches everyone who has it on the way. The carrier agrees to the customer\'s price or offers their own. The customer picks an offer the moment it arrives, and contacts open that same minute.', mode_u_ex: '<b>Example:</b> towing after an accident.',
      mode_p_h: 'Lowest price wins', mode_p_p: 'Carriers make offers, the lowest wins. The customer may set a price at which they give it away at once. If the price is too low and nobody takes it, carriers offer higher and the customer gets notified.', mode_p_ex: '<b>Example:</b> cargo next week.',
      who_k: 'Who gets what', who_h: 'The carrier gets the detour. The customer gets the price.',
      carrier_h: 'For carriers',
      c1: '<b>Register your transport once</b> — type, payload, dimensions, plate. From then on a posting is three taps: from, to, when.',
      c2: '<b>Detour, not radius.</b> Every card shows how many kilometres the cargo adds to your route.',
      c3: '<b>A saved search calls you:</b> a matching cargo appears — you get notified.',
      c4: '<b>Several vehicles</b> in one profile — a dispatcher posts and assigns from one screen.',
      c5: '<b>Free</b> at launch.',
      cta_carrier2: 'Offer transport',
      customer_h: 'For customers',
      k1: '<b>Always free.</b> Cargo from the office or from a phone.',
      k2: '<b>All offers side by side</b> — “Agree” or “Let me think”.',
      k3: '<b>Up to four photos</b> — the carrier sees at once what to haul.',
      k4: '<b>Contacts closed until the deal:</b> your phone does not reach those who are not driving.',
      k5: '<b>No price from you</b> — carriers send theirs, you choose.',
      cta_customer2: 'Post cargo',
      n1: '— on the way. Cargo where you are driving anyway.', n_slogan: 'Cargo on your way. Never drive back empty.',
      cta_h: 'Start with the demo — no sign-up, sample data.', demo_carrier2: 'As a carrier', demo_customer2: 'As a customer',
      foot_app: 'Open the exchange',
      hud_load: 'On board', hud_detour: 'Detour', hud_empty: 'Empty run',
      m_cargo3: 'Cargo', m_planned3: 'Planned', m_age3: '20 min ago', m3_metric: '+12 km detour<small>96 km trip</small>', m4_metric: '+25 km detour<small>153 km trip</small>', m4_meta: '11 000 kg · 8 m³',
      f1: 'to post — three taps: from, to, when', f2: 'detour, not radius — how many kilometres the cargo adds to your route', f3: 'phone numbers before a deal — contacts open only after confirmation',
      title: 'Paceļam — backload exchange for Latvia and the Baltics',
      description: 'Paceļam: a carrier drives back empty, a customer needs cargo sent that way — the exchange brings them together. A posting in 20 seconds, detour in kilometres, contacts only after a deal.',
    },
  };
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  const navAll = (navigator.languages || [navigator.language || '']).map((l) => String(l).slice(0, 2).toLowerCase());
  // phone language the site does not have: Ukrainian/Belarusian/… read Russian, anyone else gets English (same rule as js/i18n.js)
  const fallback = navAll.some((l) => ['uk', 'be', 'kk', 'ky', 'uz', 'tg', 'az', 'hy', 'ka', 'mo'].includes(l)) ? 'ru' : (navAll.some((l) => l) ? 'en' : 'lv');
  const nav = navAll.find((l) => LANGS.includes(l));
  const lang = LANGS.includes(fromUrl) ? fromUrl : (LANGS.includes(saved) ? saved : (nav || fallback));
  document.documentElement.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  const dict = D[lang];
  if (dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => { const v = dict[el.dataset.i18n]; if (v != null) el.textContent = v; });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { const v = dict[el.dataset.i18nHtml]; if (v != null) el.innerHTML = v; });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { const v = dict[el.dataset.i18nAria]; if (v != null) el.setAttribute('aria-label', v); });
    document.title = dict.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', dict.description);
  }
  // Scroll reveals: short, and everything is forced visible after a moment regardless of scrolling.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rv = [...document.querySelectorAll('.rv')];
  if (reduce || !('IntersectionObserver' in window)) rv.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    rv.forEach((el) => io.observe(el));
    setTimeout(() => rv.forEach((el) => el.classList.add('in')), 1200);
  }
  // Phones and weak devices get a still scene: the running truck is a desktop treat.
  const weak = reduce || matchMedia('(max-width: 979px)').matches || (navigator.connection && navigator.connection.saveData) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 && matchMedia('(pointer: coarse)').matches);
  if (!weak) {
    // capable desktop: load GSAP (self-hosted) and the scene script, in order
    const load = (src) => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.append(el); });
    load('vendor/gsap.min.js').then(() => Promise.all([load('vendor/MotionPathPlugin.min.js'), load('vendor/DrawSVGPlugin.min.js')])).then(() => load('js/scene.js')).catch(() => {});
  }
  document.querySelectorAll('[data-lang]').forEach((a) => { const on = a.dataset.lang === lang; a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'true'); });
  // carry the language into the app links
  document.querySelectorAll('a[data-app]').forEach((a) => {
    const href = a.getAttribute('href');
    const [path, hash] = href.split('#');
    const url = new URL(path, location.href);
    url.searchParams.set('lang', lang);
    a.setAttribute('href', url.pathname + url.search + (hash ? '#' + hash : ''));
  });
})();
