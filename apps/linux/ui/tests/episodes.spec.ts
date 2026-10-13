import type { HomeViewingItem, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";

const work: WorkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  canonicalTitle: "Family library",
  titleAr: "مكتبة العائلة",
  summary: "",
  isPrivate: false,
  score: { rating: null, scored: 0, total: 1 },
  releaseYear: 2026,
  format: "animated",
  audience: "general",
  age: "7+",
  poster: null,
  banner: null,
  logo: null,
  installmentCount: 2,
  episodeCount: 8,
};
const items: HomeViewingItem[] = Array.from({ length: 12 }, (_, index) => ({
  work,
  installmentId: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
  installmentTitle: index % 3 === 0 ? `فيلم ${index + 1}` : "الموسم الأول",
  episodeId:
    index % 3 === 0 ? null : `00000000-0000-4000-8000-${String(index + 40).padStart(12, "0")}`,
  episodeNumber: index % 3 === 0 ? null : String(index + 1),
  episodeTitle: index % 3 === 0 ? null : `حكاية ${index + 1}`,
  releaseDate: "2026-10-01",
  artwork: null,
  positionSeconds: 0,
  durationSeconds: null,
  isPlayed: false,
}));

for (const width of [520, 1440]) {
  test(`episodes masonry ${width}: portrait movies and landscape episodes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((entries) => {
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage(message: string) {
              const request = JSON.parse(message);
              let result;
              if (request.command === "session") {
                result = {
                  user: {
                    id: "fixture-owner",
                    name: "العائلة",
                    email: "fixture@example.test",
                    role: "owner",
                    accountId: "00000000-0000-4000-8000-000000000001",
                    kind: "admin",
                    avatarKey: "nahhasio-library.svg",
                    bio: "",
                    isAdmin: true,
                    updatedAt: "2026-10-12T00:00:00Z",
                  },
                  expiresAt: "2099-10-09T00:00:00Z",
                };
              } else if (request.command === "episodes") {
                result = { items: entries, page: 1, pageSize: 36, total: entries.length };
              } else {
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: false,
                  error: { message: "Unsupported fixture command", code: "bad_request" },
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
    }, items);
    await page.goto("/#/episodes");
    const masonry = page.locator('[data-navigation-layout="masonry"]');
    await expect(masonry.locator("article")).toHaveCount(items.length);
    const movie = masonry
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "فيلم 1", exact: true }) });
    await expect(movie.getByRole("link")).toHaveText("مكتبة العائلة");
    await expect(movie.locator("button > span").filter({ hasText: /^فيلم 1$/ })).toHaveCount(0);
    const ratios = await masonry.locator("article button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width / rect.height;
      }),
    );
    expect(ratios[0]).toBeCloseTo(2 / 3, 1);
    expect(ratios[1]).toBeCloseTo(16 / 9, 1);
    expect(await masonry.evaluate((element) => getComputedStyle(element).columnCount)).toBe(
      width === 520 ? "2" : "6",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const play = movie.getByRole("button");
    await play.focus();
    await play.press(width === 520 ? "ArrowDown" : "ArrowLeft");
    await expect(play).not.toBeFocused();
    await expect(masonry.locator("button:focus, a:focus")).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath("masonry.png"), fullPage: true });
  });
}
