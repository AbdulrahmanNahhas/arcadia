import type { WorkDetail, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
const work: WorkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  isPrivate: false,
  score: { rating: 7.1, scored: 1, total: 1 },
  canonicalTitle: "A library work",
  titleAr: "رحلة في المكتبة",
  summary: "حكاية من مكتبة العائلة",
  releaseYear: 2021,
  format: "animated",
  audience: "general",
  age: "7+",
  poster: null,
  banner: null,
  logo: null,
  installmentCount: 1,
  episodeCount: 2,
};
const detail: WorkDetail = {
  ...work,
  contentWarnings: "تنبيه تحريري محفوظ",
  analysisNotes: "قراءة نقدية للعمل",
  sexualityRisk: "none",
  behavioralRisk: "low",
  theologyRisk: "medium",
  externalIds: { tmdbId: null, imdbId: null, anilistId: null, malId: null },
  aliases: [],
  trivia: [],
  genres: [],
  contributions: [],
  relations: [],
  artwork: [],
  installments: [],
  curatorNotes: "",
  qualityScore: 80,
  verifiedAt: null,
  createdAt: "2026-10-08",
  updatedAt: "2026-10-08",
  externalReferences: [],
  tones: [],
  tags: [],
  countries: [],
  planets: [],
  awards: [],
  sortTitle: "A library work",
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ work: fixtureWork, detail: fixtureDetail }) => {
      const session = {
        user: { id: "test-owner", name: "العائلة", email: "fixture@example.test", role: "owner" },
        expiresAt: "2026-10-09T00:00:00Z",
      };
      let signedIn = false;
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage: (message: string) => {
              const request = JSON.parse(message);
              let result;
              switch (request.command) {
                case "session":
                  result = signedIn ? session : null;
                  break;
                case "login":
                  if (request.payload.password !== "fixture-password") {
                    window["__nahhasioReply"]?.({
                      id: request.id,
                      ok: false,
                      error: { message: "بيانات الدخول غير صحيحة", code: "unauthorized" },
                    });
                    return;
                  }
                  signedIn = true;
                  result = session;
                  break;
                case "logout":
                  signedIn = false;
                  result = null;
                  break;
                case "home":
                  result = {
                    comments: [
                      {
                        id: "00000000-0000-4000-8000-000000000006",
                        kind: "comment",
                        body: "حرق أحداث محفوظ",
                        containsSpoilers: true,
                        rating: null,
                        createdAt: "2026-10-08T12:00:00Z",
                        authorName: "أحد أفراد العائلة",
                        avatarKey: "default",
                        work: fixtureWork,
                      },
                    ],
                    upcoming: [
                      {
                        id: "00000000-0000-4000-8000-000000000007",
                        workId: fixtureWork.id,
                        workTitle: fixtureWork.canonicalTitle,
                        workTitleAr: fixtureWork.titleAr,
                        title: "الموسم القادم",
                        kind: "season",
                        releaseDate: "2027-01-02",
                        runtimeMinutes: null,
                        episodeCount: 12,
                        poster: null,
                        score: { rating: null, scored: 0, total: 1 },
                      },
                    ],
                  };
                  break;
                case "filters":
                  result = {
                    planets: [
                      {
                        id: "00000000-0000-4000-8000-000000000002",
                        slug: "fantasy",
                        nameAr: "الخيال",
                        nameEn: "Fantasy",
                        icon: "🪄",
                        count: 1,
                      },
                    ],
                    genres: [],
                    formats: ["animated", "live-action"],
                    audiences: ["general"],
                    statuses: ["completed"],
                    yearMin: 2021,
                    yearMax: 2021,
                  };
                  break;
                case "works":
                  result = {
                    items:
                      request.payload.q === "missing"
                        ? []
                        : [
                            fixtureWork,
                            ...(request.payload.planet
                              ? []
                              : [
                                  {
                                    ...fixtureWork,
                                    id: "00000000-0000-4000-8000-000000000003",
                                    titleAr: "رحلة أخرى",
                                  },
                                ]),
                            ...(request.payload.includePrivate
                              ? [
                                  {
                                    ...fixtureWork,
                                    id: "00000000-0000-4000-8000-000000000004",
                                    titleAr: "عمل خاص",
                                    isPrivate: true,
                                  },
                                ]
                              : []),
                          ],
                    page: request.payload.page ?? 1,
                    pageSize: request.payload.pageSize ?? 10,
                    total:
                      request.payload.q === "missing"
                        ? 0
                        : (request.payload.planet ? 1 : 2) +
                          (request.payload.includePrivate ? 1 : 0),
                  };
                  break;
                case "work":
                  result = fixtureDetail;
                  break;
                default:
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { message: "Unknown fixture command", code: "bad_request" },
                  });
                  return;
              }
              queueMicrotask(() =>
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result }),
              );
            },
          },
        },
      };
    },
    { work, detail },
  );
  await page.goto("/");
});
async function login(page: Page) {
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور").fill("fixture-password");
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("region", { name: "أحدث الأعمال" })).toBeVisible();
}
test("real bridge states: reject login, browse details, family guide, search and logout", async ({
  page,
}) => {
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور").fill("wrong");
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("alert")).toHaveText("بيانات الدخول غير صحيحة");
  await login(page);
  await page.getByRole("button", { name: "تفاصيل رحلة في المكتبة" }).first().click();
  await expect(
    page
      .getByRole("article", { name: "صفحة العمل" })
      .getByRole("heading", { name: "رحلة في المكتبة" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "دليل العائلة" }).click();
  await expect(page.getByText("تنبيه تحريري محفوظ")).toBeVisible();
  await expect(page.getByText("متوسط", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "المشاهدة", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await page.getByRole("searchbox").fill("missing");
  await expect(page.getByRole("heading", { name: "لا توجد أعمال مطابقة" })).toBeVisible();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "ادخل إلى مكتبتك" })).toBeVisible();
});
for (const width of [480, 640, 1024, 1440])
  test(`responsive ${width}: library and work page fit window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(page.getByRole("searchbox")).toBeVisible();
    await page.getByRole("button", { name: "اكتشف المكتبة", exact: true }).click();
    await page.getByRole("button", { name: "تفاصيل رحلة في المكتبة" }).first().click();
    await expect(page.getByRole("tab", { name: "دليل العائلة" })).toBeVisible();
    const metrics = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      width: window.innerWidth,
    }));
    expect(metrics.body).toBeLessThanOrEqual(metrics.width);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "رحلة في المكتبة" })).toHaveCount(0);
  });

test("planet navigation, private opt-in and scoped arrow keys", async ({ page }) => {
  await login(page);
  const row = page.locator(".poster-shelf").first();
  await row.getByRole("button", { name: "تفاصيل رحلة في المكتبة" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(row.getByRole("button", { name: "تفاصيل رحلة أخرى" })).toBeFocused();
  await page.getByRole("button", { name: "العوالم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "العوالم", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /الخيال/ }).click();
  await expect(page.getByRole("heading", { name: "اكتشف المكتبة" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تفاصيل عمل خاص" })).toHaveCount(0);
  await page.getByLabel("إظهار الأعمال الخاصة").check();
  await expect(page.getByRole("button", { name: "تفاصيل عمل خاص" })).toBeVisible();
  await page.getByLabel("إظهار الأعمال الخاصة").uncheck();
  await expect(page.getByRole("button", { name: "تفاصيل عمل خاص" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "الصيغة", exact: true }).click();
  await page.getByRole("option", { name: "تمثيل حي", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "الصيغة", exact: true })).toContainText(
    "تمثيل حي",
  );
});

test("hero has real metadata, manual selection, pause and a working details action", async ({
  page,
}) => {
  await login(page);
  const hero = page.getByRole("region", { name: "أحدث الأعمال" });
  await expect(hero.getByRole("list", { name: "معلومات العمل" })).toContainText("2021");
  await expect(hero.getByRole("list", { name: "معلومات العمل" })).toContainText("2 حلقة");
  await expect(hero.getByRole("button", { name: "المشاهدة قريبًا" })).toBeDisabled();
  await hero.getByRole("button", { name: "إيقاف التبديل التلقائي" }).click();
  await expect(hero.getByRole("button", { name: "تشغيل التبديل التلقائي" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await hero.getByRole("button", { name: "عرض رحلة أخرى", exact: true }).click();
  await expect(hero.getByRole("heading", { name: "رحلة أخرى" })).toBeVisible();
  await expect(hero.getByRole("button", { name: "عرض رحلة أخرى", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await hero.getByRole("button", { name: "العمل السابق" }).click();
  await expect(hero.getByRole("heading", { name: "رحلة في المكتبة" })).toBeVisible();
  await hero.getByRole("button", { name: "عرض التفاصيل", exact: true }).click();
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
});

for (const width of [480, 1440]) {
  test(`topbar ${width}: readable hero overlay and keyboard dropdown under packaged CSP`, async ({
    page,
  }) => {
    const cspErrors: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|violates.*policy/i.test(message.text()))
        cspErrors.push(message.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const input = page.getByRole("searchbox");
    const hero = page.getByRole("region", { name: "أحدث الأعمال" });
    const inputBox = await input.boundingBox();
    const heroBox = await hero.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    if (inputBox && heroBox) {
      expect(inputBox.height).toBeGreaterThanOrEqual(40);
      expect(inputBox.y).toBeGreaterThanOrEqual(heroBox.y);
      expect(inputBox.y + inputBox.height).toBeLessThan(heroBox.y + heroBox.height);
    }
    await input.fill("missing");
    await expect(page.getByRole("heading", { name: "لا توجد أعمال مطابقة" })).toBeVisible();
    await page.getByRole("button", { name: "مسح البحث" }).click();
    await expect(hero).toBeVisible();
    await page.getByRole("button", { name: "اكتشف المكتبة", exact: true }).click();
    const format = page.getByRole("combobox", { name: "الصيغة", exact: true });
    await format.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(format).toBeFocused();
    await page.getByRole("button", { name: "مرشحات", exact: true }).click();
    await page.getByRole("combobox", { name: "حالة الإصدار", exact: true }).click();
    await page.getByRole("option", { name: "مكتمل", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "حالة الإصدار", exact: true })).toContainText(
      "مكتمل",
    );
    expect(cspErrors).toEqual([]);
  });
}

test("home logic: scores, planet reset, spoilers and installment destination", async ({ page }) => {
  await login(page);
  await expect(
    page.locator(".poster-shelf").first().getByText("7.1", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("حرق أحداث محفوظ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "إظهار تعليق يحتوي على حرق" }).click();
  await expect(page.getByText("حرق أحداث محفوظ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تفاصيل الموسم القادم" }).click();
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "الأجزاء", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(page.getByRole("button", { name: "تفاصيل الموسم القادم" })).toBeFocused();
  await page.getByRole("button", { name: "العوالم", exact: true }).click();
  await page.getByRole("button", { name: /الخيال/ }).click();
  await expect(page.getByRole("button", { name: "مسح اختيار العالم" })).toBeVisible();
  await expect(page.locator(".poster-grid .poster-card")).toHaveCount(1);
  await page.getByRole("button", { name: "اكتشف المكتبة", exact: true }).click();
  await expect(page.getByRole("button", { name: "مسح اختيار العالم" })).toHaveCount(0);
  await expect(page.locator(".poster-grid .poster-card")).toHaveCount(2);
  await page.getByRole("button", { name: "تفاصيل رحلة في المكتبة" }).click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "صفحة العمل" }).getByText("7.1", { exact: true }),
  ).toBeVisible();
});

for (const width of [480, 1440]) {
  test(`sidebar-home-only ${width}: clean header and fitted rows adapt without clipping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((seed) => {
      const handler = window.webkit?.messageHandlers?.nahhasio;
      if (!handler) throw new Error("Fixture bridge missing");
      const original = handler.postMessage.bind(handler);
      handler.postMessage = (message: string) => {
        const request = JSON.parse(message);
        const items = Array.from({ length: 12 }, (_, index) => ({
          ...seed,
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          titleAr: `${seed.titleAr} ${index + 1}`,
        }));
        if (request.command === "works" || request.command === "recommendations") {
          const result =
            request.command === "recommendations"
              ? { items, basis: "editorial" }
              : {
                  items: items.slice(0, request.payload.pageSize ?? 12),
                  total: 12,
                  page: 1,
                  pageSize: request.payload.pageSize ?? 12,
                };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else original(message);
      };
    }, work);
    await login(page);
    const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(rail.getByRole("link", { name: "الرئيسية", exact: true })).toBeVisible();
    await expect(page.locator(".stremio-topbar nav")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ابحث في الأرشيف", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "الملف والحساب" })).toBeVisible();
    const row = page.locator(".home-fitted-row").first();
    await expect(row.locator("article").first()).toBeVisible();
    await expect(row.locator("article")).toHaveCount(width < 600 ? 2 : 8);
    const metrics = await row.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      tops: [...element.querySelectorAll("article")].map((card) =>
        Math.round(card.getBoundingClientRect().top),
      ),
    }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
    expect(new Set(metrics.tops).size).toBe(1);
    const hero = await page.getByRole("region", { name: "أحدث الأعمال" }).boundingBox();
    expect(hero?.height).toBeLessThan(570);
    await page.getByRole("button", { name: "ابحث في الأرشيف", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "ابحث في الأرشيف", exact: true })).toBeFocused();
  });
}
