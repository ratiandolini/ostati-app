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
language plpgsql security invoker set search_path = public as $$
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
returns public.job_posts language plpgsql security invoker set search_path = public as $$
declare result public.job_posts;
begin
  update public.job_posts set status='selected', selected_worker_id=p_worker_id, updated_at=now()
  where id=p_job_post_id and client_id=public.current_app_user_id() and status='open'
  returning * into result;
  if not found then raise exception 'Request cannot be updated'; end if;
  update public.job_post_interests set status=case when worker_id=p_worker_id then 'selected' else 'not_selected' end where job_post_id=p_job_post_id;
  return result;
end $$;

create or replace function public.get_or_create_referral_code()
returns text language plpgsql security invoker set search_path = public as $$
declare result text;
begin
  select code into result from public.referral_codes where owner_user_id=public.current_app_user_id();
  if result is null then
    result := upper(substr(replace(public.current_app_user_id()::text,'-',''),1,8));
    insert into public.referral_codes(owner_user_id,code) values(public.current_app_user_id(),result);
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
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_referrer uuid; v_role public.user_role;
begin
  select owner_user_id into v_referrer from public.referral_codes where code=upper(trim(p_code));
  if v_referrer is null then raise exception 'Referral code was not found'; end if;
  if v_referrer=public.current_app_user_id() then raise exception 'You cannot use your own code'; end if;
  select role into v_role from public.users where id=public.current_app_user_id();
  insert into public.referrals(referrer_user_id,referred_user_id,source_role)
  values(v_referrer,public.current_app_user_id(),v_role)
  on conflict(referred_user_id) do nothing;
  return jsonb_build_object('ok',true,'message','რეფერალი დაემატა. ბონუსი ჩაირიცხება კვალიფიცირებული აქტივობის შემდეგ.');
end $$;

grant execute on function public.create_job_post(text,text,text,text,text,numeric,numeric,date) to authenticated;
grant execute on function public.express_interest_in_job_post(uuid,text,numeric,numeric) to authenticated;
grant execute on function public.select_job_post_worker(uuid,uuid) to authenticated;
grant execute on function public.get_or_create_referral_code() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.add_current_worker_portfolio_item(text,text,text) to authenticated;

-- Portfolio uploads share the worker's auth folder and are public only after a visible item exists.
drop policy if exists "workers can upload own portfolio files" on storage.objects;
create policy "workers can upload own portfolio files" on storage.objects for insert
with check (bucket_id='worker-portfolio' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "workers can delete own portfolio files" on storage.objects;
create policy "workers can delete own portfolio files" on storage.objects for delete
using (bucket_id='worker-portfolio' and auth.role()='authenticated' and (storage.foldername(name))[1]=auth.uid()::text);
