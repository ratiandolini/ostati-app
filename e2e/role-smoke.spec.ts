import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, loginDemo } from "./helpers";

test("client can access search, bookings, messages, profile, and logout in isolated demo mode", async ({ page }) => {
  await loginDemo(page, "client");

  await page.getByRole("button", { name: "ჯავშნები" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "მესიჯები" }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "პროფილი" }).last().click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole("button", { name: "გასვლა" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("craftsman verification gate and profile route are available in isolated demo mode", async ({ page }) => {
  await loginDemo(page, "craftsman");
  await expect(page.getByText("ვერიფიკაცია საჭიროა")).toBeVisible();
  await page.getByRole("button", { name: "პროფილი" }).first().click();
  await expect(page.getByText("პროფილის დასრულება")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("admin tabs render in isolated demo mode without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginDemo(page, "admin");

  await expect(page.getByRole("heading", { name: "ადმინი" })).toBeVisible();
  for (const tab of [
    "მთავარი",
    "ვერიფიკაცია",
    "ჯავშნები",
    "დავები",
    "ფინანსები",
    "ხელოსნები",
    "პარამეტრები",
    "ისტორია",
  ]) {
    const button = page.getByRole("button", { name: tab, exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await expectNoHorizontalOverflow(page);
  }
});

test("admin navigation keeps finance and audit restricted to permitted roles", async ({ page }) => {
  await loginDemo(page, "admin");

  await expect(page.getByRole("button", { name: "ფინანსები", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ისტორია", exact: true })).toBeVisible();

  await page.locator("select").first().selectOption("support");

  await expect(page.getByRole("button", { name: "ფინანსები", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ისტორია", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
