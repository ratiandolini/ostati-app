import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

export const TEST_PROJECT_REF = "ivguranttkxhxsdsppqk";
export const PRODUCTION_PROJECT_REF = "ucyglqpzpszeyejifobh";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const selfManagedTransactionFiles = new Set(["supabase/remove_client_request_restriction_hotfix.sql"]);

// Fresh-install order with the test-only dependency correction for worker_cards.
export const freshTestDatabaseSqlPlan = [
  "supabase/schema.sql",
  "supabase/auth.sql",
  "supabase/seed.sql",
  "supabase/profession_questions.sql",
  "supabase/booking_workflow.sql",
  "supabase/review_workflow.sql",
  "supabase/payment_workflow.sql",
  "supabase/dispute_workflow.sql",
  "supabase/subscription_workflow.sql",
  "supabase/subscription_pricing.sql",
  "supabase/public_catalog.sql",
  "supabase/free_craftsmen_security_hotfix.sql",
  "supabase/policies.sql",
  "supabase/booking_actions.sql",
  "supabase/booking_reason_actions.sql",
  "supabase/profile_actions.sql",
  "supabase/review_actions.sql",
  "supabase/public_review_feed.sql",
  "supabase/message_actions.sql",
  "supabase/notification_actions.sql",
  "supabase/payment_actions.sql",
  "supabase/dispute_actions.sql",
  "supabase/dispute_integrity.sql",
  "supabase/booking_worker_change.sql",
  "supabase/booking_list.sql",
  "supabase/admin_launch_actions.sql",
  "supabase/storage.sql",
  "supabase/marketplace_growth.sql",
  "supabase/marketplace_job_post_hotfix.sql",
  "supabase/message_time_hotfix.sql",
  "supabase/storage_profile_hotfix.sql",
  "supabase/e2e/e2e_admin_owner_access.sql",
  "supabase/marketplace_job_post_description_hotfix.sql",
  "supabase/marketplace_job_post_title_hotfix.sql",
  "supabase/marketplace_interest_rls_hotfix.sql",
  "supabase/marketplace_selection_rls_hotfix.sql",
  "supabase/marketplace_booking_hotfix.sql",
  "supabase/marketplace_job_post_archive_hotfix.sql",
  "supabase/cancellation_penalty_and_client_restriction_hotfix.sql",
  "supabase/remove_client_request_restriction_hotfix.sql",
  "supabase/booking_list.sql",
  "supabase/dispute_privacy_and_attribution_hotfix.sql",
  "supabase/admin_worker_contact_phone_hotfix.sql",
  "supabase/worker_support_messages_hotfix.sql",
  "supabase/rename_brand_to_shenage_hotfix.sql",
  "supabase/rpc_execute_permissions_hotfix.sql",
  "supabase/e2e/e2e_test_bootstrap.sql",
];

const fail = (message) => {
  throw new Error(`E2E test database installer safety check failed: ${message}`);
};

const isSafetyError = (error) => error?.message?.startsWith("E2E test database installer safety check failed:");

export const describeDatabaseError = (error, phase) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return `database DNS resolution failed during ${phase}; verify the test-project host and try the Session Pooler if Direct Connection is unavailable`;
  }
  if (["ENETUNREACH", "EHOSTUNREACH", "ETIMEDOUT", "ECONNREFUSED"].includes(code)) {
    return `database network connection failed during ${phase}; Supabase Direct Connection may require IPv6, so use the test project's Session Pooler if this network has no IPv6 route`;
  }
  if (["28P01", "28000"].includes(code)) {
    return `database authentication failed during ${phase}; verify the local test-project password without changing the target`;
  }
  if (code === "3D000") {
    return `database name validation failed during ${phase}; use the database name from the test project's connection URI`;
  }
  if (code.startsWith("08") || /certificate|tls|ssl/.test(message)) {
    return `database TLS connection failed during ${phase}; use the official SSL-enabled URI for the dedicated test project`;
  }
  if (code) return `database ${phase} failed with PostgreSQL code ${code}; installation stopped before later SQL files`;
  return `database ${phase} failed; installation stopped before later SQL files`;
};

const normalizedOrigin = (value) => new URL(value).origin;

export const validateInstallerEnvironment = (environment, { requireDatabaseUrl = false } = {}) => {
  const projectRef = environment.E2E_TEST_PROJECT_REF;
  if (projectRef === PRODUCTION_PROJECT_REF) fail("the production project is forbidden");
  if (projectRef !== TEST_PROJECT_REF) fail(`expected the dedicated test project ${TEST_PROJECT_REF}`);

  const expectedSupabaseOrigin = `https://${TEST_PROJECT_REF}.supabase.co`;
  if (!environment.E2E_TEST_SUPABASE_URL || normalizedOrigin(environment.E2E_TEST_SUPABASE_URL) !== expectedSupabaseOrigin) {
    fail(`E2E_TEST_SUPABASE_URL must be ${expectedSupabaseOrigin}`);
  }

  if (!requireDatabaseUrl) return { projectRef, expectedSupabaseOrigin };
  if (!environment.E2E_TEST_DATABASE_URL) fail("missing E2E_TEST_DATABASE_URL");

  const databaseUrl = new URL(environment.E2E_TEST_DATABASE_URL);
  if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
    fail("E2E_TEST_DATABASE_URL must use a PostgreSQL connection URL");
  }

  const username = decodeURIComponent(databaseUrl.username);
  const directHost = `db.${TEST_PROJECT_REF}.supabase.co`;
  const poolerHost = databaseUrl.hostname.endsWith(".pooler.supabase.com");
  const directTarget = databaseUrl.hostname === directHost && username === "postgres";
  const poolerTarget = poolerHost && username === `postgres.${TEST_PROJECT_REF}`;
  if (!directTarget && !poolerTarget) {
    fail("database URL does not identify the dedicated test project");
  }

  return { projectRef, expectedSupabaseOrigin, databaseUrl };
};

export const validateSqlPlan = (rootDirectory = repositoryRoot) => {
  if (freshTestDatabaseSqlPlan.includes("supabase/admin_owner_access.sql")) {
    fail("the production admin owner access script is not allowed");
  }
  if (!freshTestDatabaseSqlPlan.includes("supabase/e2e/e2e_admin_owner_access.sql")) {
    fail("the E2E-safe Admin owner script is required");
  }
  if (freshTestDatabaseSqlPlan.at(-1) !== "supabase/e2e/e2e_test_bootstrap.sql") {
    fail("the E2E bootstrap must be last");
  }
  if (freshTestDatabaseSqlPlan.indexOf("supabase/rpc_execute_permissions_hotfix.sql") > freshTestDatabaseSqlPlan.indexOf("supabase/e2e/e2e_test_bootstrap.sql")) {
    fail("RPC permission hardening must precede the E2E bootstrap");
  }
  if (freshTestDatabaseSqlPlan.indexOf("supabase/public_catalog.sql") > freshTestDatabaseSqlPlan.indexOf("supabase/free_craftsmen_security_hotfix.sql")) {
    fail("worker_cards must exist before the free-craftsmen view hotfix");
  }

  for (const file of freshTestDatabaseSqlPlan) {
    const absolutePath = join(rootDirectory, file);
    if (!existsSync(absolutePath)) fail(`missing SQL file ${file}`);
    if (!readFileSync(absolutePath, "utf8").trim()) fail(`empty SQL file ${file}`);
  }
  return freshTestDatabaseSqlPlan.map((file) => join(rootDirectory, file));
};

export const platformSettingsBootstrapSql = (rootDirectory = repositoryRoot) => {
  const source = readFileSync(join(rootDirectory, "supabase/admin_launch_actions.sql"), "utf8");
  const tableDefinition = source.match(/^create table if not exists public\.platform_settings \([\s\S]*?^\);/m)?.[0];
  if (!tableDefinition) fail("platform_settings table definition changed; review the test-only bootstrap");
  return `${tableDefinition}\nalter table public.platform_settings enable row level security;`;
};

const freshDatabaseQuery = [
  "select case",
  "when to_regclass('public.users') is null and to_regclass('public.e2e_test_environment') is null",
  "then 'fresh' else 'not_fresh' end as state;",
].join(" ");

const createPgClient = async (databaseUrl) => {
  const { Client } = await import("pg");
  return new Client({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: true },
    application_name: "shenage-e2e-test-db-installer",
  });
};

const relativeSqlPath = (filePath) => relative(repositoryRoot, filePath).replaceAll("\\", "/");

const applySqlFile = async (client, filePath) => {
  const relativePath = relativeSqlPath(filePath);
  const sql = readFileSync(filePath, "utf8");
  const selfManagedTransaction = selfManagedTransactionFiles.has(relativePath);

  console.log(`Applying ${relativePath}`);
  if (selfManagedTransaction) {
    try {
      await client.query(sql);
      return;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      fail(`SQL migration failed in ${relativePath}; ${describeDatabaseError(error, "migration")}`);
    }
  }

  try {
    await client.query("begin");
    if (relativePath === "supabase/payment_workflow.sql") {
      await client.query(platformSettingsBootstrapSql());
    }
    await client.query(sql);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    fail(`SQL migration failed in ${relativePath}; ${describeDatabaseError(error, "migration")}`);
  }
};

export const installFreshTestDatabase = async ({ databaseUrl, absolutePaths, createClient = createPgClient }) => {
  let client;
  try {
    client = await createClient(databaseUrl);
  } catch (error) {
    fail(describeDatabaseError(error, "Node pg client setup"));
  }

  try {
    try {
      await client.connect();
    } catch (error) {
      fail(describeDatabaseError(error, "connection"));
    }

    let freshCheck;
    try {
      freshCheck = await client.query(freshDatabaseQuery);
    } catch (error) {
      fail(describeDatabaseError(error, "fresh-database validation"));
    }
    if (freshCheck.rows[0]?.state !== "fresh") {
      fail("the target database is not fresh; refusing to apply a fresh-install plan");
    }

    for (const filePath of absolutePaths) await applySqlFile(client, filePath);

    try {
      await client.query({
        text: "insert into public.e2e_test_environment (singleton, project_ref, enabled) values (true, $1, true) on conflict (singleton) do update set project_ref = excluded.project_ref, enabled = true;",
        values: [TEST_PROJECT_REF],
      });
    } catch (error) {
      fail(describeDatabaseError(error, "E2E bootstrap opt-in"));
    }
  } catch (error) {
    if (isSafetyError(error)) throw error;
    fail(describeDatabaseError(error, "installation"));
  } finally {
    if (client) await client.end().catch(() => undefined);
  }
};

const confirmationArguments = (argumentsList) => {
  const values = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === "--confirm-project") values.push(argumentsList[index + 1]);
  }
  return values;
};

const mode = process.argv[2];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!new Set(["--dry-run", "--apply"]).has(mode)) {
    fail("usage: node scripts/e2e-test-db-installer.mjs --dry-run|--apply [--confirm-project <project-ref>]");
  }

  const isApply = mode === "--apply";
  const configuration = validateInstallerEnvironment(process.env, { requireDatabaseUrl: isApply });
  const plan = validateSqlPlan();

  if (!isApply) {
    console.log(`Dry run PASS: ${plan.length} SQL files target only ${configuration.projectRef}.`);
  } else {
    const confirmedProjects = confirmationArguments(process.argv.slice(2));
    if (!confirmedProjects.length || confirmedProjects.some((projectRef) => projectRef !== TEST_PROJECT_REF)) {
      fail(`--apply requires --confirm-project ${TEST_PROJECT_REF}`);
    }
    await installFreshTestDatabase({ databaseUrl: configuration.databaseUrl, absolutePaths: plan });
    console.log(`Install PASS: isolated E2E database prepared for ${configuration.projectRef}.`);
  }
}
