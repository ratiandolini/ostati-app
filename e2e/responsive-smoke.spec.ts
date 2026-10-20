import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, loginDemo } from "./helpers";

const mobileViewports = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
];

for (const viewport of mobileViewports) {
  test(`client shell remains usable at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loginDemo(page, "client");

    await expect(page.getByText("კატეგორიები")).toBeVisible();
    await expect(page.getByRole("button", { name: "ძიება" }).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "ჯავშნები" })).toBeVisible();
    await expect(page.getByRole("button", { name: "მესიჯები" })).toBeVisible();
    await expect(page.getByRole("button", { name: "პროფილი" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "ძიება" }).last().click();
    await expect(page).toHaveURL(/\/search$/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "პროფილი" }).last().click();
    await expect(page).toHaveURL(/\/profile$/);
    await expectNoHorizontalOverflow(page);
  });
}

test("tablet and desktop login surfaces do not overflow", async ({ page }) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(page.getByText("შენაგე")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
