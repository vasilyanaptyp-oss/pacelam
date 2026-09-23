-- 0005: only the carrier names a price (client's decision, 23.09.2026).
-- The customer no longer offers a price: carriers send offers (bids) with their own price, the customer
-- taps "Agree" and the deal closes at once, contacts open on both sides — the carrier committed by
-- naming his price. A new cargo posting carries no price; postings made before keep theirs, so
-- take_posting still works for them. A truck posting keeps the carrier's asking price.
-- Also closes audit 13.09 item 5.21: the operator tag can no longer be switched on by editing a posting.

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
      if new.kind = 'cargo' then
        new.price := null;   -- the customer never names a price
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
    new.is_operator_posting := old.is_operator_posting;
    if new.kind = 'cargo' then
      new.price := old.price;   -- nor adds one later
    end if;
    if new.status not in ('open', 'closed', 'cancelled') then
      new.status := old.status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Accepting an offer on cargo confirms the deal at once (urgent did so since 0004, now every cargo).
-- A truck posting still goes through "pending" until the carrier confirms, as before.
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
  if p.mode = 'urgent' or p.kind = 'cargo' then
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
