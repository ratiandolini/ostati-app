import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const { installVercelPreviewBypass } = await import("../../scripts/e2e-vercel-protection.mjs");
    await installVercelPreviewBypass(page, process.env.E2E_BASE_URL!);
    await use(page);
  },
});

export { expect };
