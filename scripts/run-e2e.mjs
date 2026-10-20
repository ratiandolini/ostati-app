import { spawnSync } from "node:child_process";

const target = process.argv[2] || "chromium";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const run = (command, args, env = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

if (target === "api") {
  run(npxCommand, ["playwright", "test"], { E2E_MODE: "api" });
} else {
  run(npmCommand, ["run", "build"], {
    REACT_APP_DATA_MODE: "demo",
    REACT_APP_AUTH_MODE: "",
  });
  const args = ["playwright", "test"];
  if (target !== "all") args.push(`--project=${target}`);
  run(npxCommand, args, { E2E_MODE: "demo" });
}
