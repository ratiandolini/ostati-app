import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_PROJECT_REF,
  TEST_PROJECT_REF,
  describeDatabaseError,
  freshTestDatabaseSqlPlan,
  installFreshTestDatabase,
  platformSettingsBootstrapSql,
  validateInstallerEnvironment,
  validateSqlPlan,
} from "./e2e-test-db-installer.mjs";
import { resolve } from "node:path";

const safeEnvironment = {
  E2E_TEST_PROJECT_REF: TEST_PROJECT_REF,
  E2E_TEST_SUPABASE_URL: `https://${TEST_PROJECT_REF}.supabase.co`,
};

test("accepts only the dedicated test project for a dry run", () => {
  assert.deepEqual(validateInstallerEnvironment(safeEnvironment), {
    projectRef: TEST_PROJECT_REF,
    expectedSupabaseOrigin: `https://${TEST_PROJECT_REF}.supabase.co`,
  });
});

test("rejects the production project before any installer activity", () => {
  assert.throws(
    () => validateInstallerEnvironment({ ...safeEnvironment, E2E_TEST_PROJECT_REF: PRODUCTION_PROJECT_REF }),
    /production project is forbidden/
  );
});

test("rejects the superseded TEST project reference before any installer activity", () => {
  assert.throws(
    () => validateInstallerEnvironment({ ...safeEnvironment, E2E_TEST_PROJECT_REF: "ivquranttkxhxsdspqk" }),
    /expected the dedicated test project/
  );
});

test("requires a database URL that identifies the dedicated test project", () => {
  assert.doesNotThrow(() =>
    validateInstallerEnvironment(
      { ...safeEnvironment, E2E_TEST_DATABASE_URL: `postgresql://postgres:test-password@db.${TEST_PROJECT_REF}.supabase.co:5432/postgres` },
      { requireDatabaseUrl: true }
    )
  );
  assert.throws(
    () =>
      validateInstallerEnvironment(
        { ...safeEnvironment, E2E_TEST_DATABASE_URL: `postgresql://postgres:test-password@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres` },
        { requireDatabaseUrl: true }
      ),
    /does not identify the dedicated test project/
  );
});

test("keeps the E2E-safe Admin script and bootstrap at the prescribed plan boundaries", () => {
  assert.ok(freshTestDatabaseSqlPlan.includes("supabase/e2e/e2e_admin_owner_access.sql"));
  assert.equal(freshTestDatabaseSqlPlan.includes("supabase/admin_owner_access.sql"), false);
  assert.equal(freshTestDatabaseSqlPlan.at(-1), "supabase/e2e/e2e_test_bootstrap.sql");
  assert.equal(validateSqlPlan().length, freshTestDatabaseSqlPlan.length);
  assert.ok(freshTestDatabaseSqlPlan.indexOf("supabase/public_catalog.sql") < freshTestDatabaseSqlPlan.indexOf("supabase/free_craftsmen_security_hotfix.sql"));
});

test("precreates the same platform settings table before payment SQL", async () => {
  const definition = platformSettingsBootstrapSql();
  assert.match(definition, /create table if not exists public\.platform_settings/);
  assert.match(definition, /enable row level security/);
  const calls = [];
  const client = {
    connect: async () => undefined,
    end: async () => undefined,
    query: async (query) => {
      const sql = typeof query === "string" ? query : query.text;
      calls.push(sql);
      return sql.includes("to_regclass") ? { rows: [{ state: "fresh" }] } : { rows: [] };
    },
  };
  await installFreshTestDatabase({
    databaseUrl: new URL(`postgresql://postgres:test@db.${TEST_PROJECT_REF}.supabase.co/postgres`),
    absolutePaths: [resolve("supabase/schema.sql"), resolve("supabase/payment_workflow.sql")],
    createClient: async () => client,
  });
  const bootstrap = calls.findIndex((call) => call.includes("create table if not exists public.platform_settings"));
  const payment = calls.findIndex((call) => call.includes("create or replace function public.platform_fee_rate"));
  assert.ok(bootstrap >= 0 && bootstrap < payment);
});

test("classifies connection failures without including a database URI or password", () => {
  const password = "do-not-print-this";
  const description = describeDatabaseError(
    { code: "ENETUNREACH", message: `connect postgresql://postgres:${password}@db.example.supabase.co/postgres` },
    "connection"
  );

  assert.match(description, /IPv6/);
  assert.doesNotMatch(description, new RegExp(password));
  assert.match(describeDatabaseError({ code: "28P01" }, "connection"), /authentication/);
  assert.match(describeDatabaseError({ message: "certificate verify failed" }, "connection"), /TLS/);
  assert.match(describeDatabaseError({ code: "42P01" }, "migration"), /PostgreSQL code 42P01/);
});

test("executes each ordinary SQL file in its own transaction and stops at the first failure", async () => {
  const calls = [];
  const client = {
    connect: async () => calls.push("connect"),
    end: async () => calls.push("end"),
    query: async (query) => {
      const sql = typeof query === "string" ? query : query.text;
      calls.push(sql);
      if (sql.includes("to_regclass")) return { rows: [{ state: "fresh" }] };
      if (sql.includes('create extension if not exists "pgcrypto"')) throw new Error("intentional test failure");
      return { rows: [] };
    },
  };
  const schema = resolve("supabase/schema.sql");
  const auth = resolve("supabase/auth.sql");

  await assert.rejects(
    () => installFreshTestDatabase({ databaseUrl: new URL(`postgresql://postgres:test@db.${TEST_PROJECT_REF}.supabase.co/postgres`), absolutePaths: [schema, auth], createClient: async () => client }),
    /SQL migration failed in supabase\/schema.sql/
  );

  assert.ok(calls.includes("begin"));
  assert.ok(calls.includes("rollback"));
  assert.equal(calls.some((call) => call.includes("handle_new_auth_user")), false);
  assert.equal(calls.at(-1), "end");
});
