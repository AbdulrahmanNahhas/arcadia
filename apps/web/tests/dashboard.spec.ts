// Authenticated journeys require a session on a disposable test server.
import { expect, test } from "@playwright/test";

import { serverSections } from "../src/features/dashboard/shell/navigation";
import { collections } from "../src/features/database/records/collections";

test.skip(
  !process.env.NAHHASIO_E2E_STORAGE_STATE,
  "Provide disposable-server authenticated storage state; live credentials are never used by default tests.",
);

test("Database switches the entire sidebar workspace and opens the work draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "قاعدة البيانات", exact: true }).click();
  await expect(page.getByRole("heading", { name: "قاعدة البيانات", exact: true })).toBeVisible();
  await expect(
    page.getByLabel("التنقل الرئيسي").getByRole("link", { name: "الأعمال", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "النسخ والاستعادة", exact: true })).toHaveCount(0);
  await page
    .getByLabel("التنقل الرئيسي")
    .getByRole("link", { name: "الأعمال", exact: true })
    .click();
  await page.getByRole("link", { name: "مسودة عمل", exact: true }).click();
  await expect(page.getByRole("heading", { name: "عمل جديد", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "مراجعة العمل", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "العنوان الأصلي", exact: true }).fill("New work UI draft");
  await expect(page.getByRole("button", { name: "مراجعة العمل", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "التحرير" }).click();
  await expect(page.getByText("التحرير والتصنيف العائلي", { exact: true })).toBeVisible();
});

test("workspace selector switches back to server management", async ({ page }) => {
  await page.goto("/database");
  await page.getByRole("button", { name: "اختيار مساحة العمل" }).click();
  await page.getByRole("menuitem", { name: "إدارة الخادم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "لوحة المكتبة", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "الأجهزة", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "الأشخاص", exact: true })).toHaveCount(0);
});

test("schema explorer contains actual fields and changes the selected table", async ({ page }) => {
  await page.goto("/database/tables");
  await expect(page.getByRole("table")).toContainText("canonical_title");
  await page.getByRole("combobox", { name: "الجدول", exact: true }).click();
  await page.getByRole("option", { name: "episodes", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("installment_id");
  await expect(page.getByRole("button", { name: "تعديل السجلات" })).toBeEnabled();
});

test("selected works open a projected JSON workspace with invalid drafts blocked", async ({
  page,
}) => {
  await page.goto("/database/json");
  await expect(page.getByText("اختر الأعمال أولاً", { exact: true })).toBeVisible();
  await page.goto("/database/works");
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("checkbox").nth(2).check();
  await page
    .getByRole("region", { name: "إجراءات التحديد" })
    .getByRole("link", { name: "محرر JSON", exact: true })
    .click();
  await expect(page.getByText("2 عمل في نطاق التحرير.", { exact: true })).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("schemaVersion");
  await page.getByRole("combobox", { name: "قالب الحقول", exact: true }).click();
  await page.getByRole("option", { name: "التحرير", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("workflowStatus");
  await expect(page.locator(".cm-content")).not.toContainText("canonicalTitle");
  await page.locator(".cm-content").fill("{");
  await expect(page.getByText("JSON يحتاج تصحيحاً", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "مراجعة التغييرات", exact: true })).toBeDisabled();
  for (const width of [1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("sidebar navigation opens every database collection and server screen without runtime errors", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/database/works");
  for (const collection of collections.filter(
    (item) => !["installments", "episodes"].includes(item.slug),
  )) {
    await page
      .getByLabel("التنقل الرئيسي")
      .getByRole("link", { name: collection.title, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: collection.title, exact: true })).toBeVisible();
  }
  for (const title of ["مكتبة الصور", "التحقق والصيانة", "السجل وسلة المحذوفات"]) {
    await page.getByLabel("التنقل الرئيسي").getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "اختيار مساحة العمل" }).click();
  await page.getByRole("menuitem", { name: "إدارة الخادم", exact: true }).click();
  for (const section of serverSections) {
    await page
      .getByLabel("التنقل الرئيسي")
      .getByRole("link", { name: section.title, exact: true })
      .click();
    await expect(page.getByRole("heading", { name: section.title, exact: true })).toBeVisible();
  }
  await page
    .getByLabel("التنقل الرئيسي")
    .getByRole("link", { name: "تسجيل الدخول", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "تسجيل الدخول", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const collection of collections.filter((item) =>
  ["installments", "episodes"].includes(item.slug),
)) {
  test(`direct catalog route ${collection.slug} loads without runtime errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/database/${collection.slug}`);
    await expect(page.getByRole("heading", { name: collection.title, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
