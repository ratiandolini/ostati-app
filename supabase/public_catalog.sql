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
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'weekday', ws.weekday,
          'start_time', to_char(ws.start_time, 'HH24:MI'),
          'end_time', to_char(ws.end_time, 'HH24:MI')
        )
        order by ws.weekday
      )
      from public.worker_schedule ws
      where ws.worker_id = w.id
    ),
    '[]'::jsonb
  ) as schedule,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'start', to_char(wur.starts_at, 'YYYY-MM-DD'),
          'end', to_char(wur.ends_at, 'YYYY-MM-DD')
        )
        order by wur.starts_at
      )
      from public.worker_unavailable_ranges wur
      where wur.worker_id = w.id
    ),
    '[]'::jsonb
  ) as unavailable_ranges,
  coalesce(
    (
      select array_remove(
        array_agg(
          to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'YYYY-MM-DD"T"HH24:MI')
          order by b.scheduled_at
        ),
        null
      )
      from public.bookings b
      where b.worker_id = w.id
        and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
    ),
    array[]::text[]
  ) as booked_slots,
  w.created_at
from public.workers w
join public.users u on u.id = w.user_id
left join public.professions p on p.id = w.main_profession_id
left join worker_profession_names wpn on wpn.worker_id = w.id
where w.is_active = true
  and w.verification_status = 'verified'::public.worker_verification_status
  and u.status = 'active';

alter view public.worker_cards set (security_invoker = true);

grant select on public.worker_cards to anon, authenticated;
