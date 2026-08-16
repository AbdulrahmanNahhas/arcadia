import { expect, test } from "@playwright/test";

const credentials = {
  owner: { username: "admin", password: "ArcadiaAdmin!2026" },
  family: { username: "family", password: "ArcadiaFamily!2026" },
} as const;

async function signIn(
  page: import("@playwright/test").Page,
  account: keyof typeof credentials = "owner",
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(credentials[account].username);
  await page.locator('input[name="password"]').fill(credentials[account].password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

test.beforeEach(async ({ page }) => signIn(page));

test("home watch radar handles pinned works without banner artwork", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /^اعرض / })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "افتح الرادار كاملًا" }).click();
  const radar = page.getByRole("dialog");
  await expect(radar.getByRole("heading", { name: "على رادار المشاهدة" })).toBeVisible();
  await expect(radar.locator('a[href^="/titles/"]').first()).toBeVisible();
});

test("family account browses an accessible title in RTL", async ({ page }) => {
  await signIn(page, "family");
  await page.goto("/accounts");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("أنت هنا")).toBeVisible();
  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "قاعدة البيانات" })).toBeVisible();
  const firstTitle = page.locator('a[href^="/titles/"]').first();
  await expect(firstTitle).toBeVisible();
  await firstTitle.click();
  await expect(page).toHaveURL(/\/titles\//);
  await expect(page.getByRole("tab", { name: "التقييم" })).toBeVisible();
});

test("family archive hub exposes personal and shared tools", async ({ page }) => {
  await signIn(page, "family");
  await page.goto("/archive");
  await expect(
    page.getByRole("heading", { name: "المكتبة العائلية، من دون أن تفقد طابعها الشخصي" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "مكتبتي" })).toBeVisible();
  await page.getByRole("tab", { name: "التقويم" }).click();
  await expect(page.getByRole("heading", { name: "تقويم الإصدارات" })).toBeVisible();
  await page.getByRole("tab", { name: "الطلبات" }).click();
  await expect(page.getByText("طلب جديد", { exact: true })).toBeVisible();
});

test("title detail exposes Arabic editorial data, scores, family, and installments", async ({
  page,
}) => {
  const response = await page.request.get(
    "http://127.0.0.1:3001/api/v1/titles?mode=titles&limit=1",
  );
  const catalog = (await response.json()) as {
    items: Array<{ id: string; titleAr: string | null; canonicalTitle: string }>;
  };
  const title = catalog.items[0];
  expect(title).toBeDefined();
  if (!title) return;
  await page.goto(`/titles/${title.id}`);
  await expect(
    page.getByRole("heading", { name: title.titleAr || title.canonicalTitle }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "التقييم" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "العائلة" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "الأجزاء والمواسم" })).toBeVisible();
  const installment = page.locator(`a[href^="/titles/${title.id}/installments/"]`).first();
  await expect(installment).toBeVisible();
  await installment.click();
  await expect(page).toHaveURL(/\/titles\/[0-9a-f-]+\/installments\/[0-9a-f-]+$/);
  await expect(page.getByRole("tab", { name: "الأجزاء والحلقات" })).toHaveAttribute("data-active");
});

test("browse switches to flattened installments", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("button", { name: "العناوين" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "ضيّق الاختيار" })).toBeVisible();
  await expect(page.getByRole("button", { name: "متوسط" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "صغير" }).click();
  await expect(page.getByRole("button", { name: "صغير" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "إخفاء المرشحات" }).click();
  await expect(page.getByRole("heading", { name: "ضيّق الاختيار" })).toHaveCount(0);
  await page.getByRole("button", { name: "إظهار المرشحات" }).click();
  await page.getByRole("button", { name: "المواسم والإصدارات" }).click();
  await expect(page.getByRole("button", { name: "المواسم والإصدارات" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('a[href^="/titles/"]').first()).toBeVisible();
});

test("browse filters remain usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/browse");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('a[href^="/titles/"]').first()).toBeVisible();
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  await expect(page.getByRole("heading", { name: "مرشحات قاعدة البيانات" })).toBeVisible();
  await page.getByLabel("مرشحات قاعدة البيانات").getByText("التقييم", { exact: true }).click();
  await expect(
    page.getByLabel("مرشحات قاعدة البيانات").getByText("التقييم العام", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /عرض \d+ نتيجة/ })).toBeVisible();
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

test("non-admin accounts cannot open admin", async ({ page }) => {
  await signIn(page, "family");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "لوحة الإدارة مقفلة لهذا الحساب" })).toBeVisible();
});

test("admin catalog opens the full-page v2 editor", async ({ page }) => {
  await page.goto("/admin/catalog");
  await expect(page.getByRole("heading", { name: "الأعمال والكتالوج" })).toBeVisible();
  const editLink = page
    .locator('a[href^="/admin/catalog/"]:not([href="/admin/catalog/new"])')
    .first();
  await expect(editLink).toBeVisible();
  await editLink.click();
  await expect(page).toHaveURL(/\/admin\/catalog\/[0-9a-f-]+$/);
  await expect(page.getByText(/^(ظاهر للعامة|عمل خاص)$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "تعديل البنية" })).toBeVisible();
});

test("admin JSON editor uses selectable v3 fields and calendar dates", async ({ page }) => {
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
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "مركز قيادة الأرشيف" })).toBeVisible();
  await expect(page.getByText("عنوان جامع", { exact: true })).toBeVisible();
  await expect(page.getByText("موسم أو فيلم", { exact: true })).toBeVisible();
  await expect(page.getByText("جاهزية النشر", { exact: true })).toBeVisible();
});

test("admin archive operations combines quality, requests, and audit", async ({ page }) => {
  await page.goto("/admin/archive");
  await expect(page.getByRole("heading", { name: "غرفة عمليات الأرشيف" })).toBeVisible();
  await expect(page.getByText("جودة البيانات", { exact: true })).toBeVisible();
  await expect(page.getByText("قائمة جودة المحتوى", { exact: true })).toBeVisible();
  await expect(page.getByText("المهام والأدوات", { exact: true })).toBeVisible();
  await expect(page.getByText("سجل التدقيق", { exact: true })).toBeVisible();
});

test("admin media exposes orphan cleanup and keeps wide routes inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const expectNoPageOverflow = async () => {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  };

  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { name: "مكتبة الوسائط" })).toBeVisible();
  await page.getByLabel("البحث في الوسائط").fill("poster");
  await expect(page.locator("[data-slot=card]").first()).toBeVisible();
  await expectNoPageOverflow();

  await page.goto("/admin/validation");
  await expect(page.getByRole("heading", { name: "التحقق من البيانات" })).toBeVisible();
  await expectNoPageOverflow();

  await page.goto("/admin/catalog");
  await expect(page.getByRole("heading", { name: "الأعمال والكتالوج" })).toBeVisible();
  await expectNoPageOverflow();
  await page.locator('a[href^="/admin/catalog/"]:not([href="/admin/catalog/new"])').first().click();
  await page.getByRole("tab", { name: "الصور والظهور" }).click();
  await expect(page.getByText("الظهور والصور")).toBeVisible();
  await expectNoPageOverflow();
});
