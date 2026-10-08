// Authenticated journeys require a session on a disposable test server.
import { expect, test } from "@playwright/test";

test.skip(
  !process.env.NAHHASIO_E2E_STORAGE_STATE,
  "Provide disposable-server authenticated storage state; live credentials are never used by default tests.",
);

test("live catalog loads, searches and scrolls without writing", async ({ page }) => {
  await page.goto("/database/works");
  await expect(page.getByText("· 223 عمل")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(31);
  const poster = page.locator('section[aria-label="كتالوج الأعمال"] img').first();
  await expect
    .poll(() =>
      poster.evaluate((element) => element instanceof HTMLImageElement && element.naturalWidth > 0),
    )
    .toBe(true);
  await page.getByRole("checkbox").nth(1).check();
  await expect(page.getByRole("status")).toContainText("1 محدد");
  await page.getByRole("button", { name: "عرض الجدول", exact: true }).click();
  await expect(page.getByRole("checkbox").nth(1)).toBeChecked();
  await expect(page.getByRole("row")).toHaveCount(31);
  const title = await page
    .getByRole("row")
    .nth(1)
    .getByRole("cell")
    .nth(1)
    .getByRole("heading")
    .getByRole("link")
    .innerText();
  await expect(page.getByRole("button", { name: "التالي", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "تحميل المزيد", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("row")).toHaveCount(61);
  await expect(page.getByRole("row").nth(1).getByRole("heading")).toContainText(title);
  await page.getByRole("textbox", { name: "بحث الأعمال" }).fill(title);

  await expect(page.getByRole("table")).toContainText(title);
  await page.screenshot({ path: "../../data/previews/database-records.png", fullPage: true });
  await page.getByRole("button", { name: "عرض القائمة", exact: true }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("1 محدد");
  await page.getByRole("button", { name: "عرض البطاقات", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("textbox", { name: "بحث الأعمال" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "../../data/previews/works-mobile.png", fullPage: true });
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

test("catalog filters and sorting cover the full result set", async ({ page }) => {
  await page.goto(
    "/database/works?view=table&format=animated&workflow=draft&visibility=private&sort=year-desc",
  );
  await expect(page.getByText("جارٍ تحديث النتائج…")).toHaveCount(0);
  const rows = page.getByRole("row");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(rows.nth(1)).toContainText("مسودة");
  const years = await rows.allTextContents();
  const visibleYears = years
    .slice(1)
    .map((text) => Number(text.match(/\b(?:19|20)\d{2}\b/)?.[0]))
    .filter(Boolean);
  expect(visibleYears).toEqual(visibleYears.toSorted((a, b) => b - a));
  for (const row of await rows.all()) {
    if ((await row.getByRole("cell").count()) === 0) continue;
    await expect(row).toContainText("رسوم متحركة");
    await expect(row).toContainText("مسودة");
    await expect(row).toContainText("خاص");
  }
  await page.getByRole("button", { name: /مسح التصفية/ }).click();
  await expect(page.getByText("· 223 عمل")).toBeVisible();
  await page.getByRole("button", { name: "مسلسلات", exact: true }).click();
  await expect(page.getByText("جارٍ تحديث النتائج…")).toHaveCount(0);
  await expect(rows.nth(1)).toContainText("مسلسل");
  await expect(rows.nth(1)).not.toContainText("فيلم");
  await page.getByRole("button", { name: /مسح التصفية/ }).click();
  await page.getByRole("button", { name: "النواقص", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "بلا ملصق", exact: true }).click();
  await expect(page.getByText("جارٍ تحديث النتائج…")).toHaveCount(0);
  await expect(page.getByRole("table").locator("img")).toHaveCount(0);
  await expect(page.getByText("لا توجد أعمال مطابقة")).toBeVisible();
  await expect(page.getByText("0 / 0 عمل", { exact: true })).toBeVisible();
});

test("catalog respects available width with an expanded sidebar", async ({ page }) => {
  await page.goto("/database/works?view=table");
  await expect(page.getByRole("row")).toHaveCount(31);
  for (const width of [1280, 1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const bounds = await page.getByRole("table").locator("..").boundingBox();
    expect(bounds?.width).toBeLessThan(width);
    if (width >= 768) await expect(page.getByLabel("التنقل الرئيسي")).toBeVisible();
  }
  await page.getByRole("button", { name: "عرض القائمة", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "عرض البطاقات", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("catalog search keeps focus, restores URL state and handles empty and failure states", async ({
  page,
}) => {
  await page.goto("/database/works");
  await expect(page.getByRole("checkbox")).toHaveCount(31);
  const search = page.getByRole("textbox", { name: "بحث الأعمال" });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await search.fill("no-title-matches-this-unique-name");
  await expect(page.getByText("لا توجد أعمال مطابقة")).toBeVisible();
  await expect(search).toBeFocused();
  await page.getByRole("button", { name: "مسح البحث", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(31);
  await search.fill("Harry");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.reload();
  await expect(search).toHaveValue("Harry");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.route("**/_serverFn/**", (route) => route.abort());
  await page.getByRole("button", { name: "تحديث الأعمال" }).click();
  await expect(page.getByRole("alert")).toContainText("تعذّر تحميل الأعمال", { timeout: 20000 });
  await page.unroute("**/_serverFn/**");
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("single work keeps GUI drafts across tabs and protects navigation", async ({ page }) => {
  await page.goto("/database/works");
  await page.getByRole("article").first().getByRole("heading").getByRole("link").click();
  const title = page.getByRole("textbox", { name: "العنوان الأصلي", exact: true });
  await expect(title).toBeVisible();
  const original = await title.inputValue();
  await title.fill("Unsaved UI test draft");
  await expect(page.getByText("تغييرات غير محفوظة", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "التحرير", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "الجمهور", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
  await expect(title).toHaveValue("Unsaved UI test draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#main-content a").getByText("الأعمال", { exact: true }).click();
  await expect(title).toHaveValue("Unsaved UI test draft");
  await page.getByRole("button", { name: "تجاهل التغييرات", exact: true }).click();
  await expect(title).toHaveValue(original);
  await page.getByRole("tab", { name: "الصور والمراجع", exact: true }).click();
  await page
    .locator("#main-content")
    .getByRole("button", { name: "مكتبة الصور", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator("img").first()).toBeVisible();
  await page.keyboard.press("Escape");
  for (const width of [1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("catalog scroll reaches every work and poster range survives reload", async ({ page }) => {
  await page.goto("/database/works");
  await expect(page.getByRole("article")).toHaveCount(30);
  const slider = page.getByRole("slider", { name: "حجم الملصقات" });
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "4");
  await expect(page.locator(".catalog-gallery-largest")).toBeVisible();
  await page.reload();
  await expect(slider).toHaveAttribute("aria-valuenow", "4");
  for (const count of [60, 90, 120, 150, 180, 210, 223]) {
    await page.getByRole("button", { name: "تحميل المزيد", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("article")).toHaveCount(count);
  }
  await expect(page.getByText("وصلت إلى نهاية الأعمال")).toBeVisible();
  const links = await page
    .getByRole("article")
    .getByRole("heading")
    .getByRole("link")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
  expect(new Set(links).size).toBe(223);
  await page.getByRole("textbox", { name: "بحث الأعمال" }).fill("Harry");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.screenshot({ path: "../../data/previews/works-refined-desktop.png", fullPage: true });
});

test("select all covers unloaded works, supports exclusions, and opens the full JSON library", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/database/works");
  await expect(page.getByRole("article")).toHaveCount(30);
  await page.getByRole("checkbox", { name: "تحديد الكل", exact: true }).click();
  const bar = page.getByRole("region", { name: "إجراءات التحديد" });
  await expect(bar.getByRole("status")).toContainText("223 محدد");
  await expect(bar).toContainText("المكتبة كاملة");
  await expect(page.getByRole("article")).toHaveCount(30);
  await page.getByRole("article").first().getByRole("checkbox").uncheck();
  await expect(bar.getByRole("status")).toContainText("222 محدد");
  await expect(page.getByRole("checkbox", { name: "تحديد الكل", exact: true })).toHaveAttribute(
    "aria-checked",
    "mixed",
  );
  await page.getByRole("checkbox", { name: "تحديد الكل", exact: true }).click();
  await expect(bar.getByRole("status")).toContainText("223 محدد");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(bar.getByRole("link", { name: "محرر JSON", exact: true })).toBeVisible();
  await page.screenshot({ path: "../../data/previews/selection-mobile.png" });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: "../../data/previews/selection-desktop.png" });
  await bar.getByRole("link", { name: "محرر JSON", exact: true }).click();
  await expect(page.getByText("223 عمل في نطاق التحرير.", { exact: true })).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("schemaVersion", { timeout: 60000 });
  await expect(page.getByRole("button", { name: "مراجعة التغييرات", exact: true })).toBeDisabled();
});

test("select all respects filters and clearing selection dismisses the dock", async ({ page }) => {
  await page.goto("/database/works?q=Harry");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "تحديد الكل", exact: true }).click();
  const bar = page.getByRole("region", { name: "إجراءات التحديد" });
  await expect(bar).toContainText("1 محدد");
  await expect(bar).toContainText("كل الأعمال المطابقة للتصفية");
  await bar.getByRole("button", { name: "إلغاء التحديد", exact: true }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("article").getByRole("checkbox")).not.toBeChecked();
});

test("work refinements use radar comparisons, compact actions and scoped movie IDs", async ({
  page,
}) => {
  await page.goto("/database/works/b635c9fb-8425-4c69-b720-4b1449c48033?section=structure");
  await expect(page.locator('[data-slot="chart"] .recharts-radar')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "الحلقات", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "إضافة جزء", exact: true }).click();
  await expect(page.locator('[data-slot="chart"] .recharts-radar')).toHaveCount(2);
  await page.getByRole("button", { name: "إضافة حلقة", exact: true }).click();
  const remove = page.getByRole("button", { name: "حذف الحلقة 1", exact: true });
  expect((await remove.boundingBox())?.width).toBeLessThan(40);
  const lastField = await page
    .getByRole("spinbutton", { name: "مدة الحلقة 1", exact: true })
    .boundingBox();
  const addButton = await page
    .getByRole("button", { name: "إضافة حلقة", exact: true })
    .boundingBox();
  expect(addButton!.y).toBeGreaterThan(lastField!.y);
  await remove.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "حذف من المسودة", exact: true }).click();
  await expect(remove).toHaveCount(0);
  await page.getByRole("button", { name: "تجاهل التغييرات", exact: true }).click();
  await page.getByRole("tab", { name: "الفهرسة", exact: true }).click();
  const genre = page.getByRole("combobox", { name: "التصنيفات", exact: true });
  await genre.fill("unregistered-classification-do-not-create");
  await expect(page.getByText("لا توجد نتائج", { exact: true })).toBeVisible();
  await genre.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByText("كل التغييرات محفوظة", { exact: true })).toBeVisible();
  const checkbox = page.getByRole("checkbox", { name: /رئيسي/ }).first();
  expect((await checkbox.locator("..").boundingBox())?.width).toBeLessThan(200);
  await page.getByRole("tab", { name: "الصور والمراجع", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "tmdb", exact: true })).toHaveCount(0);

  await page.getByText("معرّفات 1917", { exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "1917 · tmdb", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "معاينة tmdb", exact: true })).toBeVisible();
  const banner = page.getByRole("img", { name: "الخلفية الحالية", exact: true });
  const logo = page.getByRole("img", { name: "الشعار الحالية", exact: true });
  await expect(banner.locator("..")).toHaveClass(/aspect-video/);
  if (await logo.count()) await expect(logo.locator("..")).toHaveClass(/aspect-square/);
});

test("source results open above the search dialog and return to its inputs", async ({ page }) => {
  let searches = 0;
  await page.route("https://fixture.invalid/artwork.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBp0AAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route("**/_serverFn/**", (route) => {
    const payload = new URL(route.request().url()).searchParams.get("payload") ?? "";
    if (!payload.includes("tmdbId") || !payload.includes("530915")) return route.continue();
    searches++;
    return route.fulfill({
      json: {
        result: {
          candidates: [
            {
              provider: "tmdb",
              externalId: "fixture-530915",
              role: "poster",
              previewUrl: "https://fixture.invalid/artwork.png",
              downloadUrl: "https://fixture.invalid/artwork.png",
              width: 100,
              height: 150,
              language: null,
              matchLabel: "1917 fixture poster",
            },
          ],
          warnings: [],
        },
        context: {},
      },
    });
  });
  await page.goto("/database/works/b635c9fb-8425-4c69-b720-4b1449c48033?section=images");
  await page.getByRole("button", { name: "المصادر أو رفع صورة", exact: true }).first().click();
  const form = page.getByRole("dialog", { name: "اختيار صورة: 1917", exact: true });
  await expect(form).toBeVisible();
  await expect(form.getByText(/tmdb: 530915/)).toBeVisible();
  await form.getByRole("button", { name: "البحث عن الصور", exact: true }).click();
  const results = page.getByRole("dialog", { name: "نتائج البحث عن الصور", exact: true });
  await expect(results).toBeVisible();
  expect(searches).toBe(1);
  await expect(page.getByRole("dialog", { includeHidden: true })).toHaveCount(2);
  const image = results.locator("img").first();
  await expect(image).toHaveClass(/aspect-2\/3/);
  await expect(image).toHaveAttribute("alt", "1917 fixture poster");
  await page.keyboard.press("Escape");
  await expect(results).toHaveCount(0);
  await expect(form.getByText(/tmdb: 530915/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("contributors and awards have compact automatic ordering", async ({ page }) => {
  await page.goto("/database/works/b635c9fb-8425-4c69-b720-4b1449c48033?section=indexing");
  await expect(page.getByRole("spinbutton", { name: /ترتيب المساهمة/ })).toHaveCount(0);
  const firstName = await page
    .getByRole("combobox", { name: "المساهم 1", exact: true })
    .getAttribute("placeholder");
  const secondName = await page
    .getByRole("combobox", { name: "المساهم 2", exact: true })
    .getAttribute("placeholder");
  await expect(page.getByRole("button", { name: "رفع المساهم 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "خفض المساهم 1", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "المساهم 1", exact: true })).toHaveAttribute(
    "placeholder",
    secondName!,
  );
  await expect(page.getByRole("combobox", { name: "المساهم 2", exact: true })).toHaveAttribute(
    "placeholder",
    firstName!,
  );
  const row = page.getByRole("button", { name: "إزالة المساهمة 1", exact: true }).locator("../..");
  await expect(row.locator('[data-slot="avatar"]')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await row.boundingBox())?.height).toBeLessThan(120);
  await page.getByRole("tab", { name: "الجوائز", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: /ترتيب الجائزة/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "رفع الجائزة 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "خفض الجائزة 1", exact: true }).click();
  await expect(page.getByText("تغييرات غير محفوظة", { exact: true })).toBeVisible();
});

test("new work uses every editor tab and round-trips its local JSON draft", async ({ page }) => {
  await page.goto("/database/works/new");
  await expect(page.getByRole("heading", { name: "عمل جديد", exact: true })).toBeVisible();
  const title = page.getByRole("textbox", { name: "العنوان الأصلي", exact: true });
  await title.fill("Complete new-work UI draft");
  await page.getByRole("tab", { name: "البنية", exact: true }).click();
  await page.getByRole("button", { name: "إضافة جزء", exact: true }).click();
  await page.getByRole("textbox", { name: "اسم الجزء", exact: true }).fill("Draft season");
  await page.getByRole("spinbutton", { name: /^القصة والحبكة ·/ }).fill("8");
  await page.getByRole("button", { name: "إضافة حلقة", exact: true }).click();
  await page.getByRole("textbox", { name: "اسم الحلقة 1", exact: true }).fill("Draft episode");
  await page.getByRole("tab", { name: "الفهرسة", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "التصنيفات", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "إضافة مساهمة", exact: true }).click();
  await expect(page.getByRole("button", { name: "رفع المساهم 1", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "التحرير", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "الجمهور", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "الصور والمراجع", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "tmdb", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "المصادر أو رفع صورة", exact: true })).toHaveCount(
    4,
  );
  await page.getByRole("tab", { name: "الجوائز", exact: true }).click();
  await page.getByRole("button", { name: "إضافة جائزة", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "جهة الجائزة 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "محرر JSON", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const code = page.locator(".cm-content");
  await expect(code).toContainText("Draft season");
  await code.press("Control+End");
  await expect(code).toContainText("Draft episode");
  const draft = {
    canonicalTitle: "Complete new-work UI draft",
    titleAr: "مسودة JSON جديدة",
    format: "animated",
    installments: [
      {
        kind: "season",
        title: "Draft season",
        position: 1,
        score: { story: 8 },
        episodes: [{ number: 1, position: 1, title: "Draft episode" }],
      },
    ],
    credits: [],
    awards: [],
  };
  await code.fill(JSON.stringify(draft, null, 2));
  await page.getByRole("button", { name: "اعتماد المسودة", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "العنوان العربي", exact: true })).toHaveValue(
    "مسودة JSON جديدة",
  );
  await expect(page.getByRole("button", { name: "مراجعة العمل", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "تجاهل التغييرات", exact: true }).click();
  await expect(title).toHaveValue("");
  await expect(page.getByText("مسودة جديدة", { exact: true })).toBeVisible();
});

test("anime IDs belong to each installment and are visible below its poster", async ({ page }) => {
  await page.goto("/database/works/4e0a92e1-ad91-461a-a6fc-8c6f8483d46c?section=images");
  await expect(
    page.getByRole("spinbutton", { name: "الموسم الثالث · anilist", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "الموسم الثالث · mal", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "anilist", exact: true })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "mal", exact: true })).toHaveCount(0);
  await page.goto("/database/works/b635c9fb-8425-4c69-b720-4b1449c48033?section=images");
  await expect(page.getByRole("spinbutton", { name: /anilist|mal/ })).toHaveCount(0);
});
