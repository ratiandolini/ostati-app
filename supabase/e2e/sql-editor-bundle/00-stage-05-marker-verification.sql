-- READ ONLY. Open ONLY https://supabase.com/dashboard/project/ivguranttkxhxsdsppqk/sql/new
-- This checks the Stage 5 marker created with the superseded project reference.
-- The Dashboard URL, not this query, establishes which Supabase project is open.
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
       to_regclass('public.e2e_test_environment') as fixture_opt_in_table,
       case
         when marker.row_count = 1
          and marker.project_ref = 'ivquranttkxhxsdspqk'
          and marker.completed_stage = 5
          and ref_constraint.row_count = 1
          and ref_constraint.definition like '%ivquranttkxhxsdspqk%'
          and to_regclass('public.e2e_test_environment') is null
         then 'READY FOR MARKER REPAIR'
         else 'STOP: UNEXPECTED STATE'
       end as repair_readiness
from marker cross join ref_constraint;
