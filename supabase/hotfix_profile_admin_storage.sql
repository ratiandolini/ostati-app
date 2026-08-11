-- Hotfix: profile photos, verification documents, client points, admin settings.
-- Run this file once in Supabase SQL Editor after deploying the latest app build.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  (
    'profile-photos',
    'profile-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'verification-documents',
    'verification-documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'booking-photos',
    'booking-photos',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'worker-portfolio',
    'worker-portfolio',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read public profile and portfolio files"
on storage.objects;

create policy "public can read public profile and portfolio files"
on storage.objects for select
using (bucket_id in ('profile-photos', 'worker-portfolio'));

drop policy if exists "authenticated users can upload profile photos"
on storage.objects;

create policy "authenticated users can upload profile photos"
on storage.objects for insert
with check (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own profile photos"
on storage.objects;

create policy "authenticated users can update own profile photos"
on storage.objects for update
using (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload verification documents"
on storage.objects;

create policy "authenticated users can upload verification documents"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own verification documents"
on storage.objects;

create policy "authenticated users can update own verification documents"
on storage.objects for update
using (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload booking photos"
on storage.objects;

create policy "authenticated users can upload booking photos"
on storage.objects for insert
with check (
  bucket_id = 'booking-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload chat attachments"
on storage.objects;

create policy "authenticated users can upload chat attachments"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own chat attachments"
on storage.objects;

create policy "authenticated users can update own chat attachments"
on storage.objects for update
using (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'chat-attachments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can read own private files by folder"
on storage.objects;

create policy "users can read own private files by folder"
on storage.objects for select
using (
  bucket_id in ('booking-photos', 'chat-attachments')
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "booking parties can read private booking files"
on storage.objects;

create policy "booking parties can read private booking files"
on storage.objects for select
using (
  auth.role() = 'authenticated'
  and (
    (
      bucket_id = 'chat-attachments'
      and exists (
        select 1
        from public.messages m
        where public.user_can_access_booking(m.booking_id)
          and m.attachment_url is not null
          and (
            m.attachment_url = storage.objects.name
            or m.attachment_url like '%' || storage.objects.name
          )
      )
    )
    or (
      bucket_id = 'booking-photos'
      and exists (
        select 1
        from public.booking_details bd
        where public.user_can_access_booking(bd.booking_id)
          and bd.uploaded_photo_url is not null
          and (
            bd.uploaded_photo_url = storage.objects.name
            or bd.uploaded_photo_url like '%' || storage.objects.name
          )
      )
    )
  )
);

create table if not exists public.client_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.client_points enable row level security;

drop policy if exists "users can read own client points"
on public.client_points;

create policy "users can read own client points"
on public.client_points for select
using (user_id = public.current_app_user_id());

create or replace function public.get_my_client_points()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to read points';
  end if;

  select jsonb_build_object(
    'total', coalesce(sum(points), 0),
    'history', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'points', points,
          'reason', reason,
          'createdAt', created_at
        )
        order by created_at desc
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.client_points
  where user_id = current_user_id;

  return result;
end;
$$;

grant execute on function public.get_my_client_points()
to authenticated;

grant execute on function public.save_admin_platform_settings(jsonb, jsonb)
to authenticated;

update public.admin_members
set permissions = array(
  select distinct permission
  from unnest(permissions || array['settings']::text[]) as permission
)
where role = 'owner'
   or id = 'owner';

alter table public.workers
add column if not exists experience_years integer not null default 0;

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
  and w.subscription_status in ('trial', 'active')
  and u.status = 'active';

grant select on public.worker_cards to anon, authenticated;

create or replace function public.get_current_worker_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  result jsonb;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null or current_worker_id is null then
    raise exception 'Only a worker can read worker profile';
  end if;

  select jsonb_build_object(
    'first_name', coalesce(
      nullif(u.first_name, ''),
      nullif(split_part(coalesce(w.display_name, ''), ' ', 1), '')
    ),
    'last_name', coalesce(
      nullif(u.last_name, ''),
      nullif(trim(regexp_replace(coalesce(w.display_name, ''), '^\S+\s*', '')), '')
    ),
    'display_name', nullif(w.display_name, ''),
    'photo_url', u.photo_url,
    'city', w.city,
    'about', w.about,
    'experience_years', w.experience_years,
    'verification_status', w.verification_status,
    'trial_started_at', w.trial_started_at,
    'subscription_status', w.subscription_status,
    'subscription', (
      select jsonb_build_object(
        'plan', s.plan,
        'amount', s.amount,
        'status', s.status,
        'trial_ends_at', s.trial_ends_at,
        'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end
      )
      from public.subscriptions s
      where s.worker_id = w.id
        and s.status in ('trial', 'active', 'past_due')
      order by s.created_at desc
      limit 1
    ),
    'verification_documents', jsonb_build_object(
      'id_front', (
        select vd.file_url
        from public.verification_documents vd
        where vd.worker_id = w.id
          and vd.type = 'id_front'
        order by vd.created_at desc
        limit 1
      ),
      'id_back', (
        select vd.file_url
        from public.verification_documents vd
        where vd.worker_id = w.id
          and vd.type = 'id_back'
        order by vd.created_at desc
        limit 1
      ),
      'bank_account', (
        select vd.file_url
        from public.verification_documents vd
        where vd.worker_id = w.id
          and vd.type = 'bank_account'
        order by vd.created_at desc
        limit 1
      )
    ),
    'price_type', w.price_type,
    'price_min', w.price_min,
    'price_max', w.price_max,
    'professions', coalesce(
      (
        select jsonb_agg(p.name order by p.name)
        from public.worker_professions wp
        join public.professions p on p.id = wp.profession_id
        where wp.worker_id = w.id
      ),
      '[]'::jsonb
    ),
    'schedule', coalesce(
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
    ),
    'unavailable_ranges', coalesce(
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
    )
  )
  into result
  from public.users u
  join public.workers w on w.user_id = u.id
  where u.id = current_user_id
    and w.id = current_worker_id;

  return result;
end;
$$;

grant execute on function public.get_current_worker_profile()
to authenticated;

drop function if exists public.save_current_worker_profile(
  text,
  text,
  text,
  text,
  text,
  text[],
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
);

drop function if exists public.save_current_worker_profile(
  text,
  text,
  text,
  text,
  text,
  text[],
  integer,
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
);

create or replace function public.save_current_worker_profile(
  p_first_name text,
  p_last_name text,
  p_photo_url text,
  p_city text,
  p_about text,
  p_professions text[],
  p_experience_years integer,
  p_price_type public.price_type,
  p_price_min numeric,
  p_price_max numeric,
  p_schedule jsonb,
  p_unavailable_ranges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_worker_id uuid;
  main_profession uuid;
begin
  current_user_id := public.current_app_user_id();
  current_worker_id := public.current_app_worker_id();

  if current_user_id is null or current_worker_id is null then
    raise exception 'Only a worker can save worker profile';
  end if;

  if p_price_type = 'range' and p_price_max is null then
    raise exception 'Range price requires max price';
  end if;

  update public.users
  set
    first_name = coalesce(nullif(p_first_name, ''), first_name),
    last_name = coalesce(nullif(p_last_name, ''), last_name),
    photo_url = coalesce(nullif(p_photo_url, ''), photo_url),
    updated_at = now()
  where id = current_user_id;

  insert into public.professions (name, category, is_active)
  select distinct trim(profession_name), 'რემონტი', true
  from unnest(coalesce(p_professions, array[]::text[])) as profession_name
  where trim(profession_name) <> ''
  on conflict (name) do update
  set is_active = true;

  select id
  into main_profession
  from public.professions
  where name = any(coalesce(p_professions, array[]::text[]))
    and is_active = true
  order by array_position(p_professions, name)
  limit 1;

  update public.workers
  set
    display_name = nullif(trim(concat_ws(' ', p_first_name, p_last_name)), ''),
    city = coalesce(nullif(p_city, ''), city),
    about = nullif(p_about, ''),
    experience_years = greatest(coalesce(p_experience_years, experience_years, 0), 0),
    price_type = coalesce(p_price_type, price_type),
    price_min = p_price_min,
    price_max = case when p_price_type = 'range' then p_price_max else null end,
    main_profession_id = main_profession,
    is_active = main_profession is not null
      and verification_status = 'verified'::public.worker_verification_status,
    updated_at = now()
  where id = current_worker_id;

  delete from public.worker_professions
  where worker_id = current_worker_id;

  insert into public.worker_professions (worker_id, profession_id)
  select current_worker_id, p.id
  from public.professions p
  where p.name = any(coalesce(p_professions, array[]::text[]))
    and p.is_active = true
  on conflict do nothing;

  delete from public.worker_schedule
  where worker_id = current_worker_id;

  insert into public.worker_schedule (worker_id, weekday, start_time, end_time)
  select
    current_worker_id,
    (item ->> 'weekday')::integer,
    (item ->> 'start_time')::time,
    (item ->> 'end_time')::time
  from jsonb_array_elements(coalesce(p_schedule, '[]'::jsonb)) item
  where (item ->> 'weekday') is not null
    and (item ->> 'start_time') is not null
    and (item ->> 'end_time') is not null;

  delete from public.worker_unavailable_ranges
  where worker_id = current_worker_id;

  insert into public.worker_unavailable_ranges (
    worker_id,
    starts_at,
    ends_at
  )
  select
    current_worker_id,
    ((item ->> 'start')::date)::timestamptz,
    (((item ->> 'end')::date + interval '1 day')::timestamptz)
  from jsonb_array_elements(coalesce(p_unavailable_ranges, '[]'::jsonb)) item
  where (item ->> 'start') is not null
    and (item ->> 'end') is not null;

  return public.get_current_worker_profile();
end;
$$;

grant execute on function public.save_current_worker_profile(
  text,
  text,
  text,
  text,
  text,
  text[],
  integer,
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
) to authenticated;

create or replace function public.create_booking_request(
  p_worker_id uuid,
  p_profession_name text,
  p_scheduled_at timestamptz,
  p_city text,
  p_address_text text,
  p_client_comment text,
  p_booking_fee_amount numeric,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_user_id uuid;
  target_profession_id uuid;
  created_booking_id uuid;
  worker_user_id uuid;
  platform_settings jsonb;
  booking_fee_amount numeric;
  payment_provider text;
  payment_currency text;
begin
  client_user_id := public.current_app_user_id();

  if client_user_id is null then
    raise exception 'Authentication is required to create a booking';
  end if;

  if not public.worker_can_receive_bookings(p_worker_id) then
    raise exception 'Worker cannot receive bookings right now';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.worker_id = p_worker_id
      and b.scheduled_at = p_scheduled_at
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ეს დრო უკვე დაკავებულია. აირჩიეთ სხვა დრო.';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.worker_id = p_worker_id
      and b.client_id = client_user_id
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ამ ხელოსანთან უკვე გაქვთ აქტიური ჯავშანი. ჯერ დაასრულეთ ან გააუქმეთ არსებული ჯავშანი.';
  end if;

  select workers.user_id
  into worker_user_id
  from public.workers
  where workers.id = p_worker_id;

  select professions.id
  into target_profession_id
  from public.professions
  where professions.name = p_profession_name
    and professions.is_active = true
  limit 1;

  if target_profession_id is null then
    select coalesce(workers.main_profession_id, first_worker_profession.profession_id)
    into target_profession_id
    from public.workers
    left join lateral (
      select worker_professions.profession_id
      from public.worker_professions
      join public.professions
        on professions.id = worker_professions.profession_id
       and professions.is_active = true
      where worker_professions.worker_id = workers.id
      order by professions.name
      limit 1
    ) first_worker_profession on true
    where workers.id = p_worker_id;
  end if;

  select value_json
  into platform_settings
  from public.platform_settings
  where key = 'platform';

  booking_fee_amount := coalesce(
    case
      when platform_settings ? 'bookingFee' then (platform_settings ->> 'bookingFee')::numeric
      else null
    end,
    p_booking_fee_amount,
    0
  );
  payment_provider := coalesce(nullif(platform_settings ->> 'paymentProvider', ''), 'manual_mvp_hold');
  payment_currency := coalesce(nullif(platform_settings ->> 'paymentCurrency', ''), 'GEL');

  insert into public.bookings (
    client_id,
    worker_id,
    profession_id,
    scheduled_at,
    status,
    city,
    address_text,
    client_comment,
    booking_fee_amount,
    payment_status
  )
  values (
    client_user_id,
    p_worker_id,
    target_profession_id,
    p_scheduled_at,
    'pending',
    p_city,
    p_address_text,
    p_client_comment,
    booking_fee_amount,
    case
      when booking_fee_amount > 0 then 'authorized'::public.payment_status
      else 'not_required'::public.payment_status
    end
  )
  returning id into created_booking_id;

  insert into public.booking_details (
    booking_id,
    area,
    height,
    length,
    rooms,
    wall_condition,
    target_surface,
    material_owner,
    plumbing_type,
    floor,
    electric_points,
    electric_panel,
    is_emergency,
    work_scope,
    surface_type,
    material_note,
    item_count,
    current_condition,
    photo_note,
    roof_type,
    extra_measurements,
    uploaded_photo_url
  )
  values (
    created_booking_id,
    nullif(p_details ->> 'area', '')::numeric,
    nullif(p_details ->> 'height', '')::numeric,
    nullif(p_details ->> 'length', '')::numeric,
    nullif(p_details ->> 'rooms', '')::integer,
    nullif(p_details ->> 'wall_condition', ''),
    nullif(p_details ->> 'target_surface', ''),
    coalesce(nullif(p_details ->> 'material_owner', '')::public.material_owner, 'unknown'),
    nullif(p_details ->> 'plumbing_type', ''),
    nullif(p_details ->> 'floor', '')::integer,
    nullif(p_details ->> 'electric_points', '')::integer,
    nullif(p_details ->> 'electric_panel', ''),
    nullif(p_details ->> 'is_emergency', '')::boolean,
    nullif(p_details ->> 'work_scope', ''),
    nullif(p_details ->> 'surface_type', ''),
    nullif(p_details ->> 'material_note', ''),
    nullif(p_details ->> 'item_count', ''),
    nullif(p_details ->> 'current_condition', ''),
    nullif(p_details ->> 'photo_note', ''),
    nullif(p_details ->> 'roof_type', ''),
    coalesce(p_details -> 'extra_measurements', '{}'::jsonb),
    nullif(p_details ->> 'uploaded_photo_url', '')
  );

  if booking_fee_amount > 0 then
    insert into public.payments (
      booking_id,
      payer_id,
      worker_id,
      amount,
      currency,
      provider,
      provider_payment_id,
      status
    )
    values (
      created_booking_id,
      client_user_id,
      p_worker_id,
      booking_fee_amount,
      payment_currency,
      payment_provider,
      'mvp-' || created_booking_id::text,
      'authorized'::public.payment_status
    );
  end if;

  insert into public.notifications (
    user_id,
    booking_id,
    type,
    title,
    body
  )
  values (
    worker_user_id,
    created_booking_id,
    'new_booking',
    'ახალი ჯავშანი',
    'კლიენტმა ახალი ჯავშანი გამოგიგზავნათ. გახსენით დეტალები და დაადასტურეთ ან უარყავით.'
  );

  return jsonb_build_object('booking_id', created_booking_id);
end;
$$;

grant execute on function public.create_booking_request(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  numeric,
  jsonb
) to authenticated;

notify pgrst, 'reload schema';
