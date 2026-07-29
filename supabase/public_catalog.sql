drop view if exists public.worker_cards;

create or replace view public.worker_cards as
with worker_profession_names as (
  select
    wp.worker_id,
    array_remove(array_agg(distinct p.name order by p.name), null) as skills,
    min(p.name) as first_profession
  from public.worker_professions wp
  join public.professions p on p.id = wp.profession_id
  where p.is_active = true
  group by wp.worker_id
)
select
  w.id,
  coalesce(
    nullif(w.display_name, ''),
    nullif(trim(
      coalesce(u.first_name, '') ||
      case
        when u.last_name is null or u.last_name = '' then ''
        else ' ' || left(u.last_name, 1) || '.'
      end
    ), ''),
    'ხელოსანი'
  ) as name,
  coalesce(p.name, wpn.first_profession, 'ხელოსანი') as role,
  u.photo_url as avatar_url,
  u.rating_avg,
  u.rating_count,
  w.city,
  w.about,
  w.price_type,
  w.price_min,
  w.price_max,
  w.experience_years,
  w.verification_status,
  coalesce(wpn.skills, array[]::text[]) as skills,
  w.created_at
from public.workers w
join public.users u on u.id = w.user_id
left join public.professions p on p.id = w.main_profession_id
left join worker_profession_names wpn on wpn.worker_id = w.id
where w.is_active = true
  and w.verification_status = 'verified'::public.worker_verification_status
  and w.subscription_status in ('trial', 'active')
  and u.status = 'active';

grant select on public.worker_cards to anon, authenticated;
