-- 0006: "offer my cargo" on a truck tells the truck's owner (23.09.2026).
-- Since 0005 the customer never names a price, so on someone's truck he no longer places a price offer
-- (which used to notify the carrier). Instead he posts his cargo on that truck's route; the cargo keeps
-- a link to the truck and the truck's owner gets a notification at once, then names his price as usual.
-- Nothing is removed: one nullable column and two triggers are added.

alter table public.postings add column if not exists for_posting_id uuid references public.postings(id) on delete set null;

-- The link is kept only when it makes sense: cargo pointing at someone else's open truck. It cannot be
-- set to anything else and cannot be changed later (a user may not aim notifications at arbitrary people).
create or replace function public.postings_link_truck() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.for_posting_id := old.for_posting_id;
    return new;
  end if;
  if new.for_posting_id is not null and (new.kind <> 'cargo' or not exists (
      select 1 from postings t where t.id = new.for_posting_id and t.kind = 'truck' and t.status = 'open' and t.owner_id <> new.owner_id)) then
    new.for_posting_id := null;
  end if;
  return new;
end $$;
drop trigger if exists postings_link_truck on public.postings;
create trigger postings_link_truck before insert or update on public.postings
  for each row execute function public.postings_link_truck();

-- After the insert: tell the truck's owner (once — a matching saved search may already have told him).
create or replace function public.postings_notify_truck_owner() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  if new.for_posting_id is null then return new; end if;
  select owner_id into v_owner from postings where id = new.for_posting_id;
  if v_owner is null or exists (select 1 from notifications where user_id = v_owner and posting_id = new.id) then return new; end if;
  perform notify_user(v_owner, 'match', new.id, null, null,
    jsonb_build_object('from', new.from_name, 'to', new.to_name, 'kind', new.kind, 'mode', new.mode, 'for_truck', new.for_posting_id));
  return new;
end $$;
drop trigger if exists postings_notify_truck_owner on public.postings;
create trigger postings_notify_truck_owner after insert on public.postings
  for each row execute function public.postings_notify_truck_owner();
