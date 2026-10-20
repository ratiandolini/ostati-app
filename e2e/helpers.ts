import { expect, Page } from "@playwright/test";

export type DemoRole = "client" | "craftsman" | "admin";

const demoPhoneByRole: Record<DemoRole, string> = {
  client: "555123456",
  craftsman: "555654321",
  admin: "555000111",
};

export const loginDemo = async (page: Page, role: DemoRole) => {
  await page.goto(role === "admin" ? "/admin" : "/login");

  if (role !== "admin") {
    const roleName = role === "client" ? "შესვლა როგორც კლიენტი" : "შესვლა როგორც ხელოსანი";
    await page.getByRole("button", { name: roleName }).click();
  }

  await page.locator('input[type="tel"], input[type="email"]').first().fill(demoPhoneByRole[role]);
  if (role === "admin") {
    await page.locator(".auth-submit").click();
  } else {
    await page.getByRole("button", { name: "კოდის გაგზავნა" }).click();
  }
  await page.locator('input[placeholder="0000"]').fill("1234");
  await page.getByRole("button", { name: "დადასტურება" }).click();

  if (role === "admin") {
    await expect(page).toHaveURL(/\/admin$/);
  } else {
    await expect(page).toHaveURL(/\/$/);
  }
};

export const expectNoHorizontalOverflow = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
};
