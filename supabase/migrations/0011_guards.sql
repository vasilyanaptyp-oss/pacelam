-- 0011: guards found by the audit of 23.09.2026 (A-007, A-008, A-014, A-015, A-016, A-017, A-045).
-- Nothing is removed: two functions are replaced with the same signature, one trigger is added, one grant narrowed.

-- A-017: only a carrier names a price on a cargo (decision of 23.09.2026). A customer's account could still call
-- place_bid through the REST API and become "the carrier" of a deal.
-- A-015: the owner hears about a new price, not about the same price sent again, and not more than once a minute
-- about one offer — a carrier cannot flood a customer by re-sending his offer.
create or replace function public.place_bid(p_posting uuid, p_amount numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p postings%rowtype;
  v_old bids%rowtype;
  v_bid uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = v_uid) then raise exception 'profile required' using errcode = 'P0001'; end if;
  select * into p from postings where id = p_posting for update;
  if not found then raise exception 'posting not found' using errcode = 'P0002'; end if;
  if p.owner_id = v_uid then raise exception 'own posting' using errcode = 'P0001'; end if;
  if p.status <> 'open' then raise exception 'posting is not open' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive' using errcode = '22023'; end if;
  if p.kind = 'cargo' and not exists (select 1 from profiles where id = v_uid and role = 'carrier') then
    raise exception 'only carriers offer a price on cargo' using errcode = 'P0001';
  end if;
  select * into v_old from bids where posting_id = p_posting and bidder_id = v_uid;
  insert into bids (posting_id, bidder_id, amount, note, status)
  values (p_posting, v_uid, round(p_amount, 2), nullif(left(coalesce(p_note, ''), 300), ''), 'active')
  on conflict (posting_id, bidder_id) do update
    set amount = excluded.amount, note = excluded.note, status = 'active', updated_at = now()
  returning id into v_bid;
  if (v_old.id is null or v_old.status <> 'active' or v_old.amount <> round(p_amount, 2))
     and not exists (select 1 from notifications n where n.user_id = p.owner_id and n.bid_id = v_bid and n.type = 'bid'
                     and n.created_at > now() - interval '1 minute') then
    perform notify_user(p.owner_id, 'bid', p.id, v_bid, null,
      jsonb_build_object('amount', round(p_amount, 2), 'from', p.from_name, 'to', p.to_name,
                         'above_price', (p.price is not null and p_amount > p.price), 'urgent', (p.mode = 'urgent')));
  end if;
  return v_bid;
end $$;

-- A-016: one person with several matching saved searches gets one notification per posting, like 0006 and 0008.
create or replace function public.postings_match_searches() returns trigger language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  for s in
    select distinct on (ss.owner_id) ss.* from saved_searches ss
    where ss.is_active
      and ss.kind = new.kind
      and ss.owner_id <> new.owner_id
      and new.mode = any (ss.modes)
      and (cardinality(ss.vehicle_type_codes) = 0 or new.vehicle_type_code is null or new.vehicle_type_code = any (ss.vehicle_type_codes))
      and (cardinality(ss.cargo_type_ids) = 0 or new.cargo_type_id is null or new.cargo_type_id = any (ss.cargo_type_ids))
      and haversine_km(ss.center_lat, ss.center_lng, new.from_lat, new.from_lng) <= ss.radius_km + new.from_radius_km
      and (ss.dest_lat is null or haversine_km(ss.dest_lat, ss.dest_lng, new.to_lat, new.to_lng) <= coalesce(ss.dest_radius_km, 0) + new.to_radius_km)
    order by ss.owner_id, ss.created_at
  loop
    if not exists (select 1 from notifications where user_id = s.owner_id and posting_id = new.id) then
      perform notify_user(s.owner_id, 'match', new.id, null, null,
        jsonb_build_object('search_id', s.id, 'from', new.from_name, 'to', new.to_name, 'kind', new.kind, 'mode', new.mode, 'price', new.price));
    end if;
  end loop;
  return new;
end $$;

-- A-007, A-008, A-014: what the forms check, the database checks too — a posting from a town to the same town,
-- zero or negative sizes, weight or price, and (for a new posting) dates already over by the clock of Riga —
-- with a day of grace for a phone in another time zone: the forms themselves never offer a past day.
create or replace function public.postings_sanity() returns trigger language plpgsql as $$
begin
  if is_privileged() then return new; end if;
  if lower(btrim(new.from_name)) = lower(btrim(new.to_name)) then
    raise exception 'from and to must differ' using errcode = '22023';
  end if;
  if coalesce(new.weight_kg, 1) <= 0 or coalesce(new.volume_m3, 1) <= 0 or coalesce(new.length_m, 1) <= 0
     or coalesce(new.width_m, 1) <= 0 or coalesce(new.height_m, 1) <= 0 then
    raise exception 'sizes must be positive' using errcode = '22023';
  end if;
  if new.price is not null and new.price <= 0 then
    raise exception 'price must be positive' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and new.date_to < (now() at time zone 'Europe/Riga')::date - 1 then
    raise exception 'dates are in the past' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists postings_sanity on public.postings;
create trigger postings_sanity before insert or update on public.postings
  for each row execute function public.postings_sanity();

-- A-045: who pays for a subscription is nobody else's business. Only database functions (security definer)
-- call is_subscribed; a browser does not need it.
revoke execute on function public.is_subscribed(uuid) from anon, authenticated;
