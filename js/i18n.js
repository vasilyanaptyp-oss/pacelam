// Three languages. Priority: ?lang= in the URL > saved choice > browser > lv.
// document.documentElement.lang always follows the active language.
export const LANGS = ['lv', 'ru', 'en'];
const KEY = 'pacelam.lang';

const D = {
  lv: {
    brand_tag: 'Kravu birža atpakaļceļam',
    nav_feed: 'Plūsma', nav_post: 'Pieteikt', nav_my: 'Mani', nav_search: 'Meklējumi', nav_profile: 'Profils',
    lang_pick: 'Valoda', notifications: 'Paziņojumi', no_notifications: 'Paziņojumu vēl nav.',
    demo_banner: 'Demonstrācijas režīms: dati ir piemērs un glabājas tikai šajā pārlūkā.',
    demo_login: 'Ieiet demo režīmā kā', demo_carrier: 'Pārvadātājs — Boriss, Daugavpils', demo_customer: 'Pasūtītājs — Anna, Rīga',
    kind_cargo: 'Krava', kind_truck: 'Auto', mode_urgent: 'Steidzami', mode_planned: 'Plānoti',
    kind_cargo_long: 'Meklēju transportu', kind_truck_long: 'Piedāvāju auto',
    feed_title: 'Kravas un auto', feed_empty: 'Pagaidām tukšs.', feed_empty_hint: 'Pirmos pieteikumus izliek dispečers — zvani, kurus tāpat nākas atdot.',
    feed_route: 'Mans ceļš', feed_route_set: 'Norādīt ceļu', feed_route_none: 'Norādi, kur brauc — redzēsi līkumu kilometros katrai kravai.',
    feed_detour_upto: 'līkums līdz {km} km', feed_show_all: 'Rādīt visus ({n})', feed_show_near: 'Tikai pa ceļam',
    feed_filter: 'Filtrs', feed_all: 'Viss', feed_visitors_cta: 'Ieej, lai pieteiktos vai piedāvātu cenu.',
    detour: '+{km} km līkums', on_the_way: 'pa ceļam', from_you: '{km} km no tevis', in_your_town: 'tavā pilsētā', direct: '{km} km ceļš',
    weight: 'Svars', dims: 'Izmēri', volume: 'Tilpums', kg: 'kg', m3: 'm³', m: 'm', t: 't',
    kv_instant: 'Atdod uzreiz par', kv_asking: 'Prasa', price_instant: '{p} € — ņem uzreiz', price_asking: 'prasa {p} €', price_offer: '{p} €', bids_n: 'piedāvājumi: {n}', best_bid: 'labākais {p} €', no_bids: 'piedāvājumu vēl nav',
    take: 'Ņemu', take_for: 'Ņemu par {p} €', bid: 'Sava cena', bid_send: 'Nosūtīt cenu', bid_amount: 'Cena, €', bid_note: 'Piezīme (nav obligāta)', bid_placed: 'Cena nosūtīta.', bid_withdraw: 'Atsaukt', bid_update: 'Mainīt cenu',
    bid_hint_cargo: 'Zemāka cena uzvar. Ja pasūtītāja cena ir par zemu — liec augstāku, viņš saņems paziņojumu.',
    bid_hint_truck: 'Piedāvā, cik maksāsi par savu kravu šajā auto.',
    offer_cargo: 'Piedāvāt kravu', your_bid: 'Tava cena', accept: 'Pieņemt', accepted: 'pieņemts', rejected: 'noraidīts', withdrawn: 'atsaukts',
    owner_bids: 'Piedāvājumi', owner_no_bids: 'Piedāvājumu vēl nav. Kad kāds piedāvās cenu, saņemsi paziņojumu.',
    status_open: 'atvērts', status_pending: 'gaida apstiprinājumu', status_deal: 'darījums', status_closed: 'slēgts', status_cancelled: 'atcelts',
    deal_pending_you: 'Tavs piedāvājums pieņemts. Apstiprini darījumu — tad atvērsies kontakti.', deal_pending_other: 'Gaidām otras puses apstiprinājumu.',
    deal_confirm: 'Apstiprināt darījumu', deal_cancel: 'Atteikties', deal_done: 'Darījums apstiprināts. Kontakti atvērti.', deal_amount: 'Summa',
    contacts: 'Kontakti', call: 'Zvanīt', whatsapp: 'WhatsApp', email: 'E-pasts', company: 'Uzņēmums', contacts_locked: 'Kontakti atveras pēc darījuma apstiprināšanas.',
    close_posting: 'Slēgt sludinājumu', close_confirm: 'Slēgt sludinājumu? Piedāvājumi tiks noraidīti.', closed_ok: 'Sludinājums slēgts.',
    posted_by: 'Izlika', operator: 'Operators', operator_hint: 'Pieteikums no zvana — izliek dispečers',
    post_title: 'Jauns sludinājums', post_cargo: 'Krava — meklēju transportu', post_truck: 'Auto — meklēju kravu',
    from: 'No kurienes', to: 'Uz kurieni', when: 'Kad', today: 'Šodien', tomorrow: 'Rīt', date: 'Datums', date_to: 'līdz', pick_city: 'Izvēlies vietu', city_search: 'Pilsēta…', my_location: 'Mana atrašanās vieta', radius: 'Rādiuss', km_plus: '+{km} km', no_city: 'Nekas nav atrasts. Tuvākā lielākā pilsēta der.',
    cargo_type: 'Kravas veids', vehicle_needed: 'Vajadzīgais auto', any_vehicle: 'Jebkurš', vehicle: 'Auto', my_vehicle: 'Mans auto', add_vehicle_first: 'Vispirms pievieno auto profilā — tas ir vienreiz.', capacity: 'Brīvā vieta',
    photos: 'Foto', photos_hint: 'Līdz 4 foto, saspiež pirms nosūtīšanas.', photo_add: 'Pievienot foto', photo_remove: 'Noņemt',
    mode: 'Režīms', mode_urgent_hint: 'Cilvēks stāv uz ceļa. Pirmais, kurš ņem, — brauc.', mode_planned_hint: 'Pārvadātāji piedāvā cenu; zemākā uzvar. Tu vari norādīt cenu, par kuru atdod uzreiz.',
    price: 'Cena, €', price_instant_label: 'Cena, par kuru atdod uzreiz (nav obligāta)', price_urgent_label: 'Cena, € (nav obligāta)', price_truck_label: 'Vedu par, € (nav obligāta)',
    note: 'Piezīme', note_ph: 'Kas jāzina pārvadātājam', submit_post: 'Izlikt', posted_ok: 'Sludinājums izlikts.', posting_not_found: 'Sludinājums nav atrasts.',
    validation_route: 'Norādi, no kurienes un uz kurieni.', validation_vehicle: 'Izvēlies auto.', validation_date: 'Norādi datumu.',
    my_title: 'Mani', my_postings: 'Sludinājumi', my_bids: 'Cenas', my_deals: 'Darījumi', my_empty: 'Pagaidām nekā.',
    search_title: 'Saglabātie meklējumi', search_hint: 'Saņem paziņojumu, tiklīdz parādās kaut kas piemērots — tu nezvani biržai, birža zvana tev.',
    search_new: 'Jauns meklējums', search_kind: 'Ko meklēju', search_center: 'Kur', search_dest: 'Uz kurieni (nav obligāti)', search_vehicles: 'Auto veidi', search_cargo: 'Kravu veidi', search_modes: 'Režīmi',
    notify_browser: 'Paziņojums pārlūkā', notify_email: 'Uz e-pastu', notify_allow: 'Atļaut paziņojumus', notify_allowed: 'Paziņojumi atļauti', notify_denied: 'Paziņojumi pārlūkā aizliegti — atļauj tos pārlūka iestatījumos.',
    search_save: 'Saglabāt un paziņot', search_saved: 'Meklējums saglabāts.', search_delete: 'Dzēst', search_empty: 'Meklējumu vēl nav.',
    profile_title: 'Profils', role: 'Loma', role_carrier: 'Pārvadātājs', role_customer: 'Pasūtītājs', name: 'Vārds vai uzņēmums', city: 'Pilsēta', phone: 'Tālrunis', phone_hint: 'Redz tikai otra puse pēc darījuma.',
    max_detour: 'Gatavs līkumam līdz', save: 'Saglabāt', saved: 'Saglabāts.', theme: 'Gaišais režīms (saulei)', vehicles: 'Mani auto', add_vehicle: 'Pievienot auto', vehicle_type: 'Auto veids', plate: 'Numurs', tonnage: 'Kravnesība, t', default_vehicle: 'Pēc noklusējuma', delete: 'Dzēst',
    sign_out: 'Iziet', sign_in: 'Ieiet', sign_up: 'Reģistrēties', password: 'Parole', have_account: 'Jau ir konts', no_account: 'Nav konta', forgot: 'Aizmirsi paroli?', reset_sent: 'Nosūtījām vēstuli paroles atjaunošanai.', check_email: 'Pārbaudi e-pastu un apstiprini adresi, tad ieej.',
    auth_title: 'Ieeja', auth_lead: 'Sludinājums — 20 sekundēs ar vienu roku. Auto pievieno vienreiz, tālāk tikai: no kurienes, uz kurieni, kad.',
    onboarding_title: 'Par tevi', onboarding_lead: 'Vienreiz, pēc tam tikai brauc.', continue: 'Turpināt',
    error_generic: 'Neizdevās. Pamēģini vēlreiz.', loading: 'Ielādē…', back: 'Atpakaļ', cancel: 'Atcelt', ok: 'Labi', yes: 'Jā', no: 'Nē',
    n_match: 'Jauns pieteikums pa ceļam: {from} → {to}', n_bid: 'Jauna cena {amount} €: {from} → {to}', n_bid_above: 'Piedāvājums virs tavas cenas: {amount} € ({from} → {to})', n_accepted: 'Tava cena {amount} € pieņemta — apstiprini darījumu', n_deal: 'Darījums apstiprināts: {from} → {to}. Kontakti atvērti.', n_taken: 'Tavu steidzamo pieteikumu paņēma: {from} → {to}', n_cancelled: 'Darījums atcelts: {from} → {to}',
    min_ago: 'pirms {n} min', hours_ago: 'pirms {n} h', days_ago: 'pirms {n} d', just_now: 'tikko',
    field_yes: 'Jā', field_no: 'Nē', any: 'Jebkurš', all: 'Visi', more: 'Vēl', less: 'Mazāk', provisional: 'Saraksts pagaidu — nomainīs pēc pirmajiem pieteikumiem',
    err_not_open: 'Jau paņemts vai slēgts.', err_own: 'Tas ir tavs sludinājums.', err_auth: 'Nepareizs e-pasts vai parole.', err_no_instant: 'Nav tūlītējās cenas — piedāvā savu.', err_rate: 'Pārāk daudz mēģinājumu, pagaidi minūti.', err_network: 'Nav savienojuma. Pārbaudi internetu.',
    col_kind: 'Veids', col_route: 'Maršruts', col_detour: 'Līkums', col_distance: 'Attālums', col_date: 'Datums', col_vehicle: 'Auto', col_cargo: 'Krava', col_weight: 'Svars · izmēri', col_price: 'Cena · piedāvājumi', col_age: 'Izlikts',
    sort_by: 'Kārtot', sort_price: 'Pēc cenas', sort_time: 'Pēc laika', rows_shown: '{n} no {total}', select_row: 'Izvēlies rindu tabulā — detaļas parādīsies šeit.', open_full: 'Atvērt lapā', close: 'Aizvērt', filters: 'Filtri', reset: 'Notīrīt', showing_near: 'tikai pa ceļam, līdz {km} km', about: 'Par Paceļam',
    nav_operator: 'Operators', operator_title: 'Operatora režīms', operator_lead: 'Pieteikums no zvana. Aizpildi ar tastatūru: Tab — nākamais lauks, Enter — nosūtīt. Pēc nosūtīšanas forma notīrās nākamajam zvanam.', operator_privacy: 'Zvanītāja tālruni šeit nerakstiet — kontakti atveras tikai pēc darījuma, un otra puse tos saņems caur tevi.', operator_posted: 'Izlikts. Nākamais zvans.', city_unknown: 'Pilsēta nav sarakstā — ņem tuvāko lielāko.', demo_operator: 'Operators — SOS Evakuators, Daugavpils',
    login_required: 'Ieej, lai turpinātu.', profile_required: 'Aizpildi profilu, lai turpinātu.',
  },
  ru: {
    brand_tag: 'Биржа обратной загрузки',
    nav_feed: 'Лента', nav_post: 'Подать', nav_my: 'Мои', nav_search: 'Поиски', nav_profile: 'Профиль',
    lang_pick: 'Язык', notifications: 'Уведомления', no_notifications: 'Уведомлений пока нет.',
    demo_banner: 'Демо-режим: данные примерные и хранятся только в этом браузере.',
    demo_login: 'Войти в демо как', demo_carrier: 'Перевозчик — Борис, Даугавпилс', demo_customer: 'Заказчик — Анна, Рига',
    kind_cargo: 'Груз', kind_truck: 'Машина', mode_urgent: 'Срочно', mode_planned: 'Планово',
    kind_cargo_long: 'Ищу транспорт', kind_truck_long: 'Предлагаю машину',
    feed_title: 'Грузы и машины', feed_empty: 'Пока пусто.', feed_empty_hint: 'Первые заявки выкладывает диспетчер — звонки, которые всё равно приходится отдавать.',
    feed_route: 'Мой маршрут', feed_route_set: 'Указать маршрут', feed_route_none: 'Укажи, куда едешь — увидишь крюк в километрах для каждого груза.',
    feed_detour_upto: 'крюк до {km} км', feed_show_all: 'Показать все ({n})', feed_show_near: 'Только по пути',
    feed_filter: 'Фильтр', feed_all: 'Всё', feed_visitors_cta: 'Войди, чтобы взять заявку или предложить цену.',
    detour: '+{km} км крюка', on_the_way: 'по пути', from_you: '{km} км от тебя', in_your_town: 'в твоём городе', direct: '{km} км пути',
    weight: 'Вес', dims: 'Габариты', volume: 'Объём', kg: 'кг', m3: 'м³', m: 'м', t: 'т',
    kv_instant: 'Отдаёт сразу за', kv_asking: 'Просит', price_instant: '{p} € — забрать сразу', price_asking: 'просит {p} €', price_offer: '{p} €', bids_n: 'ставок: {n}', best_bid: 'лучшая {p} €', no_bids: 'ставок пока нет',
    take: 'Беру', take_for: 'Беру за {p} €', bid: 'Своя ставка', bid_send: 'Отправить ставку', bid_amount: 'Ставка, €', bid_note: 'Примечание (не обязательно)', bid_placed: 'Ставка отправлена.', bid_withdraw: 'Отозвать', bid_update: 'Изменить ставку',
    bid_hint_cargo: 'Выигрывает меньшая. Если цена заказчика занижена — ставь выше, ему придёт уведомление.',
    bid_hint_truck: 'Предложи, сколько заплатишь за свой груз в этой машине.',
    offer_cargo: 'Предложить груз', your_bid: 'Твоя ставка', accept: 'Принять', accepted: 'принята', rejected: 'отклонена', withdrawn: 'отозвана',
    owner_bids: 'Ставки', owner_no_bids: 'Ставок пока нет. Когда кто-то предложит цену, придёт уведомление.',
    status_open: 'открыто', status_pending: 'ждёт подтверждения', status_deal: 'сделка', status_closed: 'закрыто', status_cancelled: 'отменено',
    deal_pending_you: 'Твою ставку приняли. Подтверди сделку — откроются контакты.', deal_pending_other: 'Ждём подтверждения второй стороны.',
    deal_confirm: 'Подтвердить сделку', deal_cancel: 'Отказаться', deal_done: 'Сделка подтверждена. Контакты открыты.', deal_amount: 'Сумма',
    contacts: 'Контакты', call: 'Позвонить', whatsapp: 'WhatsApp', email: 'Почта', company: 'Компания', contacts_locked: 'Контакты открываются после подтверждения сделки.',
    close_posting: 'Закрыть объявление', close_confirm: 'Закрыть объявление? Ставки будут отклонены.', closed_ok: 'Объявление закрыто.',
    posted_by: 'Выложил', operator: 'Оператор', operator_hint: 'Заявка со звонка — выкладывает диспетчер',
    post_title: 'Новое объявление', post_cargo: 'Груз — ищу транспорт', post_truck: 'Машина — ищу груз',
    from: 'Откуда', to: 'Куда', when: 'Когда', today: 'Сегодня', tomorrow: 'Завтра', date: 'Дата', date_to: 'до', pick_city: 'Выбери место', city_search: 'Город…', my_location: 'Моё местоположение', radius: 'Радиус', km_plus: '+{km} км', no_city: 'Ничего не найдено. Подойдёт ближайший крупный город.',
    cargo_type: 'Категория груза', vehicle_needed: 'Нужная машина', any_vehicle: 'Любая', vehicle: 'Машина', my_vehicle: 'Моя машина', add_vehicle_first: 'Сначала добавь машину в профиле — это один раз.', capacity: 'Свободное место',
    photos: 'Фото', photos_hint: 'До 4 снимков, сжимаются перед отправкой.', photo_add: 'Добавить фото', photo_remove: 'Убрать',
    mode: 'Режим', mode_urgent_hint: 'Человек стоит на дороге. Кто первый взял — тот едет.', mode_planned_hint: 'Перевозчики ставят цену, выигрывает меньшая. Можно указать цену, по которой отдаёшь сразу.',
    price: 'Цена, €', price_instant_label: 'Цена, по которой отдаёшь сразу (не обязательно)', price_urgent_label: 'Цена, € (не обязательно)', price_truck_label: 'Везу за, € (не обязательно)',
    note: 'Примечание', note_ph: 'Что нужно знать перевозчику', submit_post: 'Выложить', posted_ok: 'Объявление выложено.', posting_not_found: 'Объявление не найдено.',
    validation_route: 'Укажи откуда и куда.', validation_vehicle: 'Выбери машину.', validation_date: 'Укажи дату.',
    my_title: 'Мои', my_postings: 'Объявления', my_bids: 'Ставки', my_deals: 'Сделки', my_empty: 'Пока ничего.',
    search_title: 'Сохранённые поиски', search_hint: 'Получай уведомление, как только появится подходящее — не ты звонишь бирже, а биржа тебе.',
    search_new: 'Новый поиск', search_kind: 'Что ищу', search_center: 'Где', search_dest: 'Куда (не обязательно)', search_vehicles: 'Типы машин', search_cargo: 'Категории грузов', search_modes: 'Режимы',
    notify_browser: 'Уведомление в браузере', notify_email: 'На почту', notify_allow: 'Разрешить уведомления', notify_allowed: 'Уведомления разрешены', notify_denied: 'Уведомления в браузере запрещены — разреши их в настройках браузера.',
    search_save: 'Сохранить и уведомлять', search_saved: 'Поиск сохранён.', search_delete: 'Удалить', search_empty: 'Поисков пока нет.',
    profile_title: 'Профиль', role: 'Роль', role_carrier: 'Перевозчик', role_customer: 'Заказчик', name: 'Имя или компания', city: 'Город', phone: 'Телефон', phone_hint: 'Видит только вторая сторона после сделки.',
    max_detour: 'Готов на крюк до', save: 'Сохранить', saved: 'Сохранено.', theme: 'Светлая тема (для солнца)', vehicles: 'Мои машины', add_vehicle: 'Добавить машину', vehicle_type: 'Тип машины', plate: 'Номер', tonnage: 'Грузоподъёмность, т', default_vehicle: 'По умолчанию', delete: 'Удалить',
    sign_out: 'Выйти', sign_in: 'Войти', sign_up: 'Зарегистрироваться', password: 'Пароль', have_account: 'Уже есть аккаунт', no_account: 'Нет аккаунта', forgot: 'Забыл пароль?', reset_sent: 'Отправили письмо для смены пароля.', check_email: 'Проверь почту и подтверди адрес, потом войди.',
    auth_title: 'Вход', auth_lead: 'Объявление — за 20 секунд одной рукой. Машину заводишь один раз, дальше только: откуда, куда, когда.',
    onboarding_title: 'О тебе', onboarding_lead: 'Один раз, потом только ездить.', continue: 'Продолжить',
    error_generic: 'Не получилось. Попробуй ещё раз.', loading: 'Загрузка…', back: 'Назад', cancel: 'Отмена', ok: 'Ок', yes: 'Да', no: 'Нет',
    n_match: 'Новая заявка по пути: {from} → {to}', n_bid: 'Новая ставка {amount} €: {from} → {to}', n_bid_above: 'Есть предложение выше твоей цены: {amount} € ({from} → {to})', n_accepted: 'Твою ставку {amount} € приняли — подтверди сделку', n_deal: 'Сделка подтверждена: {from} → {to}. Контакты открыты.', n_taken: 'Твою срочную заявку взяли: {from} → {to}', n_cancelled: 'Сделка отменена: {from} → {to}',
    min_ago: '{n} мин назад', hours_ago: '{n} ч назад', days_ago: '{n} д назад', just_now: 'только что',
    field_yes: 'Да', field_no: 'Нет', any: 'Любой', all: 'Все', more: 'Ещё', less: 'Меньше', provisional: 'Список временный — заменим после первых заявок',
    err_not_open: 'Уже забрали или закрыто.', err_own: 'Это твоё объявление.', err_auth: 'Неверная почта или пароль.', err_no_instant: 'Нет цены мгновенной победы — предложи свою.', err_rate: 'Слишком много попыток, подожди минуту.', err_network: 'Нет связи. Проверь интернет.',
    col_kind: 'Вид', col_route: 'Маршрут', col_detour: 'Крюк', col_distance: 'Расстояние', col_date: 'Дата', col_vehicle: 'Машина', col_cargo: 'Груз', col_weight: 'Вес · габариты', col_price: 'Цена · ставки', col_age: 'Выложено',
    sort_by: 'Сортировка', sort_price: 'По цене', sort_time: 'По времени', rows_shown: '{n} из {total}', select_row: 'Выбери строку в таблице — подробности появятся здесь.', open_full: 'Открыть страницей', close: 'Закрыть', filters: 'Фильтры', reset: 'Сбросить', showing_near: 'только по пути, до {km} км', about: 'О Paceļam',
    nav_operator: 'Оператор', operator_title: 'Режим оператора', operator_lead: 'Заявка со звонка. Заполняй с клавиатуры: Tab — следующее поле, Enter — отправить. После отправки форма очищается под следующий звонок.', operator_privacy: 'Телефон звонившего сюда не пиши — контакты открываются только после сделки, и вторая сторона получит их через тебя.', operator_posted: 'Выложено. Следующий звонок.', city_unknown: 'Города нет в списке — возьми ближайший крупный.', demo_operator: 'Оператор — SOS Evakuators, Даугавпилс',
    login_required: 'Войди, чтобы продолжить.', profile_required: 'Заполни профиль, чтобы продолжить.',
  },
  en: {
    brand_tag: 'Backload exchange',
    nav_feed: 'Board', nav_post: 'Post', nav_my: 'Mine', nav_search: 'Alerts', nav_profile: 'Profile',
    lang_pick: 'Language', notifications: 'Notifications', no_notifications: 'No notifications yet.',
    demo_banner: 'Demo mode: sample data, stored only in this browser.',
    demo_login: 'Enter the demo as', demo_carrier: 'Carrier — Boriss, Daugavpils', demo_customer: 'Customer — Anna, Rīga',
    kind_cargo: 'Cargo', kind_truck: 'Truck', mode_urgent: 'Urgent', mode_planned: 'Planned',
    kind_cargo_long: 'I need transport', kind_truck_long: 'I offer a truck',
    feed_title: 'Cargo and trucks', feed_empty: 'Nothing yet.', feed_empty_hint: 'The first postings come from the dispatcher — the calls he has to turn down anyway.',
    feed_route: 'My route', feed_route_set: 'Set route', feed_route_none: 'Tell us where you are going — every cargo will show its detour in km.',
    feed_detour_upto: 'detour up to {km} km', feed_show_all: 'Show all ({n})', feed_show_near: 'On my way only',
    feed_filter: 'Filter', feed_all: 'All', feed_visitors_cta: 'Sign in to take a job or make an offer.',
    detour: '+{km} km detour', on_the_way: 'on the way', from_you: '{km} km from you', in_your_town: 'in your town', direct: '{km} km trip',
    weight: 'Weight', dims: 'Dimensions', volume: 'Volume', kg: 'kg', m3: 'm³', m: 'm', t: 't',
    kv_instant: 'Gives away at once for', kv_asking: 'Asking', price_instant: '{p} € — take now', price_asking: 'asks {p} €', price_offer: '{p} €', bids_n: 'offers: {n}', best_bid: 'best {p} €', no_bids: 'no offers yet',
    take: 'Take it', take_for: 'Take for {p} €', bid: 'My price', bid_send: 'Send offer', bid_amount: 'Offer, €', bid_note: 'Note (optional)', bid_placed: 'Offer sent.', bid_withdraw: 'Withdraw', bid_update: 'Change offer',
    bid_hint_cargo: 'Lowest offer wins. If the customer\'s price is too low, bid higher — they get notified.',
    bid_hint_truck: 'Offer what you will pay for your cargo in this truck.',
    offer_cargo: 'Offer cargo', your_bid: 'Your offer', accept: 'Accept', accepted: 'accepted', rejected: 'rejected', withdrawn: 'withdrawn',
    owner_bids: 'Offers', owner_no_bids: 'No offers yet. You will be notified when someone makes one.',
    status_open: 'open', status_pending: 'awaiting confirmation', status_deal: 'deal', status_closed: 'closed', status_cancelled: 'cancelled',
    deal_pending_you: 'Your offer was accepted. Confirm the deal to open contacts.', deal_pending_other: 'Waiting for the other side to confirm.',
    deal_confirm: 'Confirm deal', deal_cancel: 'Decline', deal_done: 'Deal confirmed. Contacts are open.', deal_amount: 'Amount',
    contacts: 'Contacts', call: 'Call', whatsapp: 'WhatsApp', email: 'E-mail', company: 'Company', contacts_locked: 'Contacts open once both sides confirm the deal.',
    close_posting: 'Close posting', close_confirm: 'Close this posting? Offers will be rejected.', closed_ok: 'Posting closed.',
    posted_by: 'Posted by', operator: 'Operator', operator_hint: 'Phoned-in request posted by the dispatcher',
    post_title: 'New posting', post_cargo: 'Cargo — I need a truck', post_truck: 'Truck — I need cargo',
    from: 'From', to: 'To', when: 'When', today: 'Today', tomorrow: 'Tomorrow', date: 'Date', date_to: 'until', pick_city: 'Pick a place', city_search: 'City…', my_location: 'My location', radius: 'Radius', km_plus: '+{km} km', no_city: 'Nothing found. The nearest big town will do.',
    cargo_type: 'Cargo category', vehicle_needed: 'Truck needed', any_vehicle: 'Any', vehicle: 'Truck', my_vehicle: 'My truck', add_vehicle_first: 'Add your truck in the profile first — once.', capacity: 'Free capacity',
    photos: 'Photos', photos_hint: 'Up to 4 photos, compressed before upload.', photo_add: 'Add photo', photo_remove: 'Remove',
    mode: 'Mode', mode_urgent_hint: 'Someone is stuck on the road. First to take it drives.', mode_planned_hint: 'Carriers make offers, the lowest wins. You may set a price at which you give it away at once.',
    price: 'Price, €', price_instant_label: 'Price at which you give it away at once (optional)', price_urgent_label: 'Price, € (optional)', price_truck_label: 'Asking price, € (optional)',
    note: 'Note', note_ph: 'What the carrier should know', submit_post: 'Post', posted_ok: 'Posted.', posting_not_found: 'Posting not found.',
    validation_route: 'Set where from and where to.', validation_vehicle: 'Pick a truck.', validation_date: 'Pick a date.',
    my_title: 'Mine', my_postings: 'Postings', my_bids: 'Offers', my_deals: 'Deals', my_empty: 'Nothing yet.',
    search_title: 'Saved searches', search_hint: 'Get notified the moment something suitable appears — the exchange calls you, not the other way round.',
    search_new: 'New search', search_kind: 'Looking for', search_center: 'Where', search_dest: 'Destination (optional)', search_vehicles: 'Truck types', search_cargo: 'Cargo categories', search_modes: 'Modes',
    notify_browser: 'Browser notification', notify_email: 'E-mail', notify_allow: 'Allow notifications', notify_allowed: 'Notifications allowed', notify_denied: 'Browser notifications are blocked — allow them in the browser settings.',
    search_save: 'Save and notify', search_saved: 'Search saved.', search_delete: 'Delete', search_empty: 'No saved searches yet.',
    profile_title: 'Profile', role: 'Role', role_carrier: 'Carrier', role_customer: 'Customer', name: 'Name or company', city: 'City', phone: 'Phone', phone_hint: 'Seen only by the other party after a deal.',
    max_detour: 'Detour I accept, up to', save: 'Save', saved: 'Saved.', theme: 'Light theme (for sunlight)', vehicles: 'My trucks', add_vehicle: 'Add truck', vehicle_type: 'Truck type', plate: 'Plate', tonnage: 'Payload, t', default_vehicle: 'Default', delete: 'Delete',
    sign_out: 'Sign out', sign_in: 'Sign in', sign_up: 'Sign up', password: 'Password', have_account: 'I have an account', no_account: 'No account yet', forgot: 'Forgot password?', reset_sent: 'We sent a password reset e-mail.', check_email: 'Check your e-mail, confirm the address, then sign in.',
    auth_title: 'Sign in', auth_lead: 'Post in 20 seconds with one hand. Add your truck once, then it is only: from, to, when.',
    onboarding_title: 'About you', onboarding_lead: 'Once. Then just drive.', continue: 'Continue',
    error_generic: 'That did not work. Try again.', loading: 'Loading…', back: 'Back', cancel: 'Cancel', ok: 'OK', yes: 'Yes', no: 'No',
    n_match: 'New posting on your way: {from} → {to}', n_bid: 'New offer {amount} €: {from} → {to}', n_bid_above: 'Offer above your price: {amount} € ({from} → {to})', n_accepted: 'Your offer of {amount} € was accepted — confirm the deal', n_deal: 'Deal confirmed: {from} → {to}. Contacts are open.', n_taken: 'Your urgent posting was taken: {from} → {to}', n_cancelled: 'Deal cancelled: {from} → {to}',
    min_ago: '{n} min ago', hours_ago: '{n} h ago', days_ago: '{n} d ago', just_now: 'just now',
    field_yes: 'Yes', field_no: 'No', any: 'Any', all: 'All', more: 'More', less: 'Less', provisional: 'Provisional list — to be replaced after the first postings',
    err_not_open: 'Already taken or closed.', err_own: 'This is your own posting.', err_auth: 'Wrong e-mail or password.', err_no_instant: 'No instant price — make an offer.', err_rate: 'Too many attempts, wait a minute.', err_network: 'No connection. Check the internet.',
    col_kind: 'Type', col_route: 'Route', col_detour: 'Detour', col_distance: 'Distance', col_date: 'Date', col_vehicle: 'Truck', col_cargo: 'Cargo', col_weight: 'Weight · size', col_price: 'Price · offers', col_age: 'Posted',
    sort_by: 'Sort', sort_price: 'By price', sort_time: 'By time', rows_shown: '{n} of {total}', select_row: 'Select a row in the table — details appear here.', open_full: 'Open as page', close: 'Close', filters: 'Filters', reset: 'Reset', showing_near: 'on my way only, up to {km} km', about: 'About Paceļam',
    nav_operator: 'Operator', operator_title: 'Operator mode', operator_lead: 'Phoned-in request. Keyboard only: Tab to the next field, Enter to post. After posting the form clears for the next call.', operator_privacy: 'Do not type the caller’s phone here — contacts open only after a deal, and the other side gets them through you.', operator_posted: 'Posted. Next call.', city_unknown: 'City not in the list — use the nearest bigger town.', demo_operator: 'Operator — SOS Evakuators, Daugavpils',
    login_required: 'Sign in to continue.', profile_required: 'Complete your profile to continue.',
  },
};

let current = 'lv';

export function detectLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl && LANGS.includes(fromUrl)) return fromUrl;
  const saved = localStorage.getItem(KEY);
  if (saved && LANGS.includes(saved)) return saved;
  const nav = (navigator.languages || [navigator.language || '']).map((l) => String(l).slice(0, 2).toLowerCase());
  return nav.find((l) => LANGS.includes(l)) || 'lv';
}

export function setLang(lang, { persist = true } = {}) {
  if (!LANGS.includes(lang)) lang = 'lv';
  current = lang;
  document.documentElement.lang = lang;
  if (persist) {
    localStorage.setItem(KEY, lang);
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return lang;
}

export const getLang = () => current;
export const locale = () => ({ lv: 'lv-LV', ru: 'ru-RU', en: 'en-GB' })[current];

export function t(key, vars) {
  let s = D[current][key] ?? D.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

// Name of a reference row in the current language: {name_lv,...} (DB) or {name:{lv,...}} (js/data.js)
export function nameOf(row) {
  if (!row) return '';
  if (row.name && typeof row.name === 'object') return row.name[current] || row.name.en || '';
  return row['name_' + current] || row.name_en || row.name || '';
}
export function labelOf(obj) {
  if (!obj) return '';
  if (obj.label && typeof obj.label === 'object') return obj.label[current] || obj.label.en || '';
  return obj['label_' + current] || obj.label_en || '';
}

export const missingKeys = (lang) => Object.keys(D.en).filter((k) => !(k in D[lang]));
