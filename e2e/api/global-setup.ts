import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertApiE2EEnvironment } from "./environment";

const activeRunPath = join(process.cwd(), ".e2e", "api-suite-active");

export default async function globalSetup() {
  assertApiE2EEnvironment();
  const [{ assertIsolatedFrontendTarget }, { getVercelBypassHeaders }] = await Promise.all([
    import("../../scripts/e2e-frontend-target.mjs"),
    import("../../scripts/e2e-vercel-protection.mjs"),
  ]);
  await assertIsolatedFrontendTarget({
    appUrl: process.env.E2E_BASE_URL!,
    testSupabaseUrl: process.env.E2E_TEST_SUPABASE_URL!,
    requestHeaders: getVercelBypassHeaders(process.env.E2E_BASE_URL!),
  });
  execFileSync(process.execPath, ["scripts/e2e-api-fixtures.mjs", "setup"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  mkdirSync(join(process.cwd(), ".e2e"), { recursive: true });
  writeFileSync(activeRunPath, "active");
}
