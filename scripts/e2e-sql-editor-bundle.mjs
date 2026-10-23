import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freshTestDatabaseSqlPlan, platformSettingsBootstrapSql, TEST_PROJECT_REF, validateSqlPlan } from "./e2e-test-db-installer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "supabase", "e2e", "sql-editor-bundle");
const stages = [
  [1, 12],
  [13, 20],
  [21, 25],
  [26, 26],
  [27, 38],
  [39, 39],
  [40, 40],
  [41, 46],
  [47, 47],
];

const freshCheck = [
  "to_regclass('public.users') is null",
  "to_regclass('public.e2e_test_environment') is null",
  "to_regclass('public.e2e_sql_editor_install') is null",
  "not exists (select 1 from auth.users)",
  "not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p'))",
].join(" and ");

const header = (number, from, to) => [
  `-- TEST PROJECT ONLY: ${TEST_PROJECT_REF}. Stage ${number}/${stages.length}; source files ${from}-${to} of 47.`,
  "-- Verify the Supabase Dashboard project URL/reference before running this entire file.",
  "-- The database cannot independently authenticate its Supabase project reference.",
  number === 1
    ? "-- Stage 01 requires an empty project with no application or Auth users."
    : `-- Stage ${number} requires the completed Stage ${number - 1} marker; never skip or replay stages.`,
  "",
].join("\n");

const initialGuard = `do $e2e_guard$
begin
  if not (${freshCheck}) then
    raise exception 'E2E SQL Editor install requires a fresh test database';
  end if;
end;
$e2e_guard$;`;

const stageGuard = (previous) => `do $e2e_guard$
begin
  if not exists (
    select 1 from public.e2e_sql_editor_install
    where singleton = true
      and project_ref = '${TEST_PROJECT_REF}'
      and completed_stage = ${previous}
  ) then
    raise exception 'E2E SQL Editor install: expected completed stage ${previous}; stop and inspect state';
  end if;
end;
$e2e_guard$;`;

const markerCreate = `create table public.e2e_sql_editor_install (
  singleton boolean primary key default true check (singleton),
  project_ref text not null check (project_ref = '${TEST_PROJECT_REF}'),
  completed_stage smallint not null check (completed_stage between 1 and ${stages.length}),
  updated_at timestamptz not null default now()
);
alter table public.e2e_sql_editor_install enable row level security;
revoke all on table public.e2e_sql_editor_install from public, anon, authenticated;
insert into public.e2e_sql_editor_install (singleton, project_ref, completed_stage)
values (true, '${TEST_PROJECT_REF}', 1);`;

const markerAdvance = (number) => `update public.e2e_sql_editor_install
set completed_stage = ${number}, updated_at = now()
where singleton = true
  and project_ref = '${TEST_PROJECT_REF}'
  and completed_stage = ${number - 1};`;

const optIn = `insert into public.e2e_test_environment (singleton, project_ref, enabled)
values (true, '${TEST_PROJECT_REF}', true)
on conflict (singleton) do update
set project_ref = excluded.project_ref, enabled = true;`;

export const buildSqlEditorBundle = (sourceRoot = root) => {
  if (freshTestDatabaseSqlPlan.length !== 47) throw new Error("Expected exactly 47 SQL files");
  validateSqlPlan(sourceRoot);
  if (freshTestDatabaseSqlPlan[39] !== "supabase/remove_client_request_restriction_hotfix.sql") {
    throw new Error("The self-managed transaction file must remain at position 40");
  }
  const covered = stages.flatMap(([from, to]) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index)
  );
  if (covered.join(",") !== Array.from({ length: 47 }, (_, index) => index + 1).join(",")) {
    throw new Error("SQL Editor stages must cover the 47-file plan exactly once and in order");
  }

  const preflight = `-- READ ONLY. Open ONLY https://supabase.com/dashboard/project/${TEST_PROJECT_REF}/sql/new\n` +
    "-- The project reference is verified in the Dashboard, not by current_database().\n" +
    `select case when ${freshCheck} then 'READY' else 'STOP: NOT FRESH' end as installation_state,\n` +
    "  to_regclass('public.users') as app_users_table,\n" +
    "  to_regclass('public.e2e_sql_editor_install') as stage_marker,\n" +
    "  to_regclass('public.e2e_test_environment') as fixture_opt_in,\n" +
    "  (select count(*) from auth.users) as auth_user_count,\n" +
    "  (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')) as public_table_count;\n";

  const files = [{ name: "00-preflight.sql", sql: preflight, from: 0, to: 0 }];
  stages.forEach(([from, to], index) => {
    const number = index + 1;
    const sources = freshTestDatabaseSqlPlan.slice(from - 1, to).map((path, offset) => {
      const contents = readFileSync(join(sourceRoot, path), "utf8").trimEnd();
      const bootstrap = path === "supabase/payment_workflow.sql"
        ? `-- TEST-ONLY PREREQUISITE: platform_settings is created in the later Admin SQL.\n${platformSettingsBootstrapSql(sourceRoot)}\n\n`
        : "";
      return `${bootstrap}-- BEGIN SOURCE ${from + offset}: ${path}\n${contents}\n-- END SOURCE ${from + offset}: ${path}`;
    });
    let sql;
    if (number === 7) {
      const source = sources[0];
      if (!/^-- BEGIN SOURCE 40:[^\n]*\n(?:(?:--[^\n]*|\s*)\n)*begin;/i.test(source) ||
          !/\ncommit;\n-- END SOURCE 40:/i.test(source)) {
        throw new Error("Stage 7 source transaction boundaries have changed; review manually");
      }
      // The marker is committed atomically with the source's own transaction.
      sql = header(number, from, to) + stageGuard(number - 1) + "\n\n" +
        source.replace(/\ncommit;(?=\n-- END SOURCE 40:)/i, `\n${markerAdvance(number)}\ncommit;`) + "\n";
    } else {
      sql = header(number, from, to) + "begin;\n" +
        (number === 1 ? initialGuard : stageGuard(number - 1)) + "\n\n" +
        sources.join("\n\n") + "\n\n" +
        (number === 1 ? markerCreate : markerAdvance(number)) + "\n" +
        (number === stages.length ? optIn + "\n" : "") + "commit;\n";
    }
    const name = `${String(number).padStart(2, "0")}-stage-${String(from).padStart(2, "0")}-${String(to).padStart(2, "0")}.sql`;
    files.push({ name, sql, from, to });
  });
  return files;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const mode = process.argv[2];
  if (mode !== "--dry-run" && mode !== "--write") {
    throw new Error("Usage: node scripts/e2e-sql-editor-bundle.mjs --dry-run|--write");
  }
  const files = buildSqlEditorBundle();
  if (mode === "--write") mkdirSync(outputDirectory, { recursive: true });
  for (const file of files) {
    if (mode === "--write") writeFileSync(join(outputDirectory, file.name), file.sql, "utf8");
    console.log(`${file.name}: ${Buffer.byteLength(file.sql)} bytes${file.from ? `; source ${file.from}-${file.to}` : "; read-only"}`);
  }
  console.log("Local bundle validation PASS; no database connection was made.");
}
