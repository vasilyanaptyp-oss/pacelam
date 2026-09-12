// Reference data shared by the front-end (demo mode) and the SQL seed (scripts/gen-seed.mjs).
// Vehicle types come from docs/vehicle-types.json — codes VT are the ones carriers already know
// from the exchange they use today. Gaps in numbering (VT03, VT07, VT13, VT14) are in the source.

export const VEHICLE_GROUPS = [
  { id: 'light', sort: 1, name: { lv: 'Vieglie auto', ru: 'Легковые автомобили', en: 'Cars' } },
  { id: 'van', sort: 2, name: { lv: 'Mikroautobusi', ru: 'Микроавтобусы', en: 'Vans' } },
  { id: 'tow', sort: 3, name: { lv: 'Evakuatori', ru: 'Эвакуаторы', en: 'Tow trucks' } },
  { id: 'truck', sort: 4, name: { lv: 'Kravas auto', ru: 'Грузовые', en: 'Trucks' } },
  { id: 'other', sort: 5, name: { lv: 'Citi', ru: 'Другие типы', en: 'Other' } },
  { id: 'ltl', sort: 6, name: { lv: 'LTL — daļēja krava', ru: 'LTL — меньше, чем грузовик', en: 'LTL — less than truckload' } },
];

export const VEHICLE_TYPES = [
  { code: 'VT01', group: 'light', sort: 1, name: { lv: 'Vieglais auto', ru: 'Легковой', en: 'Passenger car' } },
  { code: 'VT02', group: 'light', sort: 2, name: { lv: 'Apvidus auto', ru: 'Внедорожник', en: 'SUV / off-road' } },
  { code: 'VT04', group: 'van', sort: 3, name: { lv: 'Kravas mikroautobuss', ru: 'Грузовой микроавтобус', en: 'Cargo van' } },
  { code: 'VT05', group: 'van', sort: 4, name: { lv: 'Tentēts mikroautobuss', ru: 'Тентованный микроавтобус', en: 'Curtain-side van' } },
  { code: 'VT06', group: 'van', sort: 5, name: { lv: 'Mikroautobuss ar platformu', ru: 'Грузовой микроавтобус с платформой', en: 'Flatbed van' } },
  { code: 'VT061', group: 'van', sort: 6, name: { lv: 'Mikroautobuss ar platformu un manipulatoru', ru: 'Грузовой микроавтобус с платформой и манипулятором', en: 'Flatbed van with crane' } },
  { code: 'VT08', group: 'tow', sort: 7, tonnage_to: 5, name: { lv: 'Evakuators līdz 5 t', ru: 'Эвакуатор до 5 т', en: 'Tow truck up to 5 t' } },
  { code: 'VT09', group: 'tow', sort: 8, tonnage_from: 5, name: { lv: 'Evakuators no 5 t', ru: 'Эвакуатор от 5 т', en: 'Tow truck over 5 t' } },
  { code: 'VT10', group: 'truck', sort: 9, tonnage_to: 10, name: { lv: 'Slēgts kravas auto līdz 10 t', ru: 'Закрытый грузовик до 10 т', en: 'Box truck up to 10 t' } },
  { code: 'VT11', group: 'truck', sort: 10, length_m: 6, tonnage_to: 13, name: { lv: 'Kravas auto līdz 6 m ar manipulatoru, līdz 13 t', ru: 'Грузовик до 6 м с манипулятором, до 13 т', en: 'Truck up to 6 m with crane, up to 13 t' } },
  { code: 'VT12', group: 'truck', sort: 11, length_m: 8, tonnage_to: 15, name: { lv: 'Kravas auto līdz 8 m ar manipulatoru, līdz 15 t', ru: 'Грузовик до 8 м с манипулятором, до 15 т', en: 'Truck up to 8 m with crane, up to 15 t' } },
  { code: 'VT15', group: 'truck', sort: 12, name: { lv: 'Vilcējs ar platformas puspiekabi', ru: 'Грузовик с полуприцепом-платформой', en: 'Truck with flatbed semi-trailer' } },
  { code: 'VT22', group: 'truck', sort: 13, refrigerated: true, name: { lv: 'Kravas auto ar temperatūras kontroli', ru: 'Грузовик с контролем температуры', en: 'Temperature-controlled truck' } },
  { code: 'VT16', group: 'truck', sort: 14, name: { lv: 'Vilcējs ar tentētu puspiekabi', ru: 'Грузовик с тентованным полуприцепом', en: 'Truck with curtain-side semi-trailer' } },
  { code: 'VT17', group: 'truck', sort: 15, name: { lv: 'Vilcējs ar puspiekabi un nolaižamu rampu', ru: 'Грузовик с полуприцепом и откидной рампой', en: 'Truck with semi-trailer and tail ramp' } },
  { code: 'VT151', group: 'truck', sort: 16, name: { lv: 'Konteineru vedējs', ru: 'Грузовик для контейнеров', en: 'Container truck' } },
  { code: 'VT18', group: 'truck', sort: 17, oversize: true, name: { lv: 'Negabarīta kravu vedējs', ru: 'Грузовик для негабаритных грузов', en: 'Oversize cargo truck' } },
  { code: 'VT20', group: 'truck', sort: 18, volume_m3: 12, tonnage_to: 11, bulk: true, name: { lv: 'Beramkravu vedējs, līdz 12 m³ un 11 t', ru: 'Перевозчик сыпучих грузов, до 12 м³ и 11 т', en: 'Bulk tipper, up to 12 m³ and 11 t' } },
  { code: 'VT21', group: 'truck', sort: 19, volume_m3: 48, tonnage_to: 25, bulk: true, name: { lv: 'Beramkravu vedējs, līdz 48 m³ un 25 t', ru: 'Перевозчик сыпучих грузов, до 48 м³ и 25 т', en: 'Bulk tipper, up to 48 m³ and 25 t' } },
  { code: 'VT19', group: 'other', sort: 20, name: { lv: 'Autovedējs', ru: 'Автовоз', en: 'Car carrier' } },
  // Top-level item without subtypes: part cargo that does not fill a truck — the key case for a backload exchange.
  { code: 'LTL', group: 'ltl', sort: 21, ltl: true, name: { lv: 'Daļēja krava (piekrava)', ru: 'Догруз (LTL)', en: 'Part load (LTL)' } },
];

// Cargo categories are PROVISIONAL (approved by the client: "пока взять что даёт приложение").
// Each category carries its own extra fields as data; the code never depends on concrete values.
// Field types: bool | choice | number | text
export const CARGO_TYPES = [
  { id: 'pallets', sort: 1, provisional: true, name: { lv: 'Paletes', ru: 'Паллеты', en: 'Pallets' },
    fields: [
      { key: 'pallet_count', type: 'number', min: 1, max: 66, label: { lv: 'Palešu skaits', ru: 'Количество паллет', en: 'Number of pallets' } },
      { key: 'stackable', type: 'bool', label: { lv: 'Var kraut vienu uz otras', ru: 'Можно ставить друг на друга', en: 'Stackable' } },
    ] },
  { id: 'bulk', sort: 2, provisional: true, name: { lv: 'Beramkrava', ru: 'Сыпучие', en: 'Bulk' },
    fields: [
      { key: 'material', type: 'choice', label: { lv: 'Materiāls', ru: 'Материал', en: 'Material' },
        options: [
          { value: 'sand', label: { lv: 'Smilts', ru: 'Песок', en: 'Sand' } },
          { value: 'gravel', label: { lv: 'Šķembas / grants', ru: 'Щебень / гравий', en: 'Gravel' } },
          { value: 'soil', label: { lv: 'Melnzeme / grunts', ru: 'Грунт / чернозём', en: 'Soil' } },
          { value: 'other', label: { lv: 'Cits', ru: 'Другое', en: 'Other' } },
        ] },
    ] },
  { id: 'oversize', sort: 3, provisional: true, name: { lv: 'Negabarīts', ru: 'Негабарит', en: 'Oversize' },
    fields: [
      { key: 'escort_needed', type: 'bool', label: { lv: 'Vajadzīga pavadmašīna', ru: 'Нужно сопровождение', en: 'Escort needed' } },
    ] },
  { id: 'machinery', sort: 4, provisional: true, name: { lv: 'Tehnika', ru: 'Техника', en: 'Machinery' },
    fields: [
      { key: 'self_propelled', type: 'bool', label: { lv: 'Brauc pati', ru: 'Едет своим ходом', en: 'Self-propelled' } },
      { key: 'tracked', type: 'bool', label: { lv: 'Uz kāpurķēdēm', ru: 'На гусеницах', en: 'Tracked' } },
    ] },
  { id: 'building', sort: 5, provisional: true, name: { lv: 'Būvmateriāli', ru: 'Стройматериалы', en: 'Building materials' },
    fields: [
      { key: 'packed', type: 'choice', label: { lv: 'Iepakojums', ru: 'Упаковка', en: 'Packaging' },
        options: [
          { value: 'pallets', label: { lv: 'Uz paletēm', ru: 'На паллетах', en: 'On pallets' } },
          { value: 'bags', label: { lv: 'Maisos / big-bag', ru: 'В мешках / биг-бэг', en: 'Bags / big-bags' } },
          { value: 'loose', label: { lv: 'Bez iepakojuma', ru: 'Без упаковки', en: 'Loose' } },
        ] },
    ] },
  { id: 'vehicle', sort: 6, provisional: true, name: { lv: 'Automašīna', ru: 'Автомобиль', en: 'Vehicle' },
    fields: [
      { key: 'rolls', type: 'bool', label: { lv: 'Ripo', ru: 'Катится', en: 'Rolls' } },
      { key: 'all_wheels', type: 'bool', label: { lv: 'Visi riteņi uz vietas', ru: 'Все колёса на месте', en: 'All wheels in place' } },
      { key: 'location', type: 'choice', label: { lv: 'Kur atrodas', ru: 'Где стоит', en: 'Where it is' },
        options: [
          { value: 'parking', label: { lv: 'Stāvvietā', ru: 'На парковке', en: 'Parking lot' } },
          { value: 'roadside', label: { lv: 'Ceļa malā', ru: 'На обочине', en: 'Roadside' } },
          { value: 'garage', label: { lv: 'Garāžā / boksā', ru: 'В гараже / боксе', en: 'Garage' } },
        ] },
      { key: 'model', type: 'text', maxlength: 60, label: { lv: 'Marka un modelis', ru: 'Марка и модель', en: 'Make and model' } },
    ] },
  { id: 'other', sort: 7, provisional: true, name: { lv: 'Cits', ru: 'Прочее', en: 'Other' }, fields: [] },
];

export const vehicleType = (code) => VEHICLE_TYPES.find((t) => t.code === code) || null;
export const cargoType = (id) => CARGO_TYPES.find((t) => t.id === id) || null;
