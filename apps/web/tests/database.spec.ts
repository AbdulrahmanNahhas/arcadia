import { expect, test } from "@playwright/test";

test("live catalog loads, searches and paginates without writing", async ({ page }) => {
  await page.goto("/database/works");
  await expect(page.getByText("سجلات قاعدة البيانات الحالية · 223 سجل")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(31);
  const title = await page.getByRole("row").nth(1).getByRole("cell").nth(1).innerText();
  const first = await page.getByRole("row").nth(1).innerText();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page.getByText("31–60 / 223")).toBeVisible();
  expect(await page.getByRole("row").nth(1).innerText()).not.toBe(first);
  await page.getByPlaceholder("البحث في السجلات").fill(title);
  await page.getByRole("button", { name: "بحث", exact: true }).click();
  await expect(page.getByRole("table")).toContainText(title);
  await page.screenshot({ path: "../../data/previews/database-records.png", fullPage: true });
  await page.getByRole("button", { name: "تحرير", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText(title);
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
});

test("registered artwork is served and identity secrets are masked", async ({ page }) => {
  await page.goto("/database/images");
  await expect(page.getByText("828 صورة مسجلة")).toBeVisible();
  const image = page.locator("main img, #main-content img").first();
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (element) =>
          element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await page.goto("/database/tables");
  await page.getByRole("combobox", { name: "الجدول", exact: true }).click();
  await page.getByRole("option", { name: "auth_sessions", exact: true }).click();
  await page.getByRole("tab", { name: "السجلات", exact: true }).click();
  await expect(page.getByRole("button", { name: "إضافة سجل", exact: true })).toBeDisabled();
  await expect(page.getByRole("table")).not.toContainText("token");
});
