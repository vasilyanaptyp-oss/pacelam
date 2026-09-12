// Places in the Baltics with coordinates, straight-line distances and the detour formula.
// Distances are great-circle (haversine). Roads in the Baltics follow geography closely enough
// for sorting and filtering; a routing service can replace this later without touching callers.

export const CITIES = [
  // Latvia
  ['Rīga', 'LV', 56.95, 24.11, 'Рига|Riga'],
  ['Daugavpils', 'LV', 55.87, 26.52, 'Даугавпилс'],
  ['Liepāja', 'LV', 56.51, 21.01, 'Лиепая|Liepaja'],
  ['Jelgava', 'LV', 56.65, 23.71, 'Елгава'],
  ['Jūrmala', 'LV', 56.97, 23.77, 'Юрмала|Jurmala'],
  ['Ventspils', 'LV', 57.39, 21.56, 'Вентспилс'],
  ['Rēzekne', 'LV', 56.51, 27.33, 'Резекне|Rezekne'],
  ['Valmiera', 'LV', 57.54, 25.43, 'Валмиера'],
  ['Jēkabpils', 'LV', 56.50, 25.86, 'Екабпилс|Jekabpils'],
  ['Ogre', 'LV', 56.82, 24.60, 'Огре'],
  ['Tukums', 'LV', 56.97, 23.15, 'Тукумс'],
  ['Salaspils', 'LV', 56.86, 24.35, 'Саласпилс'],
  ['Cēsis', 'LV', 57.31, 25.27, 'Цесис|Cesis'],
  ['Kuldīga', 'LV', 56.97, 21.96, 'Кулдига|Kuldiga'],
  ['Olaine', 'LV', 56.79, 23.94, 'Олайне'],
  ['Saldus', 'LV', 56.66, 22.49, 'Салдус'],
  ['Talsi', 'LV', 57.24, 22.59, 'Талси'],
  ['Dobele', 'LV', 56.62, 23.28, 'Добеле'],
  ['Krāslava', 'LV', 55.90, 27.17, 'Краслава|Kraslava'],
  ['Bauska', 'LV', 56.41, 24.19, 'Бауска'],
  ['Ludza', 'LV', 56.54, 27.72, 'Лудза'],
  ['Sigulda', 'LV', 57.15, 24.86, 'Сигулда'],
  ['Līvāni', 'LV', 56.35, 26.18, 'Ливаны|Livani'],
  ['Gulbene', 'LV', 57.18, 26.75, 'Гулбене'],
  ['Madona', 'LV', 56.85, 26.22, 'Мадона'],
  ['Limbaži', 'LV', 57.51, 24.71, 'Лимбажи|Limbazi'],
  ['Aizkraukle', 'LV', 56.60, 25.25, 'Айзкраукле'],
  ['Preiļi', 'LV', 56.29, 26.72, 'Прейли|Preili'],
  ['Balvi', 'LV', 57.13, 27.27, 'Балви'],
  ['Alūksne', 'LV', 57.42, 27.05, 'Алуксне|Aluksne'],
  ['Smiltene', 'LV', 57.42, 25.90, 'Смилтене'],
  ['Valka', 'LV', 57.78, 26.02, 'Валка'],
  ['Kandava', 'LV', 57.03, 22.78, 'Кандава'],
  ['Aizpute', 'LV', 56.72, 21.60, 'Айзпуте'],
  ['Grobiņa', 'LV', 56.53, 21.17, 'Гробиня|Grobina'],
  ['Ilūkste', 'LV', 55.98, 26.30, 'Илуксте|Ilukste'],
  ['Viļāni', 'LV', 56.55, 26.92, 'Виляны|Vilani'],
  ['Ķekava', 'LV', 56.83, 24.24, 'Кекава|Kekava'],
  ['Saulkrasti', 'LV', 57.26, 24.42, 'Саулкрасты'],
  ['Ādaži', 'LV', 57.08, 24.32, 'Адажи|Adazi'],
  ['Mārupe', 'LV', 56.90, 24.05, 'Марупе|Marupe'],
  ['Iecava', 'LV', 56.60, 24.20, 'Иецава'],
  ['Skrunda', 'LV', 56.68, 22.02, 'Скрунда'],
  ['Pļaviņas', 'LV', 56.62, 25.72, 'Плявиняс|Plavinas'],
  ['Varakļāni', 'LV', 56.61, 26.75, 'Варакляны|Varaklani'],
  ['Dagda', 'LV', 56.10, 27.53, 'Дагда'],
  ['Zilupe', 'LV', 56.38, 28.12, 'Зилупе'],
  ['Kārsava', 'LV', 56.78, 27.68, 'Карсава|Karsava'],
  ['Viesīte', 'LV', 56.35, 25.56, 'Виесите|Viesite'],
  ['Subate', 'LV', 56.00, 25.91, 'Субате'],
  ['Koknese', 'LV', 56.65, 25.43, 'Кокнесе'],
  ['Lielvārde', 'LV', 56.72, 24.80, 'Лиелварде|Lielvarde'],
  ['Baloži', 'LV', 56.87, 24.12, 'Баложи|Balozi'],
  ['Roja', 'LV', 57.50, 22.81, 'Роя'],
  ['Pāvilosta', 'LV', 56.89, 21.18, 'Павилоста|Pavilosta'],
  ['Priekule', 'LV', 56.44, 21.59, 'Приекуле'],
  ['Auce', 'LV', 56.46, 22.90, 'Ауце'],
  ['Brocēni', 'LV', 56.68, 22.57, 'Броцены|Broceni'],
  ['Stende', 'LV', 57.16, 22.53, 'Стенде'],
  ['Sabile', 'LV', 57.05, 22.57, 'Сабиле'],
  ['Cesvaine', 'LV', 56.97, 26.31, 'Цесвайне'],
  ['Lubāna', 'LV', 56.90, 26.71, 'Лубана|Lubana'],
  ['Rūjiena', 'LV', 57.90, 25.33, 'Руйиена|Rujiena'],
  ['Mazsalaca', 'LV', 57.86, 25.05, 'Мазсалаца'],
  ['Strenči', 'LV', 57.63, 25.69, 'Стренчи|Strenci'],
  ['Aloja', 'LV', 57.77, 24.88, 'Алоя'],
  ['Salacgrīva', 'LV', 57.75, 24.36, 'Салацгрива|Salacgriva'],
  ['Ainaži', 'LV', 57.86, 24.36, 'Айнажи|Ainazi'],
  ['Baldone', 'LV', 56.74, 24.40, 'Балдоне'],
  ['Skrīveri', 'LV', 56.64, 25.11, 'Скривери|Skriveri'],
  ['Nereta', 'LV', 56.20, 25.31, 'Нерета'],
  ['Aknīste', 'LV', 56.16, 25.75, 'Акнисте|Akniste'],
  ['Vecumnieki', 'LV', 56.60, 24.52, 'Вецумниеки'],
  // Lithuania
  ['Vilnius', 'LT', 54.69, 25.28, 'Вильнюс'],
  ['Kaunas', 'LT', 54.90, 23.90, 'Каунас'],
  ['Klaipėda', 'LT', 55.71, 21.13, 'Клайпеда|Klaipeda'],
  ['Šiauliai', 'LT', 55.93, 23.31, 'Шяуляй|Siauliai'],
  ['Panevėžys', 'LT', 55.73, 24.36, 'Паневежис|Panevezys'],
  ['Alytus', 'LT', 54.40, 24.05, 'Алитус'],
  ['Marijampolė', 'LT', 54.56, 23.35, 'Мариямполе|Marijampole'],
  ['Mažeikiai', 'LT', 56.31, 22.34, 'Мажейкяй|Mazeikiai'],
  ['Jonava', 'LT', 55.07, 24.28, 'Йонава'],
  ['Utena', 'LT', 55.50, 25.60, 'Утена'],
  ['Kėdainiai', 'LT', 55.29, 23.97, 'Кедайняй|Kedainiai'],
  ['Tauragė', 'LT', 55.25, 22.29, 'Таураге|Taurage'],
  ['Telšiai', 'LT', 55.98, 22.25, 'Тельшяй|Telsiai'],
  ['Ukmergė', 'LT', 55.25, 24.75, 'Укмерге|Ukmerge'],
  ['Visaginas', 'LT', 55.60, 26.44, 'Висагинас'],
  ['Palanga', 'LT', 55.92, 21.07, 'Паланга'],
  ['Plungė', 'LT', 55.91, 21.85, 'Плунге|Plunge'],
  ['Kretinga', 'LT', 55.89, 21.24, 'Кретинга'],
  ['Šilutė', 'LT', 55.35, 21.48, 'Шилуте|Silute'],
  ['Radviliškis', 'LT', 55.81, 23.54, 'Радвилишкис|Radviliskis'],
  ['Druskininkai', 'LT', 54.02, 23.97, 'Друскининкай'],
  ['Rokiškis', 'LT', 55.96, 25.59, 'Рокишкис|Rokiskis'],
  ['Biržai', 'LT', 56.20, 24.76, 'Биржай|Birzai'],
  ['Elektrėnai', 'LT', 54.79, 24.66, 'Электренай|Elektrenai'],
  ['Kuršėnai', 'LT', 56.00, 22.93, 'Куршенай|Kursenai'],
  ['Jurbarkas', 'LT', 55.08, 22.77, 'Юрбаркас'],
  ['Vilkaviškis', 'LT', 54.65, 23.03, 'Вилкавишкис|Vilkaviskis'],
  ['Raseiniai', 'LT', 55.38, 23.12, 'Расейняй'],
  ['Anykščiai', 'LT', 55.53, 25.10, 'Аникщяй|Anyksciai'],
  ['Zarasai', 'LT', 55.73, 26.25, 'Зарасай'],
  ['Naujoji Akmenė', 'LT', 56.32, 22.90, 'Науйойи-Акмяне|Naujoji Akmene'],
  ['Joniškis', 'LT', 56.24, 23.61, 'Йонишкис|Joniskis'],
  ['Pasvalys', 'LT', 56.06, 24.40, 'Пасвалис'],
  ['Kupiškis', 'LT', 55.84, 24.97, 'Купишкис|Kupiskis'],
  ['Šalčininkai', 'LT', 54.31, 25.39, 'Шальчининкай|Salcininkai'],
  ['Trakai', 'LT', 54.64, 24.93, 'Тракай'],
  ['Ignalina', 'LT', 55.34, 26.16, 'Игналина'],
  ['Švenčionys', 'LT', 55.13, 26.00, 'Швенчёнис|Svencionys'],
  ['Molėtai', 'LT', 55.23, 25.42, 'Молетай|Moletai'],
  ['Širvintos', 'LT', 55.05, 24.95, 'Ширвинтос|Sirvintos'],
  ['Kaišiadorys', 'LT', 54.86, 24.45, 'Кайшядорис|Kaisiadorys'],
  ['Prienai', 'LT', 54.63, 23.94, 'Пренай'],
  ['Šakiai', 'LT', 54.95, 23.05, 'Шакяй|Sakiai'],
  ['Kelmė', 'LT', 55.63, 22.93, 'Кельме|Kelme'],
  ['Skuodas', 'LT', 56.27, 21.53, 'Скуодас'],
  ['Pakruojis', 'LT', 55.98, 23.86, 'Пакруойис'],
  // Estonia
  ['Tallinn', 'EE', 59.44, 24.75, 'Таллин|Таллинн'],
  ['Tartu', 'EE', 58.38, 26.72, 'Тарту'],
  ['Narva', 'EE', 59.38, 28.19, 'Нарва'],
  ['Pärnu', 'EE', 58.39, 24.50, 'Пярну|Parnu'],
  ['Kohtla-Järve', 'EE', 59.40, 27.27, 'Кохтла-Ярве|Kohtla-Jarve'],
  ['Viljandi', 'EE', 58.36, 25.59, 'Вильянди'],
  ['Rakvere', 'EE', 59.35, 26.36, 'Раквере'],
  ['Maardu', 'EE', 59.47, 25.03, 'Маарду'],
  ['Kuressaare', 'EE', 58.25, 22.49, 'Курессааре'],
  ['Sillamäe', 'EE', 59.40, 27.76, 'Силламяэ|Sillamae'],
  ['Valga', 'EE', 57.78, 26.05, 'Валга'],
  ['Võru', 'EE', 57.83, 27.02, 'Выру|Voru'],
  ['Jõhvi', 'EE', 59.36, 27.42, 'Йыхви|Johvi'],
  ['Haapsalu', 'EE', 58.94, 23.54, 'Хаапсалу'],
  ['Keila', 'EE', 59.30, 24.41, 'Кейла'],
  ['Paide', 'EE', 58.89, 25.56, 'Пайде'],
  ['Põlva', 'EE', 58.06, 27.06, 'Пылва|Polva'],
  ['Jõgeva', 'EE', 58.75, 26.39, 'Йыгева|Jogeva'],
  ['Türi', 'EE', 58.81, 25.43, 'Тюри|Turi'],
  ['Elva', 'EE', 58.22, 26.42, 'Элва'],
  ['Rapla', 'EE', 59.01, 24.79, 'Рапла'],
  ['Saue', 'EE', 59.32, 24.55, 'Сауэ'],
  ['Põltsamaa', 'EE', 58.65, 25.97, 'Пылтсамаа|Poltsamaa'],
  ['Kiviõli', 'EE', 59.35, 26.97, 'Кивиыли|Kivioli'],
  ['Tapa', 'EE', 59.26, 25.96, 'Тапа'],
  ['Otepää', 'EE', 58.06, 26.50, 'Отепя|Otepaa'],
  ['Tõrva', 'EE', 58.00, 25.93, 'Тырва|Torva'],
  ['Räpina', 'EE', 58.10, 27.46, 'Ряпина|Rapina'],
].map(([name, country, lat, lng, aliases]) => ({ name, country, lat, lng, aliases: aliases ? aliases.split('|') : [] }));

const R = 6371;
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Detour: extra kilometres a cargo adds to my route A→B.
//   detour = d(A, cargoFrom) + d(cargoFrom, cargoTo) + d(cargoTo, B) − d(A, B)
export function detourKm(route, from, to) {
  const direct = haversineKm(route.from.lat, route.from.lng, route.to.lat, route.to.lng);
  const via = haversineKm(route.from.lat, route.from.lng, from.lat, from.lng)
    + haversineKm(from.lat, from.lng, to.lat, to.lng)
    + haversineKm(to.lat, to.lng, route.to.lat, route.to.lng);
  return Math.max(0, via - direct);
}

export const fold = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/ё/g, 'е')
  .trim();

export function searchCities(query, limit = 8) {
  const q = fold(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const city of CITIES) {
    const keys = [city.name, ...city.aliases].map(fold);
    if (keys.some((k) => k.startsWith(q))) starts.push(city);
    else if (keys.some((k) => k.includes(q))) contains.push(city);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function nearestCity(lat, lng) {
  let best = null;
  let bestD = Infinity;
  for (const city of CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < bestD) { bestD = d; best = city; }
  }
  return { city: best, distanceKm: bestD };
}

export const findCity = (name) => CITIES.find((c) => c.name === name) || null;
