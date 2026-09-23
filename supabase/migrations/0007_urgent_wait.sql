-- 0007: urgent cargo with a waiting time and a countdown (client's answer, 23.09.2026: urgent stays, it means today,
-- the customer says how long he can wait and the card counts down from his posting).
-- One nullable column: until when the customer waits. Only urgent cargo keeps it, clamped to a sane
-- window (5 minutes .. 24 hours from now), and it cannot be moved later. Nothing is removed.

alter table public.postings add column if not exists wait_until timestamptz;

create or replace function public.postings_wait_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.wait_until := old.wait_until;
    return new;
  end if;
  if new.kind <> 'cargo' or new.mode <> 'urgent' then
    new.wait_until := null;
  elsif new.wait_until is not null then
    new.wait_until := least(greatest(new.wait_until, now() + interval '5 minutes'), now() + interval '24 hours');
  end if;
  return new;
end $$;
drop trigger if exists postings_wait_guard on public.postings;
create trigger postings_wait_guard before insert or update on public.postings
  for each row execute function public.postings_wait_guard();
