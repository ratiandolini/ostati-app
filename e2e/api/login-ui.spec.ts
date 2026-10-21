import { expect, test } from "./test";
import { apiE2EConfigurationError } from "./environment";

const configurationError = apiE2EConfigurationError();
test.skip(Boolean(configurationError), configurationError || "");

test("disposable Client can authenticate through the isolated API deployment", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ელფოსტით" }).click();
  await page.locator('input[type="email"]').fill(process.env.E2E_CLIENT_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.E2E_CLIENT_PASSWORD!);
  await page.getByRole("button", { name: "შესვლა / რეგისტრაცია" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("კატეგორიები")).toBeVisible();
});
