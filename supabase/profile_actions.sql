drop function if exists public.update_current_user_profile(text, text, text);
drop function if exists public.update_current_user_profile(text, text, text, text, text);
drop function if exists public.update_current_user_profile(text, text, text, text, text, text);

create or replace function public.update_current_user_profile(
  p_first_name text,
  p_last_name text,
  p_contact_phone text,
  p_photo_url text,
  p_city text default null,
  p_address_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := public.current_app_user_id();

  if current_user_id is null then
    raise exception 'Authentication is required to update profile';
  end if;

  update public.users
  set
    first_name = coalesce(nullif(p_first_name, ''), first_name),
    last_name = coalesce(nullif(p_last_name, ''), last_name),
    contact_phone = coalesce(nullif(p_contact_phone, ''), contact_phone),
    photo_url = coalesce(nullif(p_photo_url, ''), photo_url),
    city = coalesce(nullif(p_city, ''), city),
    address_text = coalesce(nullif(p_address_text, ''), address_text),
    updated_at = now()
  where id = current_user_id;

  return jsonb_build_object('user_id', current_user_id);
end;
$$;

grant execute on function public.update_current_user_profile(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

alter table public.users
add column if not exists city text;

alter table public.users
add column if not exists address_text text;

alter table public.users
add column if not exists contact_phone text;

alter table public.workers
add column if not exists experience_years integer not null default 0;

create or replace function public.get_current_user_profile()
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
    raise exception 'Authentication is required to read profile';
  end if;

  select jsonb_build_object(
    'id', id,
    'role', role,
    'phone', phone,
    'contact_phone', contact_phone,
    'first_name', first_name,
    'last_name', last_name,
    'photo_url', photo_url,
    'city', city,
    'address_text', address_text,
    'rating_avg', rating_avg,
    'rating_count', rating_count,
    'status', status
  )
  into result
  from public.users
  where id = current_user_id;

  return result;
end;
$$;

grant execute on function public.get_current_user_profile()
to authenticated;

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
    'contact_phone', u.contact_phone,
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

grant execute on function public.get_current_worker_profile() to authenticated;

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
  p_contact_phone text,
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
    contact_phone = coalesce(nullif(p_contact_phone, ''), contact_phone),
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
  text,
  text[],
  integer,
  public.price_type,
  numeric,
  numeric,
  jsonb,
  jsonb
) to authenticated;

create or replace function public.add_worker_verification_document(
  p_type public.verification_document_type,
  p_file_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_worker_id uuid;
  completed boolean;
begin
  current_worker_id := public.current_app_worker_id();

  if current_worker_id is null then
    raise exception 'Only a worker can upload verification documents';
  end if;

  insert into public.verification_documents (
    worker_id,
    type,
    file_url,
    status
  )
  values (
    current_worker_id,
    p_type,
    p_file_url,
    'pending'
  )
  on conflict (worker_id, type) do update set
    file_url = excluded.file_url,
    status = 'pending',
    reviewed_by = null,
    reviewed_at = null;

  select count(*) = 3
  into completed
  from public.verification_documents
  where worker_id = current_worker_id
    and type in ('id_front', 'id_back', 'bank_account');

  if completed then
    update public.workers
    set verification_status = 'pending'
    where id = current_worker_id;
  end if;

  return jsonb_build_object(
    'worker_id',
    current_worker_id,
    'verification_status',
    case when completed then 'pending' else 'not_started' end
  );
end;
$$;

grant execute on function public.add_worker_verification_document(
  public.verification_document_type,
  text
) to authenticated;
