import { expect, test } from "@playwright/test";

import { serverSections } from "../src/features/dashboard/navigation";
import { collections } from "../src/features/database/collections";

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
  await expect(page.getByRole("button", { name: "حفظ العمل", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "المحتوى العائلي" }).click();
  await expect(page.getByText("التصنيف العائلي", { exact: true })).toBeVisible();
});

test("workspace selector switches back to server management", async ({ page }) => {
  await page.goto("/database");
  await page.getByRole("button", { name: "اختيار مساحة العمل" }).click();
  await page.getByRole("menuitem", { name: "إدارة الخادم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "لوحة التحكم", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "الأجهزة", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "الأشخاص", exact: true })).toHaveCount(0);
});

test("schema explorer contains actual fields and changes the selected table", async ({ page }) => {
  await page.goto("/database/tables");
  await expect(page.getByRole("table")).toContainText("canonical_title");
  await page.getByRole("combobox", { name: "الجدول", exact: true }).click();
  await page.getByRole("option", { name: "episodes", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("installment_id");
  await expect(page.getByRole("button", { name: "تعديل السجلات" })).toBeDisabled();
});

test("JSON workbench validates drafts locally and never enables database writes", async ({
  page,
}) => {
  await page.goto("/database/json");
  await page.getByRole("button", { name: "تحقق من JSON", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "اجتاز فحص الصيغة" })).toBeVisible();
  await page.locator(".cm-content").fill("{");
  await page.getByRole("button", { name: "تحقق من JSON", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "تحتاج المسودة إلى تصحيح" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "مراجعة وحفظ", exact: true })).toBeDisabled();
});

test("every database collection and server screen renders without runtime errors", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const collection of collections) {
    await page.goto(`/database/${collection.slug}`);
    await expect(page.getByRole("heading", { name: collection.title, exact: true })).toBeVisible();
  }
  for (const section of serverSections) {
    await page.goto(`/server/${section.slug}`);
    await expect(page.getByRole("heading", { name: section.title, exact: true })).toBeVisible();
  }
  for (const [path, title] of [
    ["/database/images", "مكتبة الصور"],
    ["/database/imports", "TMDB وFanart"],
    ["/database/validation", "التحقق والصيانة"],
    ["/database/revisions", "السجل وسلة المحذوفات"],
    ["/login", "تسجيل الدخول"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
