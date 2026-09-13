-- 0004: price decides in the urgent mode too (client's correction, 13.09.2026).
-- Urgent cargo is no longer "first to take it": carriers agree to the customer's price or offer their own
-- (both are bids), the customer picks an offer, and because the carrier already committed by bidding,
-- accepting an urgent bid confirms the deal at once and opens the contacts.
-- take_posting stays for planned cargo with an instant price and for truck offers with an asking price.

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
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive' using errcode = '22023'; end if;
  insert into bids (posting_id, bidder_id, amount, note, status)
  values (p_posting, v_uid, round(p_amount, 2), nullif(left(coalesce(p_note, ''), 300), ''), 'active')
  on conflict (posting_id, bidder_id) do update
    set amount = excluded.amount, note = excluded.note, status = 'active', updated_at = now()
  returning id into v_bid;
  perform notify_user(p.owner_id, 'bid', p.id, v_bid, null,
    jsonb_build_object('amount', round(p_amount, 2), 'from', p.from_name, 'to', p.to_name,
                       'above_price', (p.price is not null and p_amount > p.price), 'urgent', (p.mode = 'urgent')));
  return v_bid;
end $$;

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
  if p.mode = 'urgent' then
    -- urgent: the bidder committed by bidding, the owner's acceptance closes the deal at once
    insert into deals (posting_id, customer_id, carrier_id, bid_id, amount, status, customer_confirmed_at, carrier_confirmed_at)
    values (p.id,
            case when p.kind = 'cargo' then p.owner_id else b.bidder_id end,
            case when p.kind = 'cargo' then b.bidder_id else p.owner_id end,
            b.id, b.amount, 'confirmed', now(), now())
    returning id into v_deal;
    update postings set status = 'deal', updated_at = now() where id = p.id;
    update bids set status = 'rejected', updated_at = now() where posting_id = p.id and status = 'active';
    perform unlock_contacts(v_deal);
    perform notify_user(b.bidder_id, 'deal', p.id, b.id, v_deal, jsonb_build_object('amount', b.amount, 'from', p.from_name, 'to', p.to_name));
    perform notify_user(p.owner_id, 'deal', p.id, b.id, v_deal, jsonb_build_object('amount', b.amount, 'from', p.from_name, 'to', p.to_name));
    return v_deal;
  end if;
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

-- Instant take: planned cargo with an instant price, or a truck offer with an asking price. Never urgent.
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
  if p.mode = 'urgent' then raise exception 'urgent postings are bid on, not taken' using errcode = 'P0001'; end if;
  if p.price is null then raise exception 'no instant price, place a bid' using errcode = 'P0001'; end if;
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
