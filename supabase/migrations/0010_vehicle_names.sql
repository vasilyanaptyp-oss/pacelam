-- 0010: vehicle names without codes, limits with < and > instead of words (client's edit, 23.09.2026: tow trucks
-- and every type with a payload limit).
-- The codes stay as keys (postings, vehicles and saved searches point to them); only the names change,
-- the same as js/data.js. Nothing is removed.

update public.vehicle_types set name_lv = 'Evakuators < 5 t', name_ru = 'Эвакуатор < 5 т', name_en = 'Tow truck < 5 t' where code = 'VT08';
update public.vehicle_types set name_lv = 'Evakuators > 5 t', name_ru = 'Эвакуатор > 5 т', name_en = 'Tow truck > 5 t' where code = 'VT09';
update public.vehicle_types set name_lv = 'Slēgts kravas auto < 10 t', name_ru = 'Закрытый грузовик < 10 т', name_en = 'Box truck < 10 t' where code = 'VT10';
update public.vehicle_types set name_lv = 'Kravas auto ar manipulatoru < 6 m, < 13 t', name_ru = 'Грузовик с манипулятором < 6 м, < 13 т', name_en = 'Truck with crane < 6 m, < 13 t' where code = 'VT11';
update public.vehicle_types set name_lv = 'Kravas auto ar manipulatoru < 8 m, < 15 t', name_ru = 'Грузовик с манипулятором < 8 м, < 15 т', name_en = 'Truck with crane < 8 m, < 15 t' where code = 'VT12';
update public.vehicle_types set name_lv = 'Beramkravu vedējs < 12 m³, < 11 t', name_ru = 'Перевозчик сыпучих грузов < 12 м³, < 11 т', name_en = 'Bulk tipper < 12 m³, < 11 t' where code = 'VT20';
update public.vehicle_types set name_lv = 'Beramkravu vedējs < 48 m³, < 25 t', name_ru = 'Перевозчик сыпучих грузов < 48 м³, < 25 т', name_en = 'Bulk tipper < 48 m³, < 25 t' where code = 'VT21';
