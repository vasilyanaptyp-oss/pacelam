-- 0013: offers are blind (client's answer to three questions, before 17.10.2026): a carrier does not see the
-- other carriers' prices. The best price was a public column of every posting; it now stays empty for everybody,
-- and the owner gets the best price of his own postings from offer_summary (he reads all their offers anyway).
-- The number of offers stays public. Nothing is removed: the column best_bid stays (empty), bids_recount keeps
-- counting, one function is added.

create or replace function public.bids_recount() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_posting uuid := coalesce(new.posting_id, old.posting_id);
begin
  update postings p set
    bid_count = (select count(*) from bids b where b.posting_id = v_posting and b.status = 'active'),
    best_bid = null   -- blind offers: no price on the public posting (0013)
  where p.id = v_posting;
  return null;
end $$;
update public.postings set best_bid = null where best_bid is not null;

-- The owner's own postings: how many offers and the best price. Somebody else's posting returns nothing.
create or replace function public.offer_summary(p_postings uuid[])
returns table (posting_id uuid, bid_count int, best_bid numeric)
language sql stable security definer set search_path = public as $$
  select p.id,
         (select count(*)::int from bids b where b.posting_id = p.id and b.status = 'active'),
         (select case when p.kind = 'truck' then max(b.amount) else min(b.amount) end from bids b where b.posting_id = p.id and b.status = 'active')
  from postings p
  where p.id = any (p_postings[1:200]) and p.owner_id = auth.uid()
$$;
revoke all on function public.offer_summary(uuid[]) from public, anon;
grant execute on function public.offer_summary(uuid[]) to authenticated;
