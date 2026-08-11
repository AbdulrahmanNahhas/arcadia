import { expect, test } from "@playwright/test";

test("family profile browses an accessible title in RTL", async ({ page }) => {
  await page.goto("/profiles");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: /ليلة العائلة/ }).click();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page.getByRole("heading", { name: "قاعدة البيانات" })).toBeVisible();
  const firstTitle = page.locator('a[href^="/titles/"]').first();
  await expect(firstTitle).toBeVisible();
  await firstTitle.click();
  await expect(page).toHaveURL(/\/titles\//);
  await expect(page.getByRole("tab", { name: "التقييم" })).toBeVisible();
});

test("merged title restores Arabic editorial data, score, and installment posters", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "http://127.0.0.1:3001/api/v1/titles?mode=titles&q=Chainsaw%20Man&limit=5",
  );
  const catalog = (await response.json()) as { items: Array<{ id: string }> };
  await page.goto(`/titles/${catalog.items[0]?.id}`);
  await expect(page.getByRole("heading", { name: "رجل المنشار" })).toBeVisible();
  await expect(page.getByText("(2 من 2)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "الأجزاء والمواسم" })).toBeVisible();
  const reze = page.getByRole("link", { name: /Chainsaw Man - The Movie: Reze Arc/ });
  await expect(reze).toBeVisible();
  await reze.click();
  await expect(page).toHaveURL(/\/titles\/[0-9a-f-]+\/installments\/[0-9a-f-]+$/);
  await expect(page.getByRole("tab", { name: "الأجزاء والحلقات" })).toHaveAttribute("data-active");
  await expect(page.getByRole("button", { name: "تشغيل الفيلم" })).toBeVisible();
});

test("browse switches to flattened installments", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("button", { name: "الأحدث" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "الجديد" })).toHaveCount(0);
  await page.getByRole("button", { name: "الأقدم" }).click();
  await expect(page.getByRole("button", { name: "الأقدم" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "المواسم والأفلام" }).click();
  await expect(page.getByRole("button", { name: "الأقدم" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/من \d+ عمل/)).toBeVisible();
  await expect(page.locator('a[href^="/titles/"]').first()).toBeVisible();
});

test("people and studio cards open their restored detail pages", async ({ page }) => {
  await page.goto("/people");
  const person = page.locator('a[href^="/people/"]').first();
  await expect(person).toBeVisible();
  await person.click();
  await expect(page.getByRole("heading", { name: "أعمال مرتبطة" })).toBeVisible();

  await page.goto("/studios");
  const studio = page.locator('a[href^="/studios/"]').first();
  await expect(studio).toBeVisible();
  await studio.click();
  await expect(page.getByRole("heading", { name: "أعمال مرتبطة" })).toBeVisible();
});

test("non-admin mock profiles cannot open admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "لوحة الإدارة مقفلة لهذا الملف" })).toBeVisible();
});

test("admin catalog opens the full-page v2 editor", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("arcadia:demo-profile", "demo-admin"));
  await page.goto("/admin/catalog");
  await expect(page.getByRole("heading", { name: "الأعمال والكتالوج" })).toBeVisible();
  const editLink = page
    .locator('a[href^="/admin/catalog/"]:not([href="/admin/catalog/new"])')
    .first();
  await expect(editLink).toBeVisible();
  await editLink.click();
  await expect(page).toHaveURL(/\/admin\/catalog\/[0-9a-f-]+$/);
  await expect(page.getByText("عمل خاص", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "تعديل البنية" })).toBeVisible();
});

test("admin JSON editor uses selectable v3 fields and calendar dates", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("arcadia:demo-profile", "demo-admin"));
  await page.goto("/admin/catalog");
  await page
    .locator('[aria-label^="تحديد "]:not([aria-label="تحديد كل النتائج الحالية"])')
    .first()
    .click();
  await page.getByRole("button", { name: "محرر JSON" }).click();
  const editor = page.getByRole("textbox", { name: "JSON للسجلات المعروضة" });
  await expect(editor).toHaveValue(/"schemaVersion": 3/);
  await expect(editor).toHaveValue(/"installments"/);
  await expect(editor).toHaveValue(/"releaseDate"/);
  await expect(editor).not.toHaveValue(/scoreComponents/);
  await expect(editor).not.toHaveValue(/releaseAt/);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "تواريخ الأجزاء فقط" }).click();
  await expect(editor).toHaveValue(/"releaseDate"/);
  await expect(editor).not.toHaveValue(/"episodes"/);
  await expect(editor).not.toHaveValue(/"canonicalTitle"/);
  await page.getByRole("button", { name: /الحقول/ }).click();
  await expect(page.getByRole("checkbox", { name: /تاريخ الإصدار/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /تاريخ الحلقة/ })).toBeVisible();
});

test("admin overview reflects the v2 catalog pipeline", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("arcadia:demo-profile", "demo-admin"));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "مركز قيادة الأرشيف" })).toBeVisible();
  await expect(page.getByText("عنوان جامع", { exact: true })).toBeVisible();
  await expect(page.getByText("موسم أو فيلم", { exact: true })).toBeVisible();
  await expect(page.getByText("جاهزية النشر", { exact: true })).toBeVisible();
});
