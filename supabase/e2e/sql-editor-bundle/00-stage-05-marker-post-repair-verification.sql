-- READ ONLY. Open ONLY https://supabase.com/dashboard/project/ivguranttkxhxsdsppqk/sql/new
-- Run after the one-time marker repair and before Stage 06.
with marker as (
  select count(*) as row_count,
         max(project_ref) as project_ref,
         max(completed_stage) as completed_stage
  from public.e2e_sql_editor_install
), ref_constraint as (
  select count(*) as row_count,
         max(pg_get_constraintdef(c.oid)) as definition
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.e2e_sql_editor_install'::regclass
    and c.conname = 'e2e_sql_editor_install_project_ref_check'
    and c.contype = 'c'
)
select marker.project_ref,
       marker.completed_stage,
       ref_constraint.definition as project_ref_check,
       case
         when marker.row_count = 1
          and marker.project_ref = 'ivguranttkxhxsdsppqk'
          and marker.completed_stage = 5
          and ref_constraint.row_count = 1
          and ref_constraint.definition like '%ivguranttkxhxsdsppqk%'
          and to_regclass('public.e2e_test_environment') is null
         then 'READY FOR STAGE 06'
         else 'STOP: UNEXPECTED STATE'
       end as stage_06_readiness
from marker cross join ref_constraint;
