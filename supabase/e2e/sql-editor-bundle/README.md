# TEST-only SQL Editor installation

This bundle is generated from the dependency-corrected 47-file order in
`scripts/e2e-test-db-installer.mjs`. Unlike the historical Runbook order,
`public_catalog.sql` precedes the free-craftsmen view hotfix. Stage 01 also
creates the exact `platform_settings` table definition from
`admin_launch_actions.sql` before subscription/payment SQL uses it. The full
Admin SQL still runs later, and the table creation there is idempotent.
It uses the E2E-safe Admin script, never the production Admin owner script. It
does not need a database URI, PostgreSQL CLI, Docker, or a service-role key.

## Before any write

1. Open **only** `https://supabase.com/dashboard/project/ivguranttkxhxsdsppqk/sql/new`.
   Confirm the Dashboard project reference is `ivguranttkxhxsdsppqk`. Never use
   project `ucyglqpzpszeyejifobh`.
2. Paste and run `00-preflight.sql` as a read-only check. Continue only when it
   returns `READY`, `auth_user_count = 0`, `public_table_count = 0`, and all
   three displayed table references are NULL. If not, STOP; do not rerun or
   clean up the database blindly. The failed earlier installer may have left
   a partially installed schema.
3. Do not interpret `current_database() = postgres` as project identity. SQL
   alone cannot reliably authenticate the hosted Supabase project reference.
   The Dashboard project URL/reference check is mandatory. The fresh-state
   guard is additional protection, not proof of project identity.

## Installation

### Existing TEST installation: complete (Stage 9/9)

Stages 01-09 have completed in the exact TEST project above. **Do not run
preflight, replay any stage, repeat the marker repair, or use the fresh-database
installer on this database.** The following is retained only as the historical
Stage 5 reference-repair procedure; it must not be executed again:

1. Run the read-only `00-stage-05-marker-verification.sql`. Stop unless its
   result is `READY FOR MARKER REPAIR`, with `completed_stage = 5`.
2. Run the entire `00-stage-05-marker-ref-repair.sql` as one transaction. It
   changes only the marker's reference and its CHECK constraint; it does not
   change the completed stage or application schema/data. Stop on any error.
3. Run `00-stage-05-marker-post-repair-verification.sql` and require
   `READY FOR STAGE 06`. This confirms the marker, Stage 5, and the new CHECK.
   Only then run Stage 06, followed by 07, 08, and 09 in order. Verify the
   marker after each stage.

The old reference remains inside the one-time repair and its prerequisite query
because they recognized the historical marker stored by Stage 01.

### Fresh TEST database only

Paste and run the entire contents of `01-stage-01-12.sql`, then `02`, and so on
through `09-stage-47-47.sql`, **one stage per SQL Editor execution**. Do not run
only a selected portion. Each stage preserves the source-file order and has a
transaction plus an ordered progress marker. Stage 07 preserves its source
file's own `BEGIN`/`COMMIT`. Stage 09 creates the fixture opt-in row only after
the rest of the schema succeeds.

After a stage completes, check its marker with this read-only query:

```sql
select project_ref, completed_stage from public.e2e_sql_editor_install;
```

Run this marker query only after stage 01 has created the table. The marker
must equal the number of the stage just completed. Do not proceed if it does
not. After stage 09, also confirm the `e2e_test_environment` row has the test
project reference and `enabled = true`.

The Supabase Dashboard SQL Editor has a one-minute execution timeout. The
bundle uses nine small submissions (largest approximately 59 KB), but its
actual runtime and any editor request-size limit have **not** been verified
against the remote test project. If a submission errors or times out, STOP and
inspect the progress marker and schema; do not blindly resubmit or skip ahead.
The marker reflects committed stages, but a lost browser response can make the
immediate outcome uncertain until a fresh read succeeds.

## Local regeneration and validation

From the repository root, without connecting to Supabase:

```text
node scripts/e2e-sql-editor-bundle.mjs --dry-run
node scripts/e2e-sql-editor-bundle.mjs --write
node --test-isolation=none scripts/e2e-sql-editor-bundle.test.mjs
```

Regenerate only before installation, not midway through a manual run.
