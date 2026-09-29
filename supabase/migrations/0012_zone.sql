-- 0012: the carrier's zone and the time in an offer (client's edits, 29.09.2026).
-- A carrier keeps his vehicles and a zone in the profile: his base town and a radius (50 km by default). Every new
-- cargo that starts or ends in that zone, whichever way it goes, and fits one of his vehicles reaches him as a
-- notification. An offer now also says when the carrier can do the job, so the customer sees price and time
-- together. Nothing is removed: two columns, one trigger and one function are added; place_bid stays as it is.

alter table public.profiles add column if not exists zone_km int not null default 50 check (zone_km between 0 and 500);
alter table public.bids add column if not exists can_date date;

-- After a cargo is inserted: every carrier whose zone holds its pickup or its drop-off and who has a fitting
-- vehicle (any carrier of the zone when the customer did not ask for a vehicle), once per person and posting —
-- a saved search, the "offer my cargo" link or a pair on the way may already have told him.
create or replace function public.postings_notify_zone() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.kind <> 'cargo' or new.status <> 'open' then return new; end if;
  for r in
    select pr.id from profiles pr
    where pr.role = 'carrier' and pr.id <> new.owner_id and pr.zone_km > 0 and pr.city_lat is not null and pr.city_lng is not null
      and (haversine_km(pr.city_lat, pr.city_lng, new.from_lat, new.from_lng) <= pr.zone_km + new.from_radius_km
           or haversine_km(pr.city_lat, pr.city_lng, new.to_lat, new.to_lng) <= pr.zone_km + new.to_radius_km)
      and (new.vehicle_type_code is null
           or exists (select 1 from vehicles v where v.owner_id = pr.id and v.type_code = new.vehicle_type_code))
  loop
    if not exists (select 1 from notifications where user_id = r.id and posting_id = new.id) then
      perform notify_user(r.id, 'match', new.id, null, null,
        jsonb_build_object('from', new.from_name, 'to', new.to_name, 'kind', 'cargo', 'mode', new.mode, 'zone', true));
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists postings_notify_zone on public.postings;
create trigger postings_notify_zone after insert on public.postings
  for each row execute function public.postings_notify_zone();

-- An offer with the day the carrier can do it. All the rules of place_bid (0011) apply: only a carrier names a
-- price on cargo, the same price again notifies nobody. The day is today or later (a day of grace for another
-- time zone) and not more than 90 days ahead; the customer's notice carries it.
create or replace function public.place_offer(p_posting uuid, p_amount numeric, p_note text default null, p_can_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Riga')::date;
  v_bid uuid;
begin
  if p_can_date is not null and (p_can_date < v_today - 1 or p_can_date > v_today + 90) then
    raise exception 'date out of range' using errcode = '22023';
  end if;
  v_bid := place_bid(p_posting, p_amount, p_note);
  update bids set can_date = p_can_date where id = v_bid;
  if p_can_date is not null then
    update notifications set payload = payload || jsonb_build_object('can_date', p_can_date)
    where bid_id = v_bid and type = 'bid' and created_at >= now();
  end if;
  return v_bid;
end $$;
revoke all on function public.place_offer(uuid, numeric, text, date) from public, anon;
grant execute on function public.place_offer(uuid, numeric, text, date) to authenticated;
