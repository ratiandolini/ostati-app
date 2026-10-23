import assert from "node:assert/strict";
import test from "node:test";
import { buildSqlEditorBundle } from "./e2e-sql-editor-bundle.mjs";
import { PRODUCTION_PROJECT_REF, TEST_PROJECT_REF, freshTestDatabaseSqlPlan } from "./e2e-test-db-installer.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = buildSqlEditorBundle();

test("preflight is read-only and refuses an existing schema or Auth users", () => {
  const preflight = files[0].sql;
  assert.match(preflight, /to_regclass\('public\.users'\) is null/);
  assert.match(preflight, /not exists \(select 1 from auth\.users\)/);
  assert.match(preflight, /STOP: NOT FRESH/);
  assert.doesNotMatch(preflight, /\b(insert|update|delete|create|alter|drop)\s+(?:into|table|function|on|from|public\.)/i);
});

test("covers all 47 source files exactly once in documented order", () => {
  assert.equal(files.length, 10);
  const paths = files.slice(1).flatMap((file) =>
    [...file.sql.matchAll(/^-- BEGIN SOURCE \d+: (.+)$/gm)].map((match) => match[1])
  );
  assert.deepEqual(paths, freshTestDatabaseSqlPlan);
  assert.equal(paths.includes("supabase/admin_owner_access.sql"), false);
  assert.ok(paths.indexOf("supabase/public_catalog.sql") < paths.indexOf("supabase/free_craftsmen_security_hotfix.sql"));
  for (const [index, path] of paths.entries()) {
    if (index === 39) continue;
    const original = readFileSync(resolve(path), "utf8").trimEnd();
    assert.ok(files.some((file) => file.sql.includes(original)), `Missing unchanged source ${path}`);
  }
});

test("stage 01 creates platform settings and worker_cards before first use", () => {
  const sql = files[1].sql;
  const table = sql.indexOf("create table if not exists public.platform_settings (");
  const payment = sql.indexOf("-- BEGIN SOURCE 7: supabase/payment_workflow.sql");
  const pricingTrigger = sql.indexOf("on public.platform_settings\nfor each row execute function");
  const view = sql.indexOf("create or replace view public.worker_cards as");
  const viewHotfix = sql.indexOf("-- BEGIN SOURCE 12: supabase/free_craftsmen_security_hotfix.sql");
  assert.ok(table >= 0 && table < payment && payment < pricingTrigger);
  assert.ok(view >= 0 && view < viewHotfix);
  assert.match(sql.slice(table, payment), /alter table public\.platform_settings enable row level security;/);
});

test("every stage is test-only, ordered, and has a committed progress marker", () => {
  for (const [index, file] of files.slice(1).entries()) {
    const stage = index + 1;
    assert.match(file.sql, new RegExp(TEST_PROJECT_REF));
    assert.doesNotMatch(file.sql, new RegExp(PRODUCTION_PROJECT_REF));
    assert.match(file.sql, /completed_stage/);
    if (stage === 1) {
      assert.match(file.sql, /fresh test database/);
      assert.match(file.sql, /create table public\.e2e_sql_editor_install/);
    } else {
      assert.match(file.sql, new RegExp(`completed_stage = ${stage - 1}`));
      assert.match(file.sql, new RegExp(`set completed_stage = ${stage}`));
    }
    assert.match(file.sql, /commit;\s*(?:-- END SOURCE 40:[^\n]*\s*)?$/i);
  }
  assert.match(files.at(-1).sql, /insert into public\.e2e_test_environment/);
});

test("the self-managed stage 40 transaction contains its marker before COMMIT", () => {
  const stage = files[7].sql;
  const sourceStart = stage.indexOf("-- BEGIN SOURCE 40:");
  const begin = stage.indexOf("\nbegin;", sourceStart);
  const marker = stage.indexOf("set completed_stage = 7", begin);
  const commit = stage.lastIndexOf("\ncommit;");
  assert.ok(sourceStart < begin && begin < marker && marker < commit);
  assert.equal((stage.match(/^begin;$/gim) || []).length, 1);
  assert.equal((stage.match(/^commit;$/gim) || []).length, 1);
  const original = readFileSync(resolve(freshTestDatabaseSqlPlan[39]), "utf8").trimEnd();
  const withoutMarker = stage.slice(sourceStart).replace(/\nupdate public\.e2e_sql_editor_install\n[\s\S]*?(?=\ncommit;)/, "");
  assert.ok(withoutMarker.includes(original));
});

test("Stage 5 reference repair is read-only first, guarded, atomic, and preserves the stage", () => {
  const verification = readFileSync(resolve("supabase/e2e/sql-editor-bundle/00-stage-05-marker-verification.sql"), "utf8");
  const postRepair = readFileSync(resolve("supabase/e2e/sql-editor-bundle/00-stage-05-marker-post-repair-verification.sql"), "utf8");
  const repair = readFileSync(resolve("supabase/e2e/sql-editor-bundle/00-stage-05-marker-ref-repair.sql"), "utf8");
  assert.match(verification, /READY FOR MARKER REPAIR/);
  assert.doesNotMatch(verification, /^(?:insert|update|delete|create|alter|drop|begin|commit)\b/im);
  assert.match(postRepair, /READY FOR STAGE 06/);
  assert.doesNotMatch(postRepair, /^(?:insert|update|delete|create|alter|drop|begin|commit)\b/im);
  assert.match(repair, /^begin;/im);
  assert.match(repair, /completed_stage = 5/);
  assert.match(repair, /drop constraint e2e_sql_editor_install_project_ref_check/);
  assert.match(repair, new RegExp(`check \\(project_ref = '${TEST_PROJECT_REF}'\\)`));
  assert.doesNotMatch(repair, /set completed_stage\s*=/i);
  assert.doesNotMatch(repair, new RegExp(PRODUCTION_PROJECT_REF));
  assert.match(repair, /commit;\s*$/i);
});
