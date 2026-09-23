-- 0008: the exchange finds pairs by itself and tells both sides (client, 18.09.2026):
--   22:37 «создать груз → получить подходящие машины → сравнить предложения → выбрать перевозчика.
--          И отдельно: перевозчик → указал свой маршрут → увидел грузы по пути → сразу предложил цену»;
--   22:41 «пусть система находит что рядом и объединяет, и приходят уведомления и заказчику и перевозчику …
--          или заказчик … может просто отправить ещё раз уведомление перевозчику, чтобы он ещё раз мог
--          обратить внимание».
-- A cargo fits a truck when the detour it adds to the truck's route is within that carrier's max_detour_km
-- and their days overlap. Nothing is removed: two functions, one trigger and one call are added.

create or replace function public.detour_km(r_from_lat double precision, r_from_lng double precision, r_to_lat double precision, r_to_lng double precision,
                                             c_from_lat double precision, c_from_lng double precision, c_to_lat double precision, c_to_lng double precision)
returns double precision language sql immutable set search_path = public as $$
  select greatest(0, haversine_km(r_from_lat, r_from_lng, c_from_lat, c_from_lng)
                   + haversine_km(c_from_lat, c_from_lng, c_to_lat, c_to_lng)
                   + haversine_km(c_to_lat, c_to_lng, r_to_lat, r_to_lng)
                   - haversine_km(r_from_lat, r_from_lng, r_to_lat, r_to_lng))
$$;

-- After a posting is inserted: tell the other side of every fitting pair, once per person and posting
-- (a saved search or the "offer my cargo" link may already have told him).
create or replace function public.postings_notify_pairs() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.status <> 'open' then return new; end if;
  if new.kind = 'cargo' then
    for r in
      select t.owner_id, min(t.id::text)::uuid as truck_id
      from postings t join profiles pr on pr.id = t.owner_id
      where t.kind = 'truck' and t.status = 'open' and t.owner_id <> new.owner_id
        and t.date_from <= new.date_to and new.date_from <= t.date_to
        and detour_km(t.from_lat, t.from_lng, t.to_lat, t.to_lng, new.from_lat, new.from_lng, new.to_lat, new.to_lng) <= coalesce(pr.max_detour_km, 60)
      group by t.owner_id
    loop
      if not exists (select 1 from notifications where user_id = r.owner_id and posting_id = new.id) then
        perform notify_user(r.owner_id, 'match', new.id, null, null,
          jsonb_build_object('from', new.from_name, 'to', new.to_name, 'kind', 'cargo', 'mode', new.mode, 'for_truck', r.truck_id));
      end if;
    end loop;
  else
    for r in
      select c.owner_id, min(c.id::text)::uuid as cargo_id
      from postings c, profiles pr
      where pr.id = new.owner_id
        and c.kind = 'cargo' and c.status = 'open' and c.owner_id <> new.owner_id
        and c.date_from <= new.date_to and new.date_from <= c.date_to
        and detour_km(new.from_lat, new.from_lng, new.to_lat, new.to_lng, c.from_lat, c.from_lng, c.to_lat, c.to_lng) <= coalesce(pr.max_detour_km, 60)
      group by c.owner_id
    loop
      if not exists (select 1 from notifications where user_id = r.owner_id and posting_id = new.id) then
        perform notify_user(r.owner_id, 'match', new.id, null, null,
          jsonb_build_object('from', new.from_name, 'to', new.to_name, 'kind', 'truck', 'for_cargo', r.cargo_id));
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists postings_notify_pairs on public.postings;
create trigger postings_notify_pairs after insert on public.postings
  for each row execute function public.postings_notify_pairs();

-- "Call him again": the owner of an open cargo reminds the carrier of an open truck about it, once per pair.
create or replace function public.nudge_truck(p_cargo uuid, p_truck uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c postings%rowtype;
  tr postings%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from postings where id = p_cargo;
  if not found or c.owner_id <> v_uid or c.kind <> 'cargo' or c.status <> 'open' then
    raise exception 'posting not found or not open' using errcode = 'P0002';
  end if;
  select * into tr from postings where id = p_truck;
  if not found or tr.kind <> 'truck' or tr.status <> 'open' or tr.owner_id = v_uid then
    raise exception 'posting not found or not open' using errcode = 'P0002';
  end if;
  if exists (select 1 from notifications where user_id = tr.owner_id and posting_id = c.id and payload->>'nudge' = 'true') then
    return;   -- once per pair: a second tap changes nothing
  end if;
  perform notify_user(tr.owner_id, 'match', c.id, null, null,
    jsonb_build_object('from', c.from_name, 'to', c.to_name, 'kind', 'cargo', 'mode', c.mode, 'for_truck', tr.id, 'nudge', true));
end $$;

revoke all on function public.detour_km(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) from public;
grant execute on function public.detour_km(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) to anon, authenticated;
revoke all on function public.nudge_truck(uuid, uuid) from public, anon;
grant execute on function public.nudge_truck(uuid, uuid) to authenticated;
revoke all on function public.postings_notify_pairs() from public, anon, authenticated;
