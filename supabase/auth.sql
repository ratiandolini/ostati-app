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
  phone_value := coalesce(new.phone, new.raw_user_meta_data ->> 'phone', new.email);
  first_name_value := new.raw_user_meta_data ->> 'first_name';
  last_name_value := new.raw_user_meta_data ->> 'last_name';

  if phone_value is null then
    raise exception 'Cannot create app user without phone or email';
  end if;

  insert into public.users (
    auth_user_id,
    role,
    phone,
    first_name,
    last_name,
    status,
    last_login_at
  ) values (
    new.id,
    requested_role,
    phone_value,
    first_name_value,
    last_name_value,
    'active',
    now()
  )
  on conflict (auth_user_id) do update set
    phone = excluded.phone,
    role = excluded.role,
    first_name = coalesce(excluded.first_name, public.users.first_name),
    last_name = coalesce(excluded.last_name, public.users.last_name),
    status = 'active',
    last_login_at = now();

  if requested_role = 'craftsman' then
    insert into public.workers (
      user_id,
      display_name,
      trial_started_at,
      subscription_status
    )
    select
      users.id,
      trim(coalesce(users.first_name, '') || ' ' || coalesce(users.last_name, '')),
      now(),
      'trial'
    from public.users
    where users.auth_user_id = new.id
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_auth_user();
