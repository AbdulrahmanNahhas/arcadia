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
  installments: [
    {
      id: "00000000-0000-4000-8000-000000000007",
      kind: "season",
      position: 1,
      title: "الموسم القادم",
      summary: "جزء قادم من حكاية العائلة",
      releaseDate: "2027-01-02",
      runtimeMinutes: null,
      status: "announced",
      externalIds: { tmdbId: null, imdbId: null, anilistId: null, malId: null },
      scores: null,
      hasMediaFile: false,
      artwork: [],
      episodes: [],
      classification: {
        audience: "general",
        age: "7+",
        sexualityRisk: "none",
        behavioralRisk: "low",
        theologyRisk: "medium",
      },
      classificationOverrides: {
        audience: null,
        age: null,
        sexualityRisk: null,
        behavioralRisk: null,
        theologyRisk: null,
      },
      releaseState: "upcoming",
      externalReferences: [],
      mediaFiles: [],
      createdAt: "2026-10-08",
      updatedAt: "2026-10-08",
    },
  ],
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
        expiresAt: "2099-10-09T00:00:00Z",
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
                        primaryColor: "#C6A7FF",
                        secondaryColor: "#332454",
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
                case "facets":
                  result = {
                    groups: [
                      {
                        key: "planets",
                        label: "الكواكب",
                        options: [{ value: "fantasy", label: "الخيال", count: 1 }],
                      },
                      {
                        key: "formats",
                        label: "الصيغة",
                        options: [
                          { value: "animated", label: "رسوم متحركة", count: 1 },
                          { value: "live-action", label: "تمثيل حي", count: 1 },
                        ],
                      },
                      {
                        key: "releaseStatuses",
                        label: "حالة الإصدار",
                        options: [{ value: "completed", label: "مكتمل", count: 2 }],
                      },
                    ],
                    yearMin: 2021,
                    yearMax: 2021,
                  };
                  break;
                case "recommendations":
                  result = {
                    items: request.payload.workId === fixtureWork.id ? [] : [fixtureWork],
                    basis: "editorial",
                  };
                  break;
                case "browse": {
                  const filters = JSON.parse(request.payload.filters);
                  let items = [
                    fixtureWork,
                    {
                      ...fixtureWork,
                      id: "00000000-0000-4000-8000-000000000003",
                      titleAr: "رحلة أخرى",
                      format: "live-action",
                    },
                    {
                      ...fixtureWork,
                      id: "00000000-0000-4000-8000-000000000004",
                      titleAr: "عمل خاص",
                      isPrivate: true,
                    },
                  ].filter(
                    (item) =>
                      request.payload.privacy === "all" ||
                      item.isPrivate === (request.payload.privacy === "private"),
                  );
                  for (const facet of filters.facets) {
                    items = items.filter((item) => {
                      const value =
                        facet.key === "formats"
                          ? item.format
                          : facet.key === "planets"
                            ? item.id === fixtureWork.id || item.isPrivate
                              ? "fantasy"
                              : ""
                            : facet.key === "releaseStatuses"
                              ? "completed"
                              : "";
                      return (
                        (!facet.include.length || facet.include.includes(value)) &&
                        !facet.exclude.includes(value)
                      );
                    });
                  }
                  if (request.payload.q)
                    items = items.filter((item) =>
                      `${item.titleAr} ${item.canonicalTitle}`.includes(request.payload.q),
                    );
                  result = {
                    items: items.map((item) => ({
                      work: item,
                      installment: null,
                      classification: {
                        audience: item.audience,
                        age: item.age,
                        sexualityRisk: "none",
                        behavioralRisk: "low",
                        theologyRisk: "medium",
                      },
                      status: "completed",
                      watchState: "unwatched",
                      criteria: {
                        story: 7,
                        characters: 7,
                        depth: 7,
                        worldBuilding: 7,
                        originality: 8,
                        craft: 7,
                      },
                    })),
                    total: items.length,
                    page: request.payload.page,
                    pageSize: request.payload.pageSize,
                  };
                  break;
                }
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
                  result = {
                    ...fixtureDetail,
                    id: request.payload.id,
                    titleAr:
                      request.payload.id === fixtureWork.id ? fixtureWork.titleAr : "رحلة أخرى",
                  };
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
async function browse(page: Page) {
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "تصفّح المكتبة" })
    .click();
  await expect(page).toHaveURL(/#\/browse$/);
  await expect(page.getByRole("heading", { name: "تصفّح المكتبة" })).toBeVisible();
}
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  const sheet = page.getByRole("dialog", { name: "مرشحات المكتبة" });
  await expect(sheet).toBeVisible();
  return sheet;
}
function latestRow(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "آخر تحديثات المكتبة", exact: true }) })
    .locator("div")
    .filter({ has: page.locator("article[data-layout]") })
    .last();
}
test("real bridge states: reject login, browse details, family guide, search and logout", async ({
  page,
}) => {
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور").fill("wrong");
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("alert")).toHaveText("بيانات الدخول غير صحيحة");
  await login(page);
  await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).first().click();
  await expect(page).toHaveURL(new RegExp("#/titles/" + work.id + "$"));
  const article = page.getByRole("article", { name: "صفحة العمل" });
  await expect(
    article.getByRole("heading", { name: "رحلة في المكتبة", exact: true, level: 1 }),
  ).toBeVisible();
  await article.getByRole("tab", { name: "العائلة", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByText("تنبيه تحريري محفوظ")).toBeVisible();
  const familyGuide = page
    .getByRole("tabpanel")
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "دليل العائلة", exact: true }) });
  await expect(familyGuide.getByText("متوسط", { exact: true })).toBeVisible();
  await expect(article.getByRole("button", { name: "المشغّل قريبًا" })).toBeDisabled();
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(page.getByRole("region", { name: "أحدث الأعمال" })).toBeVisible();
  await browse(page);
  await page.getByRole("textbox", { name: "البحث في المكتبة" }).fill("missing");
  await expect(page.getByRole("heading", { name: "لا توجد أعمال مطابقة" })).toBeVisible();
  await expect(page).toHaveURL(/q=missing/);
  await page.getByRole("button", { name: "الملف والحساب" }).click();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "ادخل إلى مكتبتك" })).toBeVisible();
});
for (const width of [480, 640, 1024, 1440])
  test("responsive " + width + ": library and work page fit window", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(page.getByRole("button", { name: "ابحث في الأرشيف" })).toBeVisible();
    await browse(page);
    await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).click();
    await expect(page.getByRole("tab", { name: "العائلة", exact: true })).toBeVisible();
    const metrics = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      width: window.innerWidth,
      main: document.getElementById("main-content")?.scrollWidth,
      available: document.getElementById("main-content")?.clientWidth,
    }));
    expect(metrics.body).toBeLessThanOrEqual(metrics.width);
    expect(metrics.main).toBeLessThanOrEqual(metrics.available!);
    await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
    await expect(page).toHaveURL(/#\/browse$/);
    await expect(page.getByRole("article", { name: "صفحة العمل" })).toHaveCount(0);
  });

test("planet navigation, private opt-in and native keyboard links", async ({ page }) => {
  await login(page);
  const row = latestRow(page);
  await row.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).focus();
  await page.keyboard.press("Tab");
  await expect(row.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeFocused();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "الكواكب", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "الكواكب", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /الخيال/ }).click();
  await expect(page).toHaveURL(/#\/planets\/fantasy$/);
  await expect(page.getByRole("heading", { name: "الخيال", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص" })).toHaveCount(0);
  let sheet = await openFilters(page);
  await sheet.getByRole("button", { name: "العامة والخاصة", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "العامة والخاصة", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await sheet.getByRole("button", { name: "عرض النتائج" }).click();
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص" })).toBeVisible();
  await expect(page).toHaveURL(/privacy=all/);
  sheet = await openFilters(page);
  await sheet.getByRole("button", { name: "العامة فقط", exact: true }).click();
  await sheet.getByRole("button", { name: "عرض النتائج" }).click();
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص" })).toHaveCount(0);
  await browse(page);
  sheet = await openFilters(page);
  await sheet.getByRole("button", { name: "تمثيل حي: غير محدد", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "تمثيل حي: محدد", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await sheet.getByRole("button", { name: "عرض النتائج" }).click();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" })).toHaveCount(0);
  sheet = await openFilters(page);
  await sheet.getByRole("button", { name: "مكتمل: غير محدد", exact: true }).click();
  await sheet.getByRole("button", { name: "عرض النتائج" }).click();
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeVisible();
  sheet = await openFilters(page);
  await sheet.getByRole("button", { name: "تمثيل حي: محدد", exact: true }).click();
  await expect(
    sheet.getByRole("button", { name: "تمثيل حي: مستبعد", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: "عرض النتائج" }).click();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toHaveCount(0);
  sheet = await openFilters(page);
  await sheet.getByRole("button", { name: "مسح كل المرشحات" }).click();
  await sheet.getByRole("button", { name: "عرض النتائج" }).click();
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
});

test("hero has real metadata, manual selection, pause and a working details action", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  const hero = page.getByRole("region", { name: "أحدث الأعمال" });
  await expect(hero).toContainText("2021");
  await expect(hero).toContainText("رسوم متحركة");
  await expect(hero).toContainText(work.summary);
  await expect(hero.getByRole("button", { name: "المشاهدة قريبًا" })).toBeDisabled();
  await hero.getByRole("button", { name: "إيقاف التبديل التلقائي" }).click();
  await expect(hero.getByRole("button", { name: "تشغيل التبديل التلقائي" })).toBeVisible();
  await hero.getByRole("button", { name: "اعرض رحلة أخرى", exact: true }).click();
  await expect(hero.getByRole("heading", { name: "رحلة أخرى" })).toBeVisible();
  await expect(hero.getByRole("button", { name: "اعرض رحلة أخرى", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "ابحث في الأرشيف" }).focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(18000);
  await expect(hero.getByRole("heading", { name: "رحلة أخرى" })).toBeVisible();
  await hero.getByRole("button", { name: "تشغيل التبديل التلقائي" }).click();
  await page.getByRole("button", { name: "ابحث في الأرشيف" }).focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(9001);
  await expect(hero.getByRole("heading", { name: "رحلة في المكتبة" })).toBeVisible();
  await hero.getByRole("button", { name: "اعرض رحلة أخرى", exact: true }).focus();
  await page.clock.fastForward(9001);
  await expect(hero.getByRole("heading", { name: "رحلة في المكتبة" })).toBeVisible();
  await hero.getByRole("button", { name: "اعرض رحلة في المكتبة", exact: true }).click();
  const details = hero.getByRole("button", { name: "عرض التفاصيل", exact: true });
  await expect(details).toHaveAttribute("href", "#/titles/" + work.id);
  await details.click();
  await expect(page).toHaveURL(new RegExp("#/titles/" + work.id + "$"));
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
});

for (const width of [480, 1440]) {
  test(
    "sidebar controls " + width + ": search dialog and keyboard dropdown under packaged CSP",
    async ({ page }) => {
      const cspErrors: string[] = [];
      page.on("console", (message) => {
        if (/Content Security Policy|violates.*policy/i.test(message.text()))
          cspErrors.push(message.text());
      });
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      const search = page.getByRole("button", { name: "ابحث في الأرشيف" });
      const searchBox = await search.boundingBox();
      expect(searchBox?.height).toBeGreaterThanOrEqual(36);
      await search.click();
      const input = page.getByRole("textbox", { name: "البحث الشامل" });
      await expect(input).toBeFocused();
      await input.fill("missing");
      await expect(page.getByRole("dialog").getByText("لا توجد نتائج مطابقة.")).toBeVisible();
      await input.fill("رحلة");
      await expect(
        page.getByRole("dialog").getByRole("link", { name: /رحلة في المكتبة/ }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(search).toBeFocused();
      await browse(page);
      const sort = page.getByRole("combobox", { name: "الترتيب", exact: true });
      await sort.focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sort).toBeFocused();
      const sheet = await openFilters(page);
      await sheet.getByRole("button", { name: "مكتمل: غير محدد", exact: true }).click();
      await expect(sheet.getByRole("button", { name: "مكتمل: محدد", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await sheet.getByRole("button", { name: "عرض النتائج" }).click();
      await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
      expect(cspErrors).toEqual([]);
    },
  );
}

test("home logic: scores, planet reset, spoilers and installment destination", async ({ page }) => {
  await login(page);
  await expect(latestRow(page).getByText("7.1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("حرق أحداث محفوظ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "إظهار تعليق يحتوي على حرق" }).click();
  await expect(page.getByText("حرق أحداث محفوظ", { exact: true })).toBeVisible();
  const upcoming = page.getByRole("region", { name: "الإصدارات القادمة" });
  await expect(upcoming).toContainText("12 حلقة");
  await upcoming.getByRole("link", { name: "تفاصيل الموسم القادم" }).click();
  await expect(page).toHaveURL(
    new RegExp("#/titles/" + work.id + "\\?installment=00000000-0000-4000-8000-000000000007$"),
  );
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "الأجزاء", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("tabpanel").getByRole("heading", { name: "الموسم القادم", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tabpanel").getByRole("button", { name: /الموسم القادم/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(upcoming.getByRole("link", { name: "تفاصيل الموسم القادم" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "الكواكب", exact: true })
    .click();
  await page.getByRole("link", { name: /الخيال/ }).click();
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(1);
  await browse(page);
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
  await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "صفحة العمل" }).getByText("7.1", { exact: true }).first(),
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
          const result:
            | { items: WorkSummary[]; basis: string }
            | { items: WorkSummary[]; total: number; page: number; pageSize: number } =
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
    await expect(page.locator("#main-content")).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ابحث في الأرشيف", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "الملف والحساب" })).toBeVisible();
    const row = latestRow(page);
    await expect(row.locator("article").first()).toBeVisible();
    await expect(row.locator("article")).toHaveCount(width < 600 ? 2 : 7);
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

for (const width of [360, 640, 1024, 1440]) {
  test(`sidebar consolidation ${width}: full-height content and bottom profile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await login(page);
    const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(page.locator("#main-content")).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "ابحث في الأرشيف" })).toBeVisible();
    await expect(rail.getByRole("link", { name: "الرئيسية", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const profile = rail.getByRole("button", { name: "الملف والحساب" });
    const box = await profile.boundingBox();
    expect(box?.y).toBeGreaterThan(600);
    const mainBox = await page.locator("#main-content").boundingBox();
    expect(mainBox?.y).toBe(0);
    expect(mainBox?.height).toBe(720);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    await profile.click();
    await expect(page.getByRole("dialog", { name: "العائلة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "تسجيل الخروج" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(profile).toBeFocused();
    if (width === 1440)
      await page.screenshot({ path: test.info().outputPath("sidebar-review.png") });
    await page.setViewportSize({ width, height: 400 });
    await expect(profile).toBeInViewport();
    const studios = rail.getByRole("link", { name: "الاستوديوهات" });
    await studios.focus();
    await expect(studios).toBeInViewport();
    await expect(profile).toBeInViewport();
  });
}

test("sidebar search: Ctrl+K, Arabic layout, result navigation and focus restoration", async ({
  page,
}) => {
  await login(page);
  const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  const search = rail.getByRole("button", { name: "ابحث في الأرشيف" });
  const browseLink = rail.getByRole("link", { name: "تصفّح المكتبة" });
  await browseLink.focus();
  await page.keyboard.press("Control+k");
  const input = page.getByRole("textbox", { name: "البحث الشامل" });
  await expect(input).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(browseLink).toBeFocused();
  await search.click();
  await expect(input).toBeFocused();
  await input.fill("رحلة");
  await expect(
    page.getByRole("dialog").getByRole("link", { name: /رحلة في المكتبة/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ن",
        code: "KeyK",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await expect(input).toBeFocused();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /رحلة في المكتبة/ })
    .click();
  await expect(page).toHaveURL(/#\/titles\//);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await rail.getByRole("button", { name: "الملف والحساب" }).click();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "العائلة" })).toBeVisible();
  await expect(input).toHaveCount(0);
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "ادخل إلى مكتبتك" })).toBeVisible();
});
