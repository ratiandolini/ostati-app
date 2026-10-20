# Isolated Supabase E2E Project

This directory is for a separate Supabase project only. Do not apply these files
to production and do not point E2E variables at `shenage.ge` or the production
project.

## One-time setup

1. Create an empty Supabase project dedicated to Shenage automated tests.
2. Apply the fresh-install sequence in `supabase/RUNBOOK.md`, steps 1-31.
3. Apply `supabase/e2e/e2e_admin_owner_access.sql`. Do not run the production
   `admin_owner_access.sql`: it contains a production allow-list identity.
4. Apply the active post-runbook changes in this order:
   - `marketplace_job_post_description_hotfix.sql`
   - `marketplace_job_post_title_hotfix.sql`
   - `marketplace_interest_rls_hotfix.sql`
   - `marketplace_selection_rls_hotfix.sql`
   - `marketplace_booking_hotfix.sql`
   - `marketplace_job_post_archive_hotfix.sql`
   - `cancellation_penalty_and_client_restriction_hotfix.sql`
   - `remove_client_request_restriction_hotfix.sql`
   - `booking_list.sql` (the current final version)
   - `dispute_privacy_and_attribution_hotfix.sql`
   - `admin_worker_contact_phone_hotfix.sql`
   - `worker_support_messages_hotfix.sql`
   - `rename_brand_to_shenage_hotfix.sql`
   - `rpc_execute_permissions_hotfix.sql` (last, because it hardens final RPC grants)
5. Apply `supabase/e2e/e2e_test_bootstrap.sql`.
6. Insert the actual test project reference using the commented statement at the
   bottom of that file. This is the opt-in guard that allows fixture automation.
7. The fixture script pre-confirms its three disposable accounts through the test
   project service role; do not relax email confirmation in either project.
8. Deploy an isolated frontend build with the test project URL and anon key.
   The API E2E runner reads its JavaScript bundles before fixture creation and
   fails unless they reference this exact isolated Supabase project.

The legacy `hotfix_profile_admin_storage.sql` is deliberately excluded: the
fresh-install sequence already applies its current capabilities. Historical repair
scripts are not a migration ledger and must not be replayed blindly.

## CI-only variables

Store these only in CI/local secret storage, never in `.env` committed to Git:

```text
E2E_BASE_URL=https://isolated-e2e-app.example
E2E_TEST_PROJECT_REF=your-test-project-ref
E2E_TEST_SUPABASE_URL=https://your-test-project-ref.supabase.co
E2E_TEST_SUPABASE_ANON_KEY=...
E2E_TEST_SERVICE_ROLE_KEY=...
E2E_CLIENT_EMAIL=...
E2E_CLIENT_PASSWORD=...
E2E_CRAFTSMAN_EMAIL=...
E2E_CRAFTSMAN_PASSWORD=...
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
E2E_ALLOW_TEST_FIXTURES=isolated-project-only
```

`E2E_TEST_SERVICE_ROLE_KEY` is used only by `scripts/e2e-api-fixtures.mjs`, which
runs in Node. It is never passed to Playwright pages or bundled into the app.

## Fixture lifecycle

`npm run test:e2e:api` invokes the fixture script before and after the API suite.
It creates or updates exactly three disposable accounts, marks the craftsman as
verified/active, and grants the disposable Admin owner permissions. It validates
the configured project reference through `e2e_assert_isolated_test_environment`
before any write. The runner rejects the known production project reference.

The fixture script removes only records tied to these fixture identities before
each suite and after it finishes. It does not delete the disposable Auth users,
which makes reruns deterministic without touching non-fixture data.
