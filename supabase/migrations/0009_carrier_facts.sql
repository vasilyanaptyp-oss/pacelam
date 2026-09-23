-- 0009: trust at a glance next to an offer (client, 18.09.2026 22:35: «Нужно очень хорошо продумать доверие …
-- кто перевозчик; какой автомобиль; грузоподъёмность; … сколько выполнено перевозок; … когда зарегистрирован.
-- Особенно я бы добавил возле предложения что-то вроде: ✓ Verificēts pārvadātājs — если действительно будет проверка»).
-- Facts only, nothing the carrier did not show anyway: his vehicle type and payload, deals closed on Paceļam,
-- since when he is here. No contacts, no plates. There is no verification yet, so there is no "verified" mark.

create or replace function public.carrier_facts(p_users uuid[])
returns table (user_id uuid, deals_done int, vehicle_type_code text, tonnage_t numeric, member_since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id,
         (select count(*)::int from deals d where d.carrier_id = p.id and d.status = 'confirmed'),
         v.type_code,
         v.tonnage_t,
         p.created_at
  from profiles p
  left join lateral (
    select type_code, tonnage_t from vehicles where owner_id = p.id order by is_default desc, created_at limit 1
  ) v on true
  where p.id = any (p_users[1:50])   -- one screen of offers, not a directory
$$;
revoke all on function public.carrier_facts(uuid[]) from public, anon;
grant execute on function public.carrier_facts(uuid[]) to authenticated;
