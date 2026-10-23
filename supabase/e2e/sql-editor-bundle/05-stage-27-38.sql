-- TEST PROJECT ONLY: ivguranttkxhxsdsppqk. Stage 5/9; source files 27-38 of 47.
-- Verify the Supabase Dashboard project URL/reference before running this entire file.
-- The database cannot independently authenticate its Supabase project reference.
-- Stage 5 requires the completed Stage 4 marker; never skip or replay stages.
begin;
do $e2e_guard$
begin
  if not exists (
    select 1 from public.e2e_sql_editor_install
    where singleton = true
      and project_ref = 'ivguranttkxhxsdsppqk'
      and completed_stage = 4
  ) then
    raise exception 'E2E SQL Editor install: expected completed stage 4; stop and inspect state';
  end if;
end;
$e2e_guard$;

-- BEGIN SOURCE 27: supabase/storage.sql
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
    'job-post-photos',
    'job-post-photos',
    true,
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
using (bucket_id in ('profile-photos', 'worker-portfolio', 'job-post-photos'));

drop policy if exists "authenticated users can upload job post photos"
on storage.objects;

create policy "authenticated users can upload job post photos"
on storage.objects for insert
with check (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own job post photos"
on storage.objects;

create policy "authenticated users can update own job post photos"
on storage.objects for update
using (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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

drop policy if exists "users can read own private files by folder"
on storage.objects;

create policy "users can read own private files by folder"
on storage.objects for select
using (
  bucket_id in ('verification-documents', 'booking-photos', 'chat-attachments')
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admins can read verification documents"
on storage.objects;

create policy "admins can read verification documents"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and public.current_app_user_is_admin()
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
-- END SOURCE 27: supabase/storage.sql

-- BEGIN SOURCE 28: supabase/marketplace_growth.sql
-- Remonter marketplace growth: client requests, capped worker interest,
-- portfolios and referral credits. Run this once in Supabase SQL Editor.

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 8 and 120),
  profession_name text not null,
  city text not null,
  area_label text,
  description text not null check (char_length(trim(description)) between 20 and 2000),
  photo_url text,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  preferred_date date,
  status text not null default 'open' check (status in ('open','selected','closed','cancelled')),
  selected_worker_id uuid references public.workers(id) on delete set null,
  interest_limit integer not null default 5 check (interest_limit between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max is null or budget_min is null or budget_max >= budget_min)
);

alter table public.job_posts add column if not exists photo_url text;

create table if not exists public.job_post_interests (
  id uuid primary key default gen_random_uuid(),
  job_post_id uuid not null references public.job_posts(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  message text check (char_length(message) <= 600),
  estimate_min numeric(10,2),
  estimate_max numeric(10,2),
  status text not null default 'pending' check (status in ('pending','selected','not_selected','withdrawn')),
  created_at timestamptz not null default now(),
  unique(job_post_id, worker_id),
  check (estimate_max is null or estimate_min is null or estimate_max >= estimate_min)
);

create table if not exists public.worker_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  image_url text not null,
  profession_name text,
  description text check (char_length(description) <= 400),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  referred_user_id uuid not null unique references public.users(id) on delete cascade,
  source_role public.user_role not null,
  status text not null default 'pending' check (status in ('pending','qualified','rewarded','rejected')),
  reward_credits integer not null default 0 check (reward_credits >= 0),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_user_id <> referred_user_id)
);

create index if not exists job_posts_open_created_idx on public.job_posts(status, created_at desc);
create index if not exists job_post_interests_post_idx on public.job_post_interests(job_post_id, created_at);
create index if not exists worker_portfolio_visible_idx on public.worker_portfolio_items(worker_id, is_visible, created_at desc);

alter table public.job_posts enable row level security;
alter table public.job_post_interests enable row level security;
alter table public.worker_portfolio_items enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- Open requests deliberately contain neighbourhood/city only. Exact address and phone
-- remain in the booking flow after the client selects a worker.
drop policy if exists "authenticated users can read open job posts" on public.job_posts;
create policy "authenticated users can read open job posts" on public.job_posts for select
using (auth.role() = 'authenticated' and (status = 'open' or client_id = public.current_app_user_id() or public.current_app_user_is_admin()));

drop policy if exists "clients can create own job posts" on public.job_posts;
create policy "clients can create own job posts" on public.job_posts for insert
with check (client_id = public.current_app_user_id());

drop policy if exists "clients can update own job posts" on public.job_posts;
create policy "clients can update own job posts" on public.job_posts for update
using (client_id = public.current_app_user_id() or public.current_app_user_is_admin())
with check (client_id = public.current_app_user_id() or public.current_app_user_is_admin());

drop policy if exists "participants can read job interests" on public.job_post_interests;
create policy "participants can read job interests" on public.job_post_interests for select
using (
  public.current_app_user_is_admin()
  or worker_id = public.current_app_worker_id()
  or exists (select 1 from public.job_posts p where p.id = job_post_id and p.client_id = public.current_app_user_id())
);

drop policy if exists "workers can create own job interest" on public.job_post_interests;
create policy "workers can create own job interest" on public.job_post_interests for insert
with check (worker_id = public.current_app_worker_id());

drop policy if exists "workers can update own job interest" on public.job_post_interests;
create policy "workers can update own job interest" on public.job_post_interests for update
using (worker_id = public.current_app_worker_id()) with check (worker_id = public.current_app_worker_id());

drop policy if exists "public can read visible portfolios" on public.worker_portfolio_items;
create policy "public can read visible portfolios" on public.worker_portfolio_items for select
using (is_visible or worker_id = public.current_app_worker_id() or public.current_app_user_is_admin());

drop policy if exists "workers manage own portfolio" on public.worker_portfolio_items;
create policy "workers manage own portfolio" on public.worker_portfolio_items for all
using (worker_id = public.current_app_worker_id() or public.current_app_user_is_admin())
with check (worker_id = public.current_app_worker_id() or public.current_app_user_is_admin());

drop policy if exists "users can read own referral code" on public.referral_codes;
create policy "users can read own referral code" on public.referral_codes for select
using (owner_user_id = public.current_app_user_id() or public.current_app_user_is_admin());

drop policy if exists "users can read their referrals" on public.referrals;
create policy "users can read their referrals" on public.referrals for select
using (referrer_user_id = public.current_app_user_id() or referred_user_id = public.current_app_user_id() or public.current_app_user_is_admin());

create or replace function public.create_job_post(
  p_title text, p_profession_name text, p_city text, p_area_label text,
  p_description text, p_budget_min numeric default null, p_budget_max numeric default null,
  p_preferred_date date default null
) returns public.job_posts
language plpgsql security invoker set search_path = public as $$
declare result public.job_posts;
begin
  if public.current_app_user_id() is null then raise exception 'Authentication required'; end if;
  insert into public.job_posts (client_id,title,profession_name,city,area_label,description,budget_min,budget_max,preferred_date)
  values (public.current_app_user_id(), trim(p_title), trim(p_profession_name), trim(p_city), nullif(trim(coalesce(p_area_label,'')),''), trim(p_description), p_budget_min, p_budget_max, p_preferred_date)
  returning * into result;
  return result;
end $$;

create or replace function public.express_interest_in_job_post(
  p_job_post_id uuid, p_message text default null, p_estimate_min numeric default null, p_estimate_max numeric default null
) returns public.job_post_interests
language plpgsql security definer set search_path = public as $$
declare v_worker uuid; v_post public.job_posts; v_count integer; result public.job_post_interests;
begin
  v_worker := public.current_app_worker_id();
  if v_worker is null then raise exception 'Only a craftsman can respond to a request'; end if;
  select * into v_post from public.job_posts where id = p_job_post_id for update;
  if not found or v_post.status <> 'open' then raise exception 'This request is no longer open'; end if;
  if not exists (select 1 from public.workers w where w.id=v_worker and w.is_active and w.verification_status='verified') then raise exception 'Only verified active craftspeople can respond'; end if;
  select count(*) into v_count from public.job_post_interests where job_post_id = p_job_post_id and status <> 'withdrawn';
  if v_count >= v_post.interest_limit then raise exception 'This request already has enough responses'; end if;
  insert into public.job_post_interests(job_post_id,worker_id,message,estimate_min,estimate_max)
  values(p_job_post_id,v_worker,nullif(trim(coalesce(p_message,'')),''),p_estimate_min,p_estimate_max)
  returning * into result;
  return result;
end $$;

create or replace function public.select_job_post_worker(p_job_post_id uuid, p_worker_id uuid)
returns public.job_posts language plpgsql security definer set search_path = public as $$
declare result public.job_posts; v_client uuid;
begin
  v_client := public.current_app_user_id();
  if v_client is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.job_post_interests
    where job_post_id = p_job_post_id and worker_id = p_worker_id and status = 'pending'
  ) then raise exception 'This craftsman is not available for this request'; end if;
  if not exists (
    select 1 from public.workers
    where id = p_worker_id and is_active and verification_status = 'verified'
  ) then raise exception 'This craftsman is no longer available'; end if;
  update public.job_posts set status='selected', selected_worker_id=p_worker_id, updated_at=now()
  where id=p_job_post_id and client_id=v_client and status='open'
  returning * into result;
  if not found then raise exception 'Request cannot be updated'; end if;
  update public.job_post_interests set status=case when worker_id=p_worker_id then 'selected' else 'not_selected' end where job_post_id=p_job_post_id;
  return result;
end $$;

create or replace function public.get_or_create_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid; result text;
begin
  v_user := public.current_app_user_id();
  if v_user is null then raise exception 'Authentication required'; end if;
  select code into result from public.referral_codes where owner_user_id=v_user;
  if result is null then
    result := upper(substr(replace(v_user::text,'-',''),1,8));
    insert into public.referral_codes(owner_user_id,code) values(v_user,result)
    on conflict (owner_user_id) do update set owner_user_id=excluded.owner_user_id
    returning code into result;
  end if;
  return result;
end $$;

create or replace function public.add_current_worker_portfolio_item(
  p_image_url text, p_profession_name text default null, p_description text default null
) returns public.worker_portfolio_items
language plpgsql security invoker set search_path = public as $$
declare result public.worker_portfolio_items;
begin
  if public.current_app_worker_id() is null then raise exception 'Only a craftsman can add portfolio work'; end if;
  insert into public.worker_portfolio_items(worker_id,image_url,profession_name,description)
  values(public.current_app_worker_id(),trim(p_image_url),nullif(trim(coalesce(p_profession_name,'')),''),nullif(trim(coalesce(p_description,'')),''))
  returning * into result;
  return result;
end $$;

create or replace function public.apply_referral_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_referrer uuid; v_role public.user_role;
begin
  v_user := public.current_app_user_id();
  if v_user is null then raise exception 'Authentication required'; end if;
  select owner_user_id into v_referrer from public.referral_codes where code=upper(trim(p_code));
  if v_referrer is null then raise exception 'Referral code was not found'; end if;
  if v_referrer=v_user then raise exception 'You cannot use your own code'; end if;
  select role into v_role from public.users where id=v_user and status='active';
  if v_role is null then raise exception 'Active application profile is required'; end if;
  insert into public.referrals(referrer_user_id,referred_user_id,source_role)
  values(v_referrer,v_user,v_role)
  on conflict(referred_user_id) do nothing;
  return jsonb_build_object('ok',true,'message','რეფერალი დაემატა. ბონუსი ჩაირიცხება კვალიფიცირებული აქტივობის შემდეგ.');
end $$;

grant execute on function public.create_job_post(text,text,text,text,text,numeric,numeric,date) to authenticated;
grant execute on function public.express_interest_in_job_post(uuid,text,numeric,numeric) to authenticated;
grant execute on function public.select_job_post_worker(uuid,uuid) to authenticated;
grant execute on function public.get_or_create_referral_code() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.add_current_worker_portfolio_item(text,text,text) to authenticated;

-- Safe catalogue RPC: only the already-sanitized worker_cards columns leave the
-- database. This keeps the view security-invoker while avoiding empty catalogues
-- caused by RLS on its source tables.
create or replace function public.get_public_worker_cards()
returns setof public.worker_cards
language sql stable security definer set search_path = public as $$
  select * from public.worker_cards
  order by rating_avg desc nulls last, rating_count desc, created_at desc;
$$;

revoke all on function public.get_public_worker_cards() from public;
grant execute on function public.get_public_worker_cards() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-post-photos', 'job-post-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public can read job post photos" on storage.objects;
create policy "public can read job post photos" on storage.objects for select
using (bucket_id='job-post-photos');

drop policy if exists "users can upload own job post photos" on storage.objects;
create policy "users can upload own job post photos" on storage.objects for insert
with check (bucket_id='job-post-photos' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "users can update own job post photos" on storage.objects;
create policy "users can update own job post photos" on storage.objects for update
using (bucket_id='job-post-photos' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='job-post-photos' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "users can delete own job post photos" on storage.objects;
create policy "users can delete own job post photos" on storage.objects for delete
using (bucket_id='job-post-photos' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);

-- Portfolio uploads share the worker's auth folder and are public only after a visible item exists.
drop policy if exists "workers can upload own portfolio files" on storage.objects;
create policy "workers can upload own portfolio files" on storage.objects for insert
with check (bucket_id='worker-portfolio' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "workers can delete own portfolio files" on storage.objects;
create policy "workers can delete own portfolio files" on storage.objects for delete
using (bucket_id='worker-portfolio' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);
-- END SOURCE 28: supabase/marketplace_growth.sql

-- BEGIN SOURCE 29: supabase/marketplace_job_post_hotfix.sql
-- Remonter hotfix: client job-post gallery (up to three photos) and client cancellation.
-- Run after marketplace_growth.sql in Supabase SQL Editor.

alter table public.job_posts
  add column if not exists photo_urls jsonb not null default '[]'::jsonb;

update public.job_posts
set photo_urls = jsonb_build_array(photo_url)
where photo_url is not null
  and photo_url <> ''
  and photo_urls = '[]'::jsonb;

create or replace function public.cancel_my_job_post(p_job_post_id uuid)
returns public.job_posts
language plpgsql
security invoker
set search_path = public
as $$
declare result public.job_posts;
begin
  update public.job_posts
  set status = 'cancelled', updated_at = now()
  where id = p_job_post_id
    and client_id = public.current_app_user_id()
    and status = 'open'
  returning * into result;

  if not found then
    raise exception 'Only an open request created by you can be cancelled';
  end if;

  update public.job_post_interests
  set status = 'withdrawn'
  where job_post_id = p_job_post_id
    and status = 'pending';

  return result;
end;
$$;

grant execute on function public.cancel_my_job_post(uuid) to authenticated;

-- Keep the public gallery bucket constrained to the authenticated user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-post-photos', 'job-post-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can upload job post photos" on storage.objects;
create policy "authenticated users can upload job post photos"
on storage.objects for insert
with check (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own job post photos" on storage.objects;
create policy "authenticated users can update own job post photos"
on storage.objects for update
using (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'job-post-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
-- END SOURCE 29: supabase/marketplace_job_post_hotfix.sql

-- BEGIN SOURCE 30: supabase/message_time_hotfix.sql
-- Remonter hotfix: show booking times in Tbilisi time inside message threads.
-- Run this once in Supabase SQL Editor.

create or replace function public.list_my_message_threads()
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

  if current_user_id is null then
    raise exception 'Authentication is required to read message threads';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'archived')::boolean, ((item ->> 'unread_count')::integer > 0) desc, (item ->> 'last_at') desc nulls last), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'booking_id', b.id,
      'title', case
        when b.client_id = current_user_id then coalesce(w.display_name, trim(concat_ws(' ', wu.first_name, wu.last_name)), 'ხელოსანი')
        else trim(concat_ws(' ', cu.first_name, left(coalesce(cu.last_name, ''), 1) || case when cu.last_name is null or cu.last_name = '' then '' else '.' end))
      end,
      'subtitle', concat_ws(
        ' · ',
        coalesce(p.name, 'სამუშაო'),
        to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'DD.MM.YYYY'),
        to_char(b.scheduled_at at time zone 'Asia/Tbilisi', 'HH24:MI')
      ),
      'status', b.status,
      'last_text', coalesce(last_message.text, 'ჯერ მიმოწერა არ არის'),
      'last_at', last_message.created_at,
      'unread_count', (
        select count(*) from public.messages unread_messages
        left join public.users unread_sender on unread_sender.id = unread_messages.sender_id
        where unread_messages.booking_id = b.id
          and unread_messages.sender_id <> current_user_id
          and unread_messages.read_at is null
          and coalesce(unread_sender.role::text, '') <> 'admin'
          and unread_messages.text not like 'სისტემა:%'
      ),
      'archived', b.status::text in ('client_confirmed', 'closed', 'completed', 'declined', 'cancelled')
    ) as item
    from public.bookings b
    join public.workers w on w.id = b.worker_id
    join public.users wu on wu.id = w.user_id
    join public.users cu on cu.id = b.client_id
    left join public.professions p on p.id = b.profession_id
    left join lateral (
      select case when m.attachment_url is not null and nullif(m.text, '') is null then 'ფოტო' else m.text end as text, m.created_at
      from public.messages m
      left join public.users sender_user on sender_user.id = m.sender_id
      where m.booking_id = b.id
        and coalesce(sender_user.role::text, '') <> 'admin'
        and m.text not like 'სისტემა:%'
      order by m.created_at desc limit 1
    ) last_message on true
    where b.client_id = current_user_id
      or b.worker_id = current_worker_id
      or public.current_app_user_is_admin()
  ) threads;
  return result;
end;
$$;

grant execute on function public.list_my_message_threads() to authenticated;
notify pgrst, 'reload schema';
-- END SOURCE 30: supabase/message_time_hotfix.sql

-- BEGIN SOURCE 31: supabase/storage_profile_hotfix.sql
-- Remonter hotfix: authenticated profile and verification uploads.
-- Run this once when profile or verification uploads are rejected with RLS/Unauthorized.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('verification-documents', 'verification-documents', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can upload profile photos" on storage.objects;
create policy "authenticated users can upload profile photos"
on storage.objects for insert
with check (
  bucket_id = 'profile-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own profile photos" on storage.objects;
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

drop policy if exists "authenticated users can upload verification documents" on storage.objects;
create policy "authenticated users can upload verification documents"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own verification documents" on storage.objects;
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

drop policy if exists "users can read own private files by folder" on storage.objects;
create policy "users can read own private files by folder"
on storage.objects for select
using (
  bucket_id in ('verification-documents', 'booking-photos', 'chat-attachments')
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admins can read verification documents" on storage.objects;
create policy "admins can read verification documents"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and auth.role() = 'authenticated'
  and public.current_app_user_is_admin()
);
-- END SOURCE 31: supabase/storage_profile_hotfix.sql

-- BEGIN SOURCE 32: supabase/e2e/e2e_admin_owner_access.sql
-- E2E PROJECT ONLY. This is the test-safe equivalent of admin_owner_access.sql.
-- It intentionally creates no Admin allow-list entry. Fixture automation adds
-- and later removes its dedicated disposable Admin identity.

create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;
revoke all on public.admin_allowlist from anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  phone_value text;
  first_name_value text;
  last_name_value text;
begin
  requested_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    'client'::public.user_role
  );

  if requested_role = 'admin'::public.user_role then
    requested_role := 'client'::public.user_role;
  end if;

  phone_value := coalesce(new.phone, new.raw_user_meta_data ->> 'phone', new.email);
  first_name_value := new.raw_user_meta_data ->> 'first_name';
  last_name_value := new.raw_user_meta_data ->> 'last_name';

  if phone_value is null then
    raise exception 'Cannot create app user without phone or email';
  end if;

  insert into public.users (
    auth_user_id, role, phone, first_name, last_name, status, last_login_at
  ) values (
    new.id, requested_role, phone_value, first_name_value, last_name_value, 'active', now()
  )
  on conflict (auth_user_id) do update set
    phone = excluded.phone,
    first_name = coalesce(excluded.first_name, public.users.first_name),
    last_name = coalesce(excluded.last_name, public.users.last_name),
    status = 'active',
    last_login_at = now();

  if requested_role = 'craftsman'::public.user_role then
    insert into public.workers (user_id, display_name, trial_started_at, subscription_status)
    select
      users.id,
      trim(coalesce(users.first_name, '') || ' ' || coalesce(users.last_name, '')),
      now(),
      'active'::public.subscription_status
    from public.users
    where users.auth_user_id = new.id
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

update public.users
set role = 'client'::public.user_role
where role = 'admin'::public.user_role
  and auth_user_id not in (
    select au.id
    from auth.users au
    join public.admin_allowlist al on lower(au.email) = al.email
  );

update public.users u
set role = 'admin'::public.user_role,
    status = 'active'::public.user_status
from auth.users au
join public.admin_allowlist al on lower(au.email) = al.email
where u.auth_user_id = au.id;

create or replace function public.current_app_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and role = 'admin'::public.user_role
      and status = 'active'::public.user_status
      and lower(coalesce(auth.jwt() ->> 'email', '')) in (
        select email from public.admin_allowlist
      )
  );
$$;
-- END SOURCE 32: supabase/e2e/e2e_admin_owner_access.sql

-- BEGIN SOURCE 33: supabase/marketplace_job_post_description_hotfix.sql
-- Remonter hotfix: a client may publish a short or empty job description.
-- Run once in Supabase SQL Editor after marketplace_growth.sql.

alter table public.job_posts
  drop constraint if exists job_posts_description_check;

alter table public.job_posts
  add constraint job_posts_description_check
  check (char_length(trim(description)) <= 2000);
-- END SOURCE 33: supabase/marketplace_job_post_description_hotfix.sql

-- BEGIN SOURCE 34: supabase/marketplace_job_post_title_hotfix.sql
-- Remonter hotfix: title is optional in the client form and may be short.
-- Run once in Supabase SQL Editor after marketplace_growth.sql.

alter table public.job_posts
  drop constraint if exists job_posts_title_check;

alter table public.job_posts
  add constraint job_posts_title_check
  check (char_length(trim(title)) <= 160);
-- END SOURCE 34: supabase/marketplace_job_post_title_hotfix.sql

-- BEGIN SOURCE 35: supabase/marketplace_interest_rls_hotfix.sql
-- Let the interest RPC lock a visible open request without requiring a worker
-- to satisfy the client-only job_posts UPDATE policy. The function retains
-- explicit worker identity, verification, status, and cap checks below.

create or replace function public.express_interest_in_job_post(
  p_job_post_id uuid, p_message text default null, p_estimate_min numeric default null, p_estimate_max numeric default null
) returns public.job_post_interests
language plpgsql
security definer
set search_path = public
as $$
declare v_worker uuid; v_post public.job_posts; v_count integer; result public.job_post_interests;
begin
  v_worker := public.current_app_worker_id();
  if v_worker is null then raise exception 'Only a craftsman can respond to a request'; end if;

  select * into v_post from public.job_posts where id = p_job_post_id for update;
  if not found or v_post.status <> 'open' then raise exception 'This request is no longer open'; end if;

  if not exists (
    select 1 from public.workers w
    where w.id = v_worker and w.is_active and w.verification_status = 'verified'
  ) then raise exception 'Only verified active craftspeople can respond'; end if;

  select count(*) into v_count
  from public.job_post_interests
  where job_post_id = p_job_post_id and status <> 'withdrawn';
  if v_count >= v_post.interest_limit then raise exception 'This request already has enough responses'; end if;

  insert into public.job_post_interests(job_post_id, worker_id, message, estimate_min, estimate_max)
  values(p_job_post_id, v_worker, nullif(trim(coalesce(p_message, '')), ''), p_estimate_min, p_estimate_max)
  returning * into result;
  return result;
end;
$$;

grant execute on function public.express_interest_in_job_post(uuid, text, numeric, numeric) to authenticated;
-- END SOURCE 35: supabase/marketplace_interest_rls_hotfix.sql

-- BEGIN SOURCE 36: supabase/marketplace_selection_rls_hotfix.sql
-- Run once after marketplace_growth.sql. This preserves client ownership and
-- pending-candidate checks while allowing the RPC to update interest statuses.
create or replace function public.select_job_post_worker(p_job_post_id uuid, p_worker_id uuid)
returns public.job_posts language plpgsql security definer set search_path = public as $$
declare result public.job_posts; v_client uuid;
begin
  v_client := public.current_app_user_id();
  if v_client is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.job_post_interests
    where job_post_id = p_job_post_id and worker_id = p_worker_id and status = 'pending'
  ) then raise exception 'This craftsman is not available for this request'; end if;
  if not exists (
    select 1 from public.workers
    where id = p_worker_id and is_active and verification_status = 'verified'
  ) then raise exception 'This craftsman is no longer available'; end if;

  update public.job_posts set status='selected', selected_worker_id=p_worker_id, updated_at=now()
  where id=p_job_post_id and client_id=v_client and status='open'
  returning * into result;
  if not found then raise exception 'Request cannot be updated'; end if;

  update public.job_post_interests
  set status=case when worker_id=p_worker_id then 'selected' else 'not_selected' end
  where job_post_id=p_job_post_id;
  return result;
end $$;

grant execute on function public.select_job_post_worker(uuid,uuid) to authenticated;
-- END SOURCE 36: supabase/marketplace_selection_rls_hotfix.sql

-- BEGIN SOURCE 37: supabase/marketplace_booking_hotfix.sql
-- FIXART marketplace booking bridge.
-- Run this after schema.sql, policies.sql, booking_actions.sql and marketplace_growth.sql.

alter table public.bookings
add column if not exists job_post_id uuid references public.job_posts(id) on delete set null;

create unique index if not exists bookings_one_per_job_post_idx
on public.bookings (job_post_id)
where job_post_id is not null;

create or replace function public.create_booking_from_job_post(
  p_job_post_id uuid,
  p_scheduled_at timestamptz,
  p_address_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := public.current_app_user_id();
  v_post public.job_posts%rowtype;
  v_booking_id uuid;
  v_worker_user_id uuid;
  v_profession_id uuid;
  v_platform_settings jsonb;
  v_booking_fee numeric;
  v_payment_provider text;
  v_payment_currency text;
begin
  if v_client_id is null then
    raise exception 'Authentication is required to create a booking';
  end if;

  if p_scheduled_at is null or nullif(trim(coalesce(p_address_text, '')), '') is null then
    raise exception 'Exact scheduled date/time and address are required';
  end if;

  select * into v_post
  from public.job_posts
  where id = p_job_post_id
    and client_id = v_client_id
  for update;

  if v_post.id is null then
    raise exception 'Job post not found';
  end if;

  if v_post.status <> 'selected' or v_post.selected_worker_id is null then
    raise exception 'A selected worker is required before creating a booking';
  end if;

  if exists (select 1 from public.bookings where job_post_id = v_post.id) then
    raise exception 'A booking already exists for this job post';
  end if;

  select w.user_id into v_worker_user_id
  from public.workers w
  join public.users u on u.id = w.user_id
  where w.id = v_post.selected_worker_id
    and w.is_active = true
    and w.verification_status = 'verified'
    and u.status = 'active';

  if v_worker_user_id is null then
    raise exception 'Selected worker is no longer available for bookings';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.worker_id = v_post.selected_worker_id
      and b.scheduled_at = p_scheduled_at
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ეს დრო უკვე დაკავებულია. აირჩიეთ სხვა დრო.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.worker_id = v_post.selected_worker_id
      and b.client_id = v_client_id
      and b.status in ('pending', 'confirmed', 'en_route', 'started', 'worker_completed')
  ) then
    raise exception 'ამ ხელოსანთან უკვე გაქვთ აქტიური ჯავშანი. ჯერ დაასრულეთ ან გააუქმეთ არსებული ჯავშანი.';
  end if;

  select p.id into v_profession_id
  from public.professions p
  where p.name = v_post.profession_name and p.is_active = true
  limit 1;

  if v_profession_id is null then
    select coalesce(w.main_profession_id, wp.profession_id) into v_profession_id
    from public.workers w
    left join lateral (
      select worker_professions.profession_id
      from public.worker_professions
      join public.professions p on p.id = worker_professions.profession_id and p.is_active = true
      where worker_professions.worker_id = w.id
      order by p.name
      limit 1
    ) wp on true
    where w.id = v_post.selected_worker_id;
  end if;

  select value_json into v_platform_settings
  from public.platform_settings where key = 'platform';
  v_booking_fee := coalesce(
    case when v_platform_settings ? 'bookingFee' then (v_platform_settings ->> 'bookingFee')::numeric end,
    15,
    0
  );
  v_payment_provider := coalesce(nullif(v_platform_settings ->> 'paymentProvider', ''), 'manual_mvp_hold');
  v_payment_currency := coalesce(nullif(v_platform_settings ->> 'paymentCurrency', ''), 'GEL');

  insert into public.bookings (
    job_post_id, client_id, worker_id, profession_id, scheduled_at, status,
    city, address_text, client_comment, booking_fee_amount, payment_status
  ) values (
    v_post.id, v_client_id, v_post.selected_worker_id, v_profession_id, p_scheduled_at, 'pending',
    v_post.city, nullif(trim(p_address_text), ''), nullif(trim(v_post.description), ''), v_booking_fee,
    case when v_booking_fee > 0 then 'authorized'::public.payment_status else 'not_required'::public.payment_status end
  ) returning id into v_booking_id;

  insert into public.booking_details (booking_id, work_scope, photo_note, extra_measurements)
  values (
    v_booking_id,
    nullif(trim(v_post.title), ''),
    case when v_post.photo_url is not null then 'მოთხოვნას აქვს დამატებული ფოტოები.' else null end,
    jsonb_build_object('job_post_id', v_post.id, 'area_label', v_post.area_label)
  );

  if v_booking_fee > 0 then
    insert into public.payments (booking_id, payer_id, worker_id, amount, currency, provider, provider_payment_id, status)
    values (v_booking_id, v_client_id, v_post.selected_worker_id, v_booking_fee, v_payment_currency, v_payment_provider, 'mvp-' || v_booking_id::text, 'authorized');
  end if;

  insert into public.notifications (user_id, booking_id, type, title, body)
  values (v_worker_user_id, v_booking_id, 'new_booking', 'ახალი ჯავშანი', 'კლიენტმა არჩეულ მოთხოვნაზე ჯავშანი გამოგიგზავნათ.');

  return jsonb_build_object('booking_id', v_booking_id, 'job_post_id', v_post.id);
end;
$$;

grant execute on function public.create_booking_from_job_post(uuid, timestamptz, text) to authenticated;
-- END SOURCE 37: supabase/marketplace_booking_hotfix.sql

-- BEGIN SOURCE 38: supabase/marketplace_job_post_archive_hotfix.sql
-- FIXART job-post soft archive.
-- Run after marketplace_growth.sql and marketplace interest/selection hotfixes.

alter table public.job_posts
  add column if not exists archived_at timestamptz;

drop policy if exists "authenticated users can read open job posts" on public.job_posts;
create policy "authenticated users can read open job posts"
on public.job_posts for select
using (
  auth.role() = 'authenticated'
  and (
    (status = 'open' and archived_at is null)
    or client_id = public.current_app_user_id()
    or public.current_app_user_is_admin()
  )
);

create or replace function public.archive_my_job_post(p_job_post_id uuid)
returns public.job_posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.job_posts;
begin
  update public.job_posts
  set
    archived_at = now(),
    updated_at = now(),
    -- An open request must stop accepting interests once archived. Selected
    -- requests keep their existing status so booking history remains intact.
    status = case when status = 'open' then 'cancelled' else status end
  where id = p_job_post_id
    and client_id = public.current_app_user_id()
    and archived_at is null
  returning * into result;

  if not found then
    raise exception 'Only your own non-archived job post can be archived';
  end if;

  return result;
end;
$$;

revoke all on function public.archive_my_job_post(uuid) from public, anon;
grant execute on function public.archive_my_job_post(uuid) to authenticated;
-- END SOURCE 38: supabase/marketplace_job_post_archive_hotfix.sql

update public.e2e_sql_editor_install
set completed_stage = 5, updated_at = now()
where singleton = true
  and project_ref = 'ivguranttkxhxsdsppqk'
  and completed_stage = 4;
commit;
