import type { WorkDetail, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
const work: WorkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  isPrivate: false,
  canonicalTitle: "A library work",
  titleAr: "رحلة في المكتبة",
  summary: "حكاية من مكتبة العائلة",
  releaseYear: 2021,
  format: "animated",
  audience: "general",
  age: "7+",
  poster: null,
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
                            {
                              ...fixtureWork,
                              id: "00000000-0000-4000-8000-000000000003",
                              titleAr: "رحلة أخرى",
                            },
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
                      request.payload.q === "missing" ? 0 : request.payload.includePrivate ? 3 : 2,
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
      .getByRole("complementary", { name: "معاينة العمل" })
      .getByRole("heading", { name: "رحلة في المكتبة" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "دليل العائلة" }).click();
  await expect(page.getByText("تنبيه تحريري محفوظ")).toBeVisible();
  await expect(page.getByText("متوسط", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "المشاهدة", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "إغلاق المعاينة" }).click();
  await page.getByRole("searchbox").fill("missing");
  await expect(page.getByRole("heading", { name: "لا توجد أعمال مطابقة" })).toBeVisible();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "ادخل إلى مكتبتك" })).toBeVisible();
});
for (const width of [480, 640, 1024, 1440])
  test(`responsive ${width}: library and preview fit window`, async ({ page }) => {
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
  await page.getByRole("button", { name: "الصيغة", exact: true }).click();
  await page.getByRole("option", { name: "تمثيل حي", exact: true }).click();
  await expect(page.getByRole("button", { name: "الصيغة", exact: true })).toContainText("تمثيل حي");
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
  await expect(page.getByRole("complementary", { name: "معاينة العمل" })).toBeVisible();
});
