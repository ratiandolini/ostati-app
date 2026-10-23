-- TEST PROJECT ONLY: https://supabase.com/dashboard/project/ivguranttkxhxsdsppqk/sql/new
-- Run ONLY after 00-stage-05-marker-verification.sql returns READY FOR MARKER REPAIR.
-- This changes only the Stage 5 installation marker and its project-ref CHECK.
-- SQL cannot independently verify the hosted Supabase project identity: check the Dashboard URL.
begin;
set local lock_timeout = '5s';

do $e2e_guard$
begin
  if to_regclass('public.e2e_sql_editor_install') is null
     or to_regclass('public.e2e_test_environment') is not null then
    raise exception 'E2E marker repair: missing marker or unexpected fixture opt-in table';
  end if;

  if (select count(*) from public.e2e_sql_editor_install) <> 1
     or not exists (
       select 1 from public.e2e_sql_editor_install
       where singleton = true
         and project_ref = 'ivquranttkxhxsdspqk'
         and completed_stage = 5
     ) then
    raise exception 'E2E marker repair: expected exactly one superseded-ref Stage 5 marker';
  end if;

  if (select count(*)
      from pg_catalog.pg_constraint c
      where c.conrelid = 'public.e2e_sql_editor_install'::regclass
        and c.conname = 'e2e_sql_editor_install_project_ref_check'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%ivquranttkxhxsdspqk%') <> 1 then
    raise exception 'E2E marker repair: expected the superseded project-ref CHECK';
  end if;
end;
$e2e_guard$;

alter table public.e2e_sql_editor_install
  drop constraint e2e_sql_editor_install_project_ref_check;

do $e2e_update$
declare
  updated_rows integer;
begin
  update public.e2e_sql_editor_install
  set project_ref = 'ivguranttkxhxsdsppqk', updated_at = now()
  where singleton = true
    and project_ref = 'ivquranttkxhxsdspqk'
    and completed_stage = 5;
  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception 'E2E marker repair: expected one marker update';
  end if;
end;
$e2e_update$;

alter table public.e2e_sql_editor_install
  add constraint e2e_sql_editor_install_project_ref_check
  check (project_ref = 'ivguranttkxhxsdsppqk');

do $e2e_verify$
begin
  if not exists (
    select 1 from public.e2e_sql_editor_install
    where singleton = true
      and project_ref = 'ivguranttkxhxsdsppqk'
      and completed_stage = 5
  ) then
    raise exception 'E2E marker repair: final marker verification failed';
  end if;
end;
$e2e_verify$;
commit;
