-- Remonter: only the owner can access the Admin panel.
-- Owner email: rati3@gmail.com
-- Run once in Supabase SQL Editor.

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

  -- Public sign-up can create clients or craftsmen, never an Admin account.
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

-- Keep precisely one active Admin user. The owner account must already exist in Auth.
update public.users
set role = 'client'::public.user_role
where role = 'admin'::public.user_role
  and auth_user_id not in (
    select id from auth.users where lower(email) = 'rati3@gmail.com'
  );

update public.users u
set role = 'admin'::public.user_role,
    status = 'active'::public.user_status
from auth.users au
where u.auth_user_id = au.id
  and lower(au.email) = 'rati3@gmail.com';

-- All RLS policies using this helper now require both Admin role and owner email.
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
      and lower(coalesce(auth.jwt() ->> 'email', '')) = 'rati3@gmail.com'
  );
$$;
