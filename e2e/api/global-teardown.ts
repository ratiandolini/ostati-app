import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const activeRunPath = join(process.cwd(), ".e2e", "api-suite-active");

export default function globalTeardown() {
  if (!existsSync(activeRunPath)) return;
  try {
    execFileSync(process.execPath, ["scripts/e2e-api-fixtures.mjs", "cleanup"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
  } finally {
    rmSync(activeRunPath, { force: true });
  }
}
