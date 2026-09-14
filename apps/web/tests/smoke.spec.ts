import { titleSocialSchema } from "@arcadia/contracts";
import { expect, test } from "@playwright/test";
import { z } from "zod";

const titlesQuickBrowseSchema = z.object({
  items: z.array(
    z.object({ id: z.string(), titleAr: z.string().nullable(), canonicalTitle: z.string() }),
  ),
});
const titleIdsBrowseSchema = z.object({ items: z.array(z.object({ id: z.string() })) });
const meAccountSchema = z.object({ account: z.object({ id: z.string() }) });

const credentials = {
  owner: { username: "admin", password: "ArcadiaAdmin!2026" },
  family: { username: "family", password: "ArcadiaFamily!2026" },
} as const;

async function signIn(
  page: import("@playwright/test").Page,
  account: keyof typeof credentials = "owner",
) {
  // Browser tests replay the desktop bearer token from localStorage as well as the session cookie.
  // Clear both so switching test accounts cannot be redirected away from the login screen.
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.removeItem("arcadia:sessionToken"));
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(credentials[account].username);
  await page.locator('input[name="password"]').fill(credentials[account].password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

test.beforeEach(async ({ page }) => signIn(page));

test("home navigation reaches the hero, planets, and RTL work rails", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-spatial-rail]").first()).toBeVisible();

  const focusedTarget = page.locator('[data-focused="true"]');
  await expect(focusedTarget).toHaveCount(1);
  await expect(focusedTarget).toBeInViewport();
  await expect(focusedTarget).toBeAttached();
  await expect(focusedTarget).toHaveAttribute("href", /\/titles\/.+/);

  await page.keyboard.press("ArrowDown");
  await expect(focusedTarget).toHaveRole("button");
  await page.keyboard.press("ArrowDown");
  const focusedPlanet = page.locator('a[data-spatial-auto="true"][data-focused="true"]');
  await expect(focusedPlanet).toHaveAttribute("href", /\/planets\/.+/);
  await expect(focusedPlanet).toBeInViewport();

  await page.keyboard.press("ArrowDown");
  const focusedCard = page.locator('[data-spatial-rail] a[data-focused="true"]');
  await expect(focusedCard).toHaveCount(1);
  await expect(focusedCard).toBeInViewport();
  await expect(page.getByRole("link", { name: "عرض الكل" }).first()).toHaveAttribute(
    "data-spatial-auto",
    "true",
  );
  const focusedRail = focusedCard.locator("xpath=ancestor::*[@data-spatial-rail]");
  await expect(focusedCard).toHaveAttribute(
    "href",
    await focusedRail.locator('a[href^="/titles/"]').first().getAttribute("href"),
  );
  const firstHref = await focusedCard.getAttribute("href");

  await page.keyboard.press("ArrowLeft");
  await expect(focusedCard).toHaveCount(1);
  await expect(focusedCard).toBeInViewport();
  expect(await focusedCard.getAttribute("href")).not.toBe(firstHref);

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/titles\//);
});

test("planet and entity directories expose their cards to arrow navigation", async ({ page }) => {
  await page.goto("/planets");
  const firstPlanetHref = await page
    .locator('#main-content a[href^="/planets/"]')
    .first()
    .getAttribute("href");
  const focusedPlanet = page.locator(
    '#main-content a[href^="/planets/"][data-spatial-auto="true"][data-focused="true"]',
  );
  await expect(focusedPlanet).toHaveCount(1);
  await expect(focusedPlanet).toBeInViewport();
  await expect(focusedPlanet).toHaveAttribute("href", firstPlanetHref ?? "");

  await page.goto("/studios");
  const focusedDirectoryControl = page.locator(
    '#main-content [data-spatial-auto="true"][data-focused="true"]',
  );
  await expect(focusedDirectoryControl).toHaveCount(1);
  await expect(focusedDirectoryControl).toBeInViewport();

  await page.goto("/people");
  await expect(focusedDirectoryControl).toHaveCount(1);
  await expect(focusedDirectoryControl).toBeInViewport();

  await page.goto("/compare");
  const focusedCompareControl = page.locator(
    '#main-content [data-spatial-auto="true"][data-focused="true"]',
  );
  await expect(focusedCompareControl).toHaveCount(1);
  await expect(focusedCompareControl).toBeInViewport();
});

test("browse and title actions receive focus before their work cards", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/browse");
  const focusedBrowseControl = page.locator(
    '#main-content [data-spatial-auto="true"][data-focused="true"]',
  );
  await expect(focusedBrowseControl).toHaveCount(1);
  await expect(focusedBrowseControl).toBeInViewport();
  await expect(focusedBrowseControl).not.toHaveAttribute("href", /\/titles\/.+/);

  const response = await page.request.get(
    "http://127.0.0.1:23101/api/v1/titles?mode=titles&limit=1",
  );
  // SAFETY: this test calls Arcadia's typed catalog endpoint and only reads the documented fields.
  const catalog = (await response.json()) as { items: Array<{ id: string }> };
  const title = catalog.items[0];
  expect(title).toBeDefined();
  if (!title) return;

  await page.goto(`/titles/${title.id}`);
  const focusedTitleAction = page.locator(
    '#main-content [data-spatial-auto="true"][data-focused="true"]',
  );
  await expect(focusedTitleAction).toHaveCount(1);
  await expect(focusedTitleAction).toBeInViewport();
  await expect(page.locator('#main-content [data-spatial-auto="true"]')).not.toHaveCount(0);
  await expect(page.getByRole("tab", { name: "ملف العمل" })).toHaveAttribute(
    "data-spatial-managed",
    "true",
  );
  await expect(page.getByRole("tabpanel")).not.toHaveAttribute("data-spatial-auto", "true");

  const overviewTab = page.getByRole("tab", { name: "ملف العمل" });
  const episodesTab = page.getByRole("tab", { name: "الأجزاء والحلقات" });
  await overviewTab.click();
  await page.keyboard.press("ArrowLeft");
  await expect(episodesTab).toBeFocused();
  await expect(episodesTab).toHaveAttribute("aria-selected", "true");
  const firstInstallment = page
    .getByRole("region", { name: "اختيار الجزء" })
    .getByRole("button")
    .first();
  await expect(firstInstallment).toHaveAttribute("data-spatial-auto", "true");
  await page.keyboard.press("ArrowDown");
  await expect(firstInstallment).toBeFocused();
});

test("the explore menu releases focus toward the left side of the header", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /استكشف/ });
  await trigger.click();
  const menu = page.locator('[data-slot="navigation-menu-content"]');
  await expect(menu).toBeVisible();
  await menu.getByRole("link").first().focus();

  await page.keyboard.press("ArrowLeft");

  await expect(menu).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(document.activeElement?.closest("[data-header-actions]"))),
    )
    .toBe(true);
});

test("the shell profile switcher clears the active session before changing account", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /الملف والحساب/ }).click();
  const switchTarget = page.getByRole("menuitem").filter({ hasText: "يتطلب كلمة المرور" }).first();
  await expect(switchTarget).toBeVisible();

  await Promise.all([
    page.waitForURL((url) => url.pathname === "/login" && url.searchParams.has("profile")),
    switchTarget.click(),
  ]);

  const selectedProfile = new URL(page.url()).searchParams.get("profile");
  expect(selectedProfile).toBeTruthy();
  await expect(page.locator('input[name="username"]')).toHaveValue(selectedProfile ?? "");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("arcadia:sessionToken")))
    .toBeNull();
});

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
  await expect(page.locator("#main-content h1")).toBeVisible();
  await page.goto("/browse");
  await expect(page.getByRole("textbox", { name: "البحث في قاعدة البيانات" })).toBeVisible();
  const firstTitle = page.locator('a[href^="/titles/"]').first();
  await expect(firstTitle).toBeVisible();
  await firstTitle.click();
  await expect(page).toHaveURL(/\/titles\//);
  await expect(page.getByRole("tab", { name: "التقييم" })).toBeVisible();
});

test("family account opens a title without requesting admin data", async ({ page }) => {
  await signIn(page, "family");
  await page.goto("/titles/d933a2b3-4116-4798-9666-3a4232007a8e");
  await expect(page.getByText("لا يملك هذا الحساب صلاحية الإدارة.")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "التقييم" })).toBeVisible();
});

test("family archive hub exposes personal and shared tools", async ({ page }) => {
  await signIn(page, "family");
  await page.goto("/archive");
  await expect(page.getByRole("heading", { name: "مساحتي" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "مكتبتي" })).toBeVisible();
  await page.getByRole("tab", { name: "التقويم" }).click();
  await expect(page.getByRole("heading", { name: "تقويم الإصدارات" })).toBeVisible();
  await page.getByRole("tab", { name: "العائلة" }).click();
  await expect(page.getByRole("heading", { name: "نشاط العائلة" })).toBeVisible();
});

test("title detail exposes Arabic editorial data, scores, family, and installments", async ({
  page,
}) => {
  const response = await page.request.get(
    "http://127.0.0.1:23101/api/v1/titles?mode=titles&limit=1",
  );
  const catalog = titlesQuickBrowseSchema.parse(await response.json());
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

test("title review can be deleted from its review card", async ({ page }) => {
  const response = await page.request.get(
    "http://127.0.0.1:23101/api/v1/titles?mode=titles&limit=1",
  );
  const catalog = titleIdsBrowseSchema.parse(await response.json());
  const title = catalog.items[0];
  expect(title).toBeDefined();
  if (!title) return;

  const me = meAccountSchema.parse(
    await (await page.request.get("http://127.0.0.1:23101/api/v1/me")).json(),
  );
  const originalSocial = titleSocialSchema.parse(
    await (
      await page.request.get(`http://127.0.0.1:23101/api/v1/titles/${title.id}/social`)
    ).json(),
  );
  const originalReview = originalSocial.reviews.find((item) => item.author.id === me.account.id);
  const temporaryBody = "مراجعة مؤقتة لاختبار الحذف من البطاقة.";

  await page.request.put(`http://127.0.0.1:23101/api/v1/titles/${title.id}/review`, {
    data: { rating: 4, body: temporaryBody, containsSpoilers: false },
  });

  try {
    await page.goto(`/titles/${title.id}`);
    await page.getByRole("tab", { name: "مراجعات العائلة" }).click();
    const familyPanel = page.getByRole("tabpanel", { name: "العائلة" });
    const reviewCard = familyPanel
      .locator('[data-slot="card"]:has(button[aria-label="حذف المراجعة"])')
      .filter({ hasText: temporaryBody });
    await expect(reviewCard).toBeVisible();

    await reviewCard.locator('button[aria-label="حذف المراجعة"]').click();
    const confirmation = page.getByRole("dialog");
    await expect(confirmation.getByRole("heading", { name: "حذف مراجعتك؟" })).toBeVisible();
    await confirmation.getByRole("button", { name: "حذف المراجعة" }).click();
    await expect(reviewCard).toHaveCount(0);
  } finally {
    if (originalReview) {
      await page.request.put(`http://127.0.0.1:23101/api/v1/titles/${title.id}/review`, {
        data: {
          rating: originalReview.rating,
          body: originalReview.body,
          containsSpoilers: originalReview.containsSpoilers,
        },
      });
    } else {
      await page.request.delete(`http://127.0.0.1:23101/api/v1/titles/${title.id}/review`);
    }
  }
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

test("admin archive operations combines quality, jobs, and audit", async ({ page }) => {
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
