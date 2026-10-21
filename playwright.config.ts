import { defineConfig, devices } from "@playwright/test";
import { isVercelPreview } from "./scripts/e2e-vercel-protection.mjs";

const e2eMode = process.env.E2E_MODE === "api" ? "api" : "demo";
const requestedBaseUrl = process.env.E2E_BASE_URL;
const configuredUrl = requestedBaseUrl || "http://127.0.0.1:4173";
const configuredHost = new URL(configuredUrl).hostname.toLowerCase();

// The browser suite must never run against the public marketplace by accident.
if (configuredHost === "shenage.ge" || configuredHost.endsWith(".shenage.ge")) {
  throw new Error("E2E_BASE_URL must point to an isolated test deployment, never shenage.ge.");
}

if (e2eMode === "api" && !requestedBaseUrl) {
  throw new Error("API E2E requires E2E_BASE_URL for an isolated test deployment.");
}

const protectedPreview = e2eMode === "api" && isVercelPreview(configuredUrl);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: e2eMode === "demo",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: configuredUrl,
    // A protected Preview request carries a local-only bypass header. Never capture it in a trace.
    trace: protectedPreview ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  testIgnore: e2eMode === "api" ? [] : ["**/api/**"],
  testMatch: e2eMode === "api" ? "**/api/**/*.spec.ts" : undefined,
  globalSetup: e2eMode === "api" ? "./e2e/api/global-setup.ts" : undefined,
  globalTeardown: e2eMode === "api" ? "./e2e/api/global-teardown.ts" : undefined,
  webServer: requestedBaseUrl
    ? undefined
    : {
        command: "node scripts/e2e-static-server.mjs",
        url: configuredUrl,
        reuseExistingServer: !process.env.CI,
      },
  projects: e2eMode === "api" ? [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ] : [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
