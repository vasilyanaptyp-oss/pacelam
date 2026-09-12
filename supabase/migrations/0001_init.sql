-- Paceļam — backload exchange for Latvia and the Baltics.
-- Migration 0001: schema, row-level security, business functions, notifications.
--
-- Security model in one paragraph: everything a browser can read is governed by RLS on the
-- database side. Phones and e-mails live in profile_contacts, a table nobody can read except
-- the owner and users who hold a row in contact_unlocks for that owner. contact_unlocks rows
-- are written only by the deal functions below (security definer), never by clients.
-- All state changes of bids and deals go through those functions too; direct writes are revoked.

create schema if not exists public;

-- ---------------------------------------------------------------------------------------
-- Settings (read by everyone, written only from the dashboard / service role)
-- ---------------------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('free_delay_minutes', '0'),        -- visibility delay for non-subscribers; 0 = everyone sees at once
  ('board_open_to_visitors', 'true')   -- anonymous visitors can read open postings
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------------------
create table if not exists public.vehicle_groups (
  id text primary key,
  sort int not null,
  name_lv text not null, name_ru text not null, name_en text not null
);

create table if not exists public.vehicle_types (
  code text primary key,
  group_id text not null references public.vehicle_groups(id),
  sort int not null,
  name_lv text not null, name_ru text not null, name_en text not null,
  tonnage_from numeric(6,2), tonnage_to numeric(6,2), length_m numeric(5,2), volume_m3 numeric(6,1),
  flags jsonb not null default '{}'::jsonb
);

-- Cargo categories are provisional: the list is data, each row carries its own extra fields.
create table if not exists public.cargo_types (
  id text primary key,
  sort int not null,
  name_lv text not null, name_ru text not null, name_en text not null,
  fields jsonb not null default '[]'::jsonb,
  is_provisional boolean not null default true,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------------------
-- Profiles: public part and protected contacts
-- ---------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('carrier', 'customer')),
  display_name text not null check (char_length(display_name) between 1 and 80),
  city_name text,
  city_lat double precision,
  city_lng double precision,
  lang text not null default 'lv' check (lang in ('lv', 'ru', 'en')),
  max_detour_km int not null default 60 check (max_detour_km between 0 and 1000),
  is_operator boolean not null default false,          -- dispatcher posting on behalf of callers
  subscription_until timestamptz,                       -- future paid tier; null = free
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text not null check (phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  company text check (company is null or char_length(company) <= 120),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type_code text not null references public.vehicle_types(code),
  plate text check (plate is null or char_length(plate) <= 16),
  tonnage_t numeric(6,2) check (tonnage_t is null or tonnage_t >= 0),
  volume_m3 numeric(6,1) check (volume_m3 is null or volume_m3 >= 0),
  length_m numeric(5,2) check (length_m is null or length_m >= 0),
  width_m numeric(4,2) check (width_m is null or width_m >= 0),
  height_m numeric(4,2) check (height_m is null or height_m >= 0),
  note text check (note is null or char_length(note) <= 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists vehicles_owner_idx on public.vehicles(owner_id);

-- ---------------------------------------------------------------------------------------
-- Postings: one table for both kinds (cargo looking for a truck / truck looking for cargo)
-- ---------------------------------------------------------------------------------------
create table if not exists public.postings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cargo', 'truck')),
  mode text not null default 'planned' check (mode in ('urgent', 'planned')),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  from_name text not null check (char_length(from_name) between 1 and 80),
  from_lat double precision not null check (from_lat between -90 and 90),
  from_lng double precision not null check (from_lng between -180 and 180),
  from_radius_km int not null default 0 check (from_radius_km between 0 and 300),
  to_name text not null check (char_length(to_name) between 1 and 80),
  to_lat double precision not null check (to_lat between -90 and 90),
  to_lng double precision not null check (to_lng between -180 and 180),
  to_radius_km int not null default 0 check (to_radius_km between 0 and 300),
  date_from date not null,
  date_to date not null,
  vehicle_type_code text references public.vehicle_types(code),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  cargo_type_id text references public.cargo_types(id),
  weight_kg int check (weight_kg is null or weight_kg between 0 and 100000),
  length_m numeric(5,2) check (length_m is null or length_m between 0 and 60),
  width_m numeric(4,2) check (width_m is null or width_m between 0 and 10),
  height_m numeric(4,2) check (height_m is null or height_m between 0 and 10),
  volume_m3 numeric(6,1) check (volume_m3 is null or volume_m3 between 0 and 500),
  cargo_fields jsonb not null default '{}'::jsonb,
  photos text[] not null default '{}',
  price numeric(10,2) check (price is null or price >= 0),   -- cargo: instant-win price; truck: asking price
  currency text not null default 'EUR' check (currency in ('EUR')),
  note text check (note is null or char_length(note) <= 600),
  status text not null default 'open' check (status in ('open', 'pending', 'deal', 'closed', 'cancelled')),
  is_operator_posting boolean not null default false,
  bid_count int not null default 0,
  best_bid numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint postings_dates check (date_to >= date_from),
  constraint postings_truck_mode check (kind = 'cargo' or mode = 'planned'),
  constraint postings_photos_max check (coalesce(array_length(photos, 1), 0) <= 4)
);
create index if not exists postings_feed_idx on public.postings(status, date_to, created_at desc);
create index if not exists postings_owner_idx on public.postings(owner_id);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.postings(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0 and amount < 1000000),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'active' check (status in ('active', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (posting_id, bidder_id)
);
create index if not exists bids_posting_idx on public.bids(posting_id);
create index if not exists bids_bidder_idx on public.bids(bidder_id);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null unique references public.postings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  carrier_id uuid not null references public.profiles(id) on delete cascade,
  bid_id uuid references public.bids(id) on delete set null,
  amount numeric(10,2) check (amount is null or amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  customer_confirmed_at timestamptz,
  carrier_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_parties check (customer_id <> carrier_id)
);
create index if not exists deals_customer_idx on public.deals(customer_id);
create index if not exists deals_carrier_idx on public.deals(carrier_id);

-- Who may read whose contacts. Written by deal functions only.
create table if not exists public.contact_unlocks (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (viewer_id, owner_id)
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text check (name is null or char_length(name) <= 60),
  kind text not null check (kind in ('cargo', 'truck')),          -- what I am looking for
  center_name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km int not null default 50 check (radius_km between 0 and 500),
  dest_name text,
  dest_lat double precision,
  dest_lng double precision,
  dest_radius_km int check (dest_radius_km is null or dest_radius_km between 0 and 500),
  vehicle_type_codes text[] not null default '{}',
  cargo_type_ids text[] not null default '{}',
  modes text[] not null default '{urgent,planned}',
  notify_browser boolean not null default true,
  notify_email boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_owner_idx on public.saved_searches(owner_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('match', 'bid', 'accepted', 'deal', 'taken', 'cancelled')),
  posting_id uuid references public.postings(id) on delete cascade,
  bid_id uuid references public.bids(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  deliver_after timestamptz not null default now(),   -- subscription wall: free accounts get it later
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_sent_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, deliver_after);

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------
create or replace function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.is_privileged() returns boolean language sql stable as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or coalesce(auth.role(), '') = 'service_role'
$$;

create or replace function public.is_subscribed(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and subscription_until is not null and subscription_until > now())
$$;

-- Delay before a posting becomes visible to the current user (0 while the board is free).
create or replace function public.visibility_delay() returns interval
language plpgsql stable security definer set search_path = public as $$
declare
  v_minutes int;
begin
  select (value #>> '{}')::int into v_minutes from settings where key = 'free_delay_minutes';
  if coalesce(v_minutes, 0) <= 0 then
    return interval '0';
  end if;
  if auth.uid() is not null and is_subscribed(auth.uid()) then
    return interval '0';
  end if;
  return make_interval(mins => v_minutes);
end $$;

create or replace function public.board_open_to_visitors() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from settings where key = 'board_open_to_visitors'), false)
$$;

create or replace function public.has_contact_access(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()
    or exists (select 1 from contact_unlocks u where u.viewer_id = auth.uid() and u.owner_id = p_owner)
  )
$$;

create or replace function public.is_deal_party(p_posting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from deals d where d.posting_id = p_posting and (d.customer_id = auth.uid() or d.carrier_id = auth.uid())
  )
$$;

create or replace function public.is_posting_owner(p_posting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from postings p where p.id = p_posting and p.owner_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------------------
-- Clients cannot grant themselves operator status or a subscription.
create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if not is_privileged() then
    if tg_op = 'INSERT' then
      new.is_operator := false;
      new.subscription_until := null;
    else
      new.is_operator := old.is_operator;
      new.subscription_until := old.subscription_until;
      new.created_at := old.created_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Owners may edit an open posting, but status, counters and ownership only change through functions.
create or replace function public.postings_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not is_privileged() then
      new.status := 'open';
      new.bid_count := 0;
      new.best_bid := null;
      if new.is_operator_posting then
        new.is_operator_posting := coalesce((select is_operator from profiles where id = new.owner_id), false);
      end if;
    end if;
    if new.kind = 'truck' then
      new.mode := 'planned';
      new.cargo_type_id := null;
      new.cargo_fields := '{}'::jsonb;
    end if;
    new.updated_at := now();
    return new;
  end if;
  if not is_privileged() then
    if old.status not in ('open') then
      raise exception 'posting is not open' using errcode = 'P0001';
    end if;
    new.owner_id := old.owner_id;
    new.kind := old.kind;
    new.bid_count := old.bid_count;
    new.best_bid := old.best_bid;
    new.created_at := old.created_at;
    if new.status not in ('open', 'closed', 'cancelled') then
      new.status := old.status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists postings_guard on public.postings;
create trigger postings_guard before insert or update on public.postings
  for each row execute function public.postings_guard();

drop trigger if exists vehicles_touch on public.vehicles;
drop trigger if exists profile_contacts_touch on public.profile_contacts;
create trigger profile_contacts_touch before update on public.profile_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------
-- Notifications and bid counters (triggers run as table owner, so they bypass RLS)
-- ---------------------------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_type text, p_posting uuid, p_bid uuid, p_deal uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_delay interval := interval '0';
  v_minutes int;
begin
  if p_type = 'match' then
    select (value #>> '{}')::int into v_minutes from settings where key = 'free_delay_minutes';
    if coalesce(v_minutes, 0) > 0 and not is_subscribed(p_user) then
      v_delay := make_interval(mins => v_minutes);
    end if;
  end if;
  insert into notifications (user_id, type, posting_id, bid_id, deal_id, payload, deliver_after)
  values (p_user, p_type, p_posting, p_bid, p_deal, coalesce(p_payload, '{}'::jsonb), now() + v_delay);
end $$;

-- A new posting: find saved searches it satisfies and notify their owners.
create or replace function public.postings_match_searches() returns trigger language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  for s in
    select * from saved_searches ss
    where ss.is_active
      and ss.kind = new.kind
      and ss.owner_id <> new.owner_id
      and new.mode = any (ss.modes)
      and (cardinality(ss.vehicle_type_codes) = 0 or new.vehicle_type_code is null or new.vehicle_type_code = any (ss.vehicle_type_codes))
      and (cardinality(ss.cargo_type_ids) = 0 or new.cargo_type_id is null or new.cargo_type_id = any (ss.cargo_type_ids))
      and haversine_km(ss.center_lat, ss.center_lng, new.from_lat, new.from_lng) <= ss.radius_km + new.from_radius_km
      and (ss.dest_lat is null or haversine_km(ss.dest_lat, ss.dest_lng, new.to_lat, new.to_lng) <= coalesce(ss.dest_radius_km, 0) + new.to_radius_km)
  loop
    perform notify_user(s.owner_id, 'match', new.id, null, null,
      jsonb_build_object('search_id', s.id, 'from', new.from_name, 'to', new.to_name, 'kind', new.kind, 'mode', new.mode, 'price', new.price));
  end loop;
  return new;
end $$;
drop trigger if exists postings_match_searches on public.postings;
create trigger postings_match_searches after insert on public.postings
  for each row execute function public.postings_match_searches();

create or replace function public.bids_recount() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_posting uuid := coalesce(new.posting_id, old.posting_id);
  v_kind text;
begin
  select kind into v_kind from postings where id = v_posting;
  update postings p set
    bid_count = (select count(*) from bids b where b.posting_id = v_posting and b.status = 'active'),
    best_bid = (select case when v_kind = 'truck' then max(amount) else min(amount) end from bids b where b.posting_id = v_posting and b.status = 'active')
  where p.id = v_posting;
  return null;
end $$;
drop trigger if exists bids_recount on public.bids;
create trigger bids_recount after insert or update or delete on public.bids
  for each row execute function public.bids_recount();

-- ---------------------------------------------------------------------------------------
-- Business functions (the only way to change bids, deals and contact unlocks)
-- ---------------------------------------------------------------------------------------
create or replace function public.unlock_contacts(p_deal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d deals%rowtype;
begin
  select * into d from deals where id = p_deal;
  if not found then return; end if;
  insert into contact_unlocks (viewer_id, owner_id, deal_id) values (d.customer_id, d.carrier_id, d.id)
    on conflict (viewer_id, owner_id) do update set deal_id = excluded.deal_id;
  insert into contact_unlocks (viewer_id, owner_id, deal_id) values (d.carrier_id, d.customer_id, d.id)
    on conflict (viewer_id, owner_id) do update set deal_id = excluded.deal_id;
end $$;

-- Place or update my bid on a planned posting (cargo: I am a carrier offering to haul for X;
-- truck: I am a customer offering X for my cargo).
create or replace function public.place_bid(p_posting uuid, p_amount numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p postings%rowtype;
  v_bid uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = v_uid) then raise exception 'profile required' using errcode = 'P0001'; end if;
  select * into p from postings where id = p_posting for update;
  if not found then raise exception 'posting not found' using errcode = 'P0002'; end if;
  if p.owner_id = v_uid then raise exception 'own posting' using errcode = 'P0001'; end if;
  if p.status <> 'open' then raise exception 'posting is not open' using errcode = 'P0001'; end if;
  if p.mode <> 'planned' then raise exception 'urgent postings are taken, not bid on' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive' using errcode = '22023'; end if;
  insert into bids (posting_id, bidder_id, amount, note, status)
  values (p_posting, v_uid, round(p_amount, 2), nullif(left(coalesce(p_note, ''), 300), ''), 'active')
  on conflict (posting_id, bidder_id) do update
    set amount = excluded.amount, note = excluded.note, status = 'active', updated_at = now()
  returning id into v_bid;
  perform notify_user(p.owner_id, 'bid', p.id, v_bid, null,
    jsonb_build_object('amount', round(p_amount, 2), 'from', p.from_name, 'to', p.to_name, 'above_price', (p.price is not null and p_amount > p.price)));
  return v_bid;
end $$;

create or replace function public.withdraw_bid(p_bid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  update bids set status = 'withdrawn', updated_at = now()
  where id = p_bid and bidder_id = v_uid and status = 'active';
  if not found then raise exception 'bid not found or not active' using errcode = 'P0002'; end if;
end $$;

-- Posting owner accepts a bid: a pending deal is created, the bidder must confirm.
create or replace function public.accept_bid(p_bid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  b bids%rowtype;
  p postings%rowtype;
  v_deal uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into b from bids where id = p_bid for update;
  if not found then raise exception 'bid not found' using errcode = 'P0002'; end if;
  select * into p from postings where id = b.posting_id for update;
  if p.owner_id <> v_uid then raise exception 'only the posting owner can accept' using errcode = '42501'; end if;
  if p.status <> 'open' then raise exception 'posting is not open' using errcode = 'P0001'; end if;
  if b.status <> 'active' then raise exception 'bid is not active' using errcode = 'P0001'; end if;
  update bids set status = 'accepted', updated_at = now() where id = b.id;
  insert into deals (posting_id, customer_id, carrier_id, bid_id, amount, status,
                     customer_confirmed_at, carrier_confirmed_at)
  values (p.id,
          case when p.kind = 'cargo' then p.owner_id else b.bidder_id end,
          case when p.kind = 'cargo' then b.bidder_id else p.owner_id end,
          b.id, b.amount, 'pending',
          case when p.kind = 'cargo' then now() else null end,
          case when p.kind = 'truck' then now() else null end)
  returning id into v_deal;
  update postings set status = 'pending', updated_at = now() where id = p.id;
  perform notify_user(b.bidder_id, 'accepted', p.id, b.id, v_deal,
    jsonb_build_object('amount', b.amount, 'from', p.from_name, 'to', p.to_name));
  return v_deal;
end $$;

-- Urgent cargo: first to take gets it. Planned with a price: agree to the price and take at once.
create or replace function public.take_posting(p_posting uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p postings%rowtype;
  v_deal uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from profiles where id = v_uid) then raise exception 'profile required' using errcode = 'P0001'; end if;
  select * into p from postings where id = p_posting for update;
  if not found then raise exception 'posting not found' using errcode = 'P0002'; end if;
  if p.owner_id = v_uid then raise exception 'own posting' using errcode = 'P0001'; end if;
  if p.status <> 'open' then raise exception 'already taken' using errcode = 'P0001'; end if;
  if p.mode <> 'urgent' and p.price is null then raise exception 'no instant price, place a bid' using errcode = 'P0001'; end if;
  insert into deals (posting_id, customer_id, carrier_id, amount, status, customer_confirmed_at, carrier_confirmed_at)
  values (p.id,
          case when p.kind = 'cargo' then p.owner_id else v_uid end,
          case when p.kind = 'cargo' then v_uid else p.owner_id end,
          p.price, 'confirmed', now(), now())
  returning id into v_deal;
  update postings set status = 'deal', updated_at = now() where id = p.id;
  update bids set status = 'rejected', updated_at = now() where posting_id = p.id and status = 'active';
  perform unlock_contacts(v_deal);
  perform notify_user(p.owner_id, 'taken', p.id, null, v_deal,
    jsonb_build_object('amount', p.price, 'from', p.from_name, 'to', p.to_name));
  perform notify_user(v_uid, 'deal', p.id, null, v_deal,
    jsonb_build_object('amount', p.price, 'from', p.from_name, 'to', p.to_name));
  return v_deal;
end $$;

-- The counterparty confirms a pending deal; when both sides have confirmed, contacts open.
create or replace function public.confirm_deal(p_deal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d deals%rowtype;
  p postings%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into d from deals where id = p_deal for update;
  if not found then raise exception 'deal not found' using errcode = 'P0002'; end if;
  if d.status <> 'pending' then raise exception 'deal is not pending' using errcode = 'P0001'; end if;
  if v_uid = d.customer_id then
    update deals set customer_confirmed_at = coalesce(customer_confirmed_at, now()), updated_at = now() where id = d.id;
  elsif v_uid = d.carrier_id then
    update deals set carrier_confirmed_at = coalesce(carrier_confirmed_at, now()), updated_at = now() where id = d.id;
  else
    raise exception 'not a party of this deal' using errcode = '42501';
  end if;
  select * into d from deals where id = p_deal;
  if d.customer_confirmed_at is not null and d.carrier_confirmed_at is not null then
    update deals set status = 'confirmed', updated_at = now() where id = d.id;
    select * into p from postings where id = d.posting_id for update;
    update postings set status = 'deal', updated_at = now() where id = p.id;
    update bids set status = 'rejected', updated_at = now() where posting_id = p.id and status = 'active';
    perform unlock_contacts(d.id);
    perform notify_user(d.customer_id, 'deal', p.id, d.bid_id, d.id, jsonb_build_object('amount', d.amount, 'from', p.from_name, 'to', p.to_name));
    perform notify_user(d.carrier_id, 'deal', p.id, d.bid_id, d.id, jsonb_build_object('amount', d.amount, 'from', p.from_name, 'to', p.to_name));
  end if;
end $$;

-- Either party backs out of a pending deal; the posting reopens.
create or replace function public.cancel_deal(p_deal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d deals%rowtype;
  p postings%rowtype;
  v_other uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into d from deals where id = p_deal for update;
  if not found then raise exception 'deal not found' using errcode = 'P0002'; end if;
  if v_uid <> d.customer_id and v_uid <> d.carrier_id then raise exception 'not a party of this deal' using errcode = '42501'; end if;
  if d.status <> 'pending' then raise exception 'only pending deals can be cancelled' using errcode = 'P0001'; end if;
  update deals set status = 'cancelled', updated_at = now() where id = d.id;
  if d.bid_id is not null then
    update bids set status = 'rejected', updated_at = now() where id = d.bid_id;
  end if;
  select * into p from postings where id = d.posting_id;
  update postings set status = 'open', updated_at = now() where id = d.posting_id and status = 'pending';
  v_other := case when v_uid = d.customer_id then d.carrier_id else d.customer_id end;
  perform notify_user(v_other, 'cancelled', d.posting_id, d.bid_id, d.id, jsonb_build_object('from', p.from_name, 'to', p.to_name));
end $$;

-- Owner closes a posting (found a truck elsewhere, cargo gone).
create or replace function public.close_posting(p_posting uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  update postings set status = 'closed', updated_at = now()
  where id = p_posting and owner_id = v_uid and status in ('open', 'pending');
  if not found then raise exception 'posting not found or not open' using errcode = 'P0002'; end if;
  update deals set status = 'cancelled', updated_at = now() where posting_id = p_posting and status = 'pending';
  update bids set status = 'rejected', updated_at = now() where posting_id = p_posting and status = 'active';
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and id = any (p_ids) and read_at is null
$$;

-- ---------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.vehicle_groups enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.cargo_types enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.vehicles enable row level security;
alter table public.postings enable row level security;
alter table public.bids enable row level security;
alter table public.deals enable row level security;
alter table public.contact_unlocks enable row level security;
alter table public.saved_searches enable row level security;
alter table public.notifications enable row level security;

-- Reference data: readable by everyone, never written from the client.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists vehicle_groups_read on public.vehicle_groups;
create policy vehicle_groups_read on public.vehicle_groups for select using (true);
drop policy if exists vehicle_types_read on public.vehicle_types;
create policy vehicle_types_read on public.vehicle_types for select using (true);
drop policy if exists cargo_types_read on public.cargo_types;
create policy cargo_types_read on public.cargo_types for select using (true);

-- Profiles: names and cities are visible inside the exchange; only the owner writes.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Contacts: THE protected table. Owner, or someone who holds an unlock for this owner.
drop policy if exists profile_contacts_read on public.profile_contacts;
create policy profile_contacts_read on public.profile_contacts for select to authenticated
  using (has_contact_access(profile_id));
drop policy if exists profile_contacts_insert on public.profile_contacts;
create policy profile_contacts_insert on public.profile_contacts for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists profile_contacts_update on public.profile_contacts;
create policy profile_contacts_update on public.profile_contacts for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Vehicles: private to the owner (plates are not public); postings copy the parameters they need.
drop policy if exists vehicles_owner on public.vehicles;
create policy vehicles_owner on public.vehicles for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Postings: the board. Open ones are visible to members (and visitors if the board is open),
-- after the visibility delay for non-subscribers; owners and deal parties always see theirs.
drop policy if exists postings_read on public.postings;
create policy postings_read on public.postings for select using (
  owner_id = auth.uid()
  or is_deal_party(id)
  or (
    status in ('open', 'pending')
    and date_to >= current_date
    and created_at <= now() - visibility_delay()
    and (auth.uid() is not null or board_open_to_visitors())
  )
);
drop policy if exists postings_insert on public.postings;
create policy postings_insert on public.postings for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists postings_update on public.postings;
create policy postings_update on public.postings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists postings_delete on public.postings;
create policy postings_delete on public.postings for delete to authenticated using (owner_id = auth.uid() and status in ('open', 'closed', 'cancelled'));

-- Bids: the posting owner sees all bids on their posting, a bidder sees their own. No direct writes.
drop policy if exists bids_read on public.bids;
create policy bids_read on public.bids for select to authenticated
  using (bidder_id = auth.uid() or is_posting_owner(posting_id));

-- Deals: parties only. No direct writes.
drop policy if exists deals_read on public.deals;
create policy deals_read on public.deals for select to authenticated
  using (customer_id = auth.uid() or carrier_id = auth.uid());

-- Unlocks: I can see whom I am allowed to contact. No direct writes.
drop policy if exists contact_unlocks_read on public.contact_unlocks;
create policy contact_unlocks_read on public.contact_unlocks for select to authenticated using (viewer_id = auth.uid());

drop policy if exists saved_searches_owner on public.saved_searches;
create policy saved_searches_owner on public.saved_searches for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid() and deliver_after <= now());

-- ---------------------------------------------------------------------------------------
-- Privileges (RLS is the gate; grants are the second lock)
-- ---------------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.settings, public.vehicle_groups, public.vehicle_types, public.cargo_types, public.profiles, public.postings to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update on public.profile_contacts to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant insert, update, delete on public.postings to authenticated;
grant select on public.bids, public.deals, public.contact_unlocks, public.notifications to authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.haversine_km(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.has_contact_access(uuid), public.is_deal_party(uuid), public.is_posting_owner(uuid),
  public.visibility_delay(), public.board_open_to_visitors(), public.is_subscribed(uuid), public.is_privileged() to anon, authenticated;
grant execute on function public.place_bid(uuid, numeric, text), public.withdraw_bid(uuid), public.accept_bid(uuid),
  public.take_posting(uuid), public.confirm_deal(uuid), public.cancel_deal(uuid), public.close_posting(uuid),
  public.mark_notifications_read(uuid[]) to authenticated;
