-- READ ONLY. Open ONLY https://supabase.com/dashboard/project/ivguranttkxhxsdsppqk/sql/new
-- The project reference is verified in the Dashboard, not by current_database().
select case when to_regclass('public.users') is null and to_regclass('public.e2e_test_environment') is null and to_regclass('public.e2e_sql_editor_install') is null and not exists (select 1 from auth.users) and not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')) then 'READY' else 'STOP: NOT FRESH' end as installation_state,
  to_regclass('public.users') as app_users_table,
  to_regclass('public.e2e_sql_editor_install') as stage_marker,
  to_regclass('public.e2e_test_environment') as fixture_opt_in,
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')) as public_table_count;
