-- TEST PROJECT ONLY. Never run this in the production Supabase project.
--
-- This adds no application feature. It creates an opt-in guard for the local/CI
-- fixture script, which refuses to mutate anything until the operator records
-- the dedicated test project reference below.

create table if not exists public.e2e_test_environment (
  singleton boolean primary key default true check (singleton),
  project_ref text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.e2e_test_environment enable row level security;
revoke all on table public.e2e_test_environment from public, anon, authenticated;

create or replace function public.e2e_assert_isolated_test_environment(
  p_project_ref text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_ref text;
  is_enabled boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'E2E fixture actions require the test project service role';
  end if;

  select project_ref, enabled
  into configured_ref, is_enabled
  from public.e2e_test_environment
  where singleton = true;

  if configured_ref is null or not coalesce(is_enabled, false) then
    raise exception 'E2E test environment is not enabled';
  end if;

  if configured_ref is distinct from nullif(trim(p_project_ref), '') then
    raise exception 'E2E project reference does not match this database';
  end if;
end;
$$;

revoke all on function public.e2e_assert_isolated_test_environment(text) from public, anon, authenticated;
grant execute on function public.e2e_assert_isolated_test_environment(text) to service_role;

-- Run this one statement manually ONLY in the dedicated test project, using its
-- project reference. The fixture runner will remain locked until it exists.
--
-- insert into public.e2e_test_environment (singleton, project_ref, enabled)
-- values (true, 'your-test-project-ref', true)
-- on conflict (singleton) do update
-- set project_ref = excluded.project_ref, enabled = true;
