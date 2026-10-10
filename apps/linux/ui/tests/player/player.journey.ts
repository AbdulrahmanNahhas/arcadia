import { expect, test, type Page } from "@playwright/test";

import type { PlayerRequest, PlayerSnapshot } from "../../src/features/player/bridge";

declare global {
  interface Window {
    playerTest: { calls: PlayerRequest[]; update: (changes: Partial<PlayerSnapshot>) => void };
  }
}

const initial: PlayerSnapshot = {
  active: true,
  sessionId: "test-1",
  title: "فيديو الاختبار المحلي",
  sourceKind: "local",
  paused: true,
  position: 20,
  duration: 120,
  seekable: true,
  volume: 75,
  muted: false,
  speed: 1,
  buffering: false,
  ended: false,
  fullscreen: false,
  audioDelay: 0,
  subtitleDelay: 0,
  subtitleSize: 55,
  subtitlePosition: 100,
  tracks: [
    {
      id: 1,
      kind: "audio",
      title: null,
      language: "ara",
      codec: "aac",
      selected: true,
      external: false,
    },
    {
      id: 2,
      kind: "subtitle",
      title: "ترجمة الملف",
      language: "en",
      codec: "srt",
      selected: true,
      external: false,
    },
  ],
  hwdec: null,
  videoCodec: "h264",
  error: null,
};

async function mock(page: Page, snapshot = initial) {
  await page.addInitScript((fixture: PlayerSnapshot) => {
    let state = fixture;
    let staleAfterClose: PlayerSnapshot | null = null;
    const requests: PlayerRequest[] = [];
    Object.assign(window, {
      playerTest: {
        calls: requests,
        update: (changes: Partial<PlayerSnapshot>) => {
          state = { ...state, ...changes };
        },
      },
    });
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage: (message: string) => {
            // SAFETY: this isolated harness only receives requests parsed by callPlayer's Zod schema.
            const request = JSON.parse(message) as { id: string } & PlayerRequest;
            requests.push(request);
            switch (request.command) {
              case "player.status":
                break;
              case "player.pickVideo":
                state = { ...fixture, sessionId: "test-2" };
                staleAfterClose = null;
                break;
              case "player.close":
                staleAfterClose = state;
                state = { ...state, active: false, sessionId: null };
                break;
              case "player.pause":
                state = { ...state, paused: request.payload.paused };
                break;
              case "player.seek":
                state = {
                  ...state,
                  position: Math.max(
                    0,
                    Math.min(
                      state.duration,
                      request.payload.seconds + (request.payload.relative ? state.position : 0),
                    ),
                  ),
                };
                break;
              case "player.mute":
                state = { ...state, muted: request.payload.muted };
                break;
              case "player.volume":
                state = { ...state, volume: request.payload.volume };
                break;
              case "player.speed":
                state = { ...state, speed: request.payload.speed };
                break;
              case "player.fullscreen":
                state = { ...state, fullscreen: request.payload.enabled };
                break;
              case "player.track":
                state = {
                  ...state,
                  tracks: state.tracks.map((track) =>
                    track.kind === request.payload.kind
                      ? { ...track, selected: track.id === request.payload.trackId }
                      : track,
                  ),
                };
                break;
              case "player.delay":
                state =
                  request.payload.kind === "audio"
                    ? { ...state, audioDelay: request.payload.seconds }
                    : { ...state, subtitleDelay: request.payload.seconds };
                break;
              case "player.subtitleStyle":
                state = {
                  ...state,
                  subtitleSize: request.payload.size,
                  subtitlePosition: request.payload.position,
                };
                break;
              case "player.pickSubtitle":
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result: null });
                return;
            }
            window["__nahhasioReply"]?.({
              id: request.id,
              ok: true,
              result:
                request.command === "player.status" && staleAfterClose ? staleAfterClose : state,
            });
          },
        },
      },
    };
  }, snapshot);
  await page.goto("/tests/player/");
  await expect(page.getByRole("heading", { name: initial.title })).toBeVisible();
}

async function update(page: Page, changes: Partial<PlayerSnapshot>) {
  await page.evaluate((next) => {
    window.playerTest.update(next);
  }, changes);
}
async function calls(page: Page, command: PlayerRequest["command"]) {
  return page.evaluate((name) => {
    return window.playerTest.calls.filter((call) => call.command === name);
  }, command);
}

test("typed controls and keyboard use native commands, not HTML video", async ({ page }) => {
  await mock(page);
  await expect(page.locator("video")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "إيقاف مؤقت", exact: true })).toBeVisible();
  await page.keyboard.press("l");
  await expect
    .poll(() => calls(page, "player.seek"))
    .toEqual([
      expect.objectContaining({ payload: { sessionId: "test-1", seconds: 10, relative: true } }),
    ]);
  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "إلغاء كتم الصوت" })).toBeVisible();
  await page.keyboard.press("f");
  await expect(page.getByRole("button", { name: "الخروج من ملء الشاشة" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "ملء الشاشة", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "الصوت", exact: true }).click();
  await expect(page.getByRole("radio", { name: /العربية/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "الصوت", exact: true })).toBeFocused();
  expect(await calls(page, "player.close")).toHaveLength(0);
});

test("preview panels never invent playback progress or tracks", async ({ page }) => {
  await mock(page, {
    ...initial,
    sourceKind: null,
    position: 0,
    duration: 0,
    seekable: false,
    tracks: [],
    hwdec: null,
    videoCodec: null,
  });
  await expect(page.getByText("معاينة المشغّل · لم يبدأ التشغيل")).toBeVisible();
  await expect(page.getByRole("button", { name: "تشغيل", exact: true })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "موضع التشغيل" })).toBeDisabled();
  await page.keyboard.press("Space");
  await page.keyboard.press("m");
  expect(await calls(page, "player.pause")).toHaveLength(0);
  expect(await calls(page, "player.mute")).toHaveLength(0);
  await page.getByRole("button", { name: "الترجمة", exact: true }).click();
  await expect(page.getByRole("button", { name: "إضافة ملف ترجمة" })).toBeDisabled();
  await expect(page.getByText("تظهر الترجمات المرفقة بعد فتح الفيديو.")).toBeVisible();
});

test("honest source, episode, subtitle and codec panels", async ({ page }) => {
  await mock(page);
  await page.getByRole("button", { name: "الحلقات", exact: true }).click();
  await expect(page.getByText("هذا الملف غير مرتبط بحلقات")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "مصدر الفيديو", exact: true }).click();
  await expect(page.getByText("مصادر الشبكة غير متاحة في هذا الإصدار.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "الترجمة", exact: true }).click();
  await page.getByRole("radio", { name: "إيقاف الترجمة", exact: true }).check();
  await expect
    .poll(() => calls(page, "player.track"))
    .toEqual([
      expect.objectContaining({
        payload: { sessionId: "test-1", kind: "subtitle", trackId: null },
      }),
    ]);
  await page.getByRole("button", { name: "إضافة ملف ترجمة" }).click();
  await expect.poll(async () => (await calls(page, "player.pickSubtitle")).length).toBe(1);
  await expect(page.getByRole("heading", { name: initial.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "إعدادات التشغيل" }).click();
  await expect(page.getByText("h264")).toBeVisible();
  await expect(page.getByText("غير متاح", { exact: true })).toBeVisible();
});

test("closed sessions cannot be reopened by late snapshots; fresh picker can open", async ({
  page,
}) => {
  await mock(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open test video" })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.locator(".player-host")).toHaveCount(0);
  await page.getByRole("button", { name: "Open test video" }).click();
  await expect(page.getByRole("heading", { name: initial.title })).toBeVisible();
});

test("scrubbing retains draft over remote polling and focused slider consumes arrows", async ({
  page,
}) => {
  await mock(page);
  const slider = page.getByRole("slider", { name: "موضع التشغيل" });
  const track = page.locator(".player-timeline .player-slider-track");
  const bounds = await track.boundingBox();
  if (!bounds) throw new Error("Missing timeline");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + 2);
  const draft = await slider.getAttribute("aria-valuenow");
  await update(page, { position: 5 });
  await page.waitForTimeout(500);
  await expect(slider).toHaveAttribute("aria-valuenow", draft!);
  await page.mouse.up();
  await expect.poll(async () => (await calls(page, "player.seek")).length).toBe(1);
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await calls(page, "player.seek")).length).toBe(2);
  const commands = await calls(page, "player.seek");
  expect(
    commands.every((command) => command.command === "player.seek" && !command.payload.relative),
  ).toBe(true);
});

test("auto hide protects menus, focus, pause, ended and errors at 480px RTL", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 720 });
  await mock(page, { ...initial, paused: false });
  await page.waitForTimeout(3200);
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "إغلاق المشغّل" })).toBeFocused();
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "false");
  await page.mouse.move(200, 300);
  await page.getByRole("button", { name: "الصوت", exact: true }).click();
  await page.waitForTimeout(3200);
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "false");
  await page.keyboard.press("Escape");
  await update(page, { paused: true });
  await page.waitForTimeout(3200);
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "false");
  await update(page, { paused: false, ended: true, seekable: false, duration: 0 });
  await expect(page.getByText("انتهى الفيديو")).toBeVisible();
  await expect(page.getByRole("button", { name: "تقديم 10 ثوانٍ" })).toBeDisabled();
  await update(page, { error: "خطأ الاختبار" });
  await expect(page.getByRole("alert")).toContainText("خطأ الاختبار");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/player-480.png" });
});

test("request and snapshot schemas reject out-of-range, non-finite and path-bearing input", async ({
  page,
}) => {
  await mock(page);
  const results = await page.evaluate((fixture) => {
    const valid = window.playerValidation;
    return [
      valid.request({ command: "player.volume", payload: { sessionId: "test-1", volume: 101 } }),
      valid.request({ command: "player.speed", payload: { sessionId: "test-1", speed: 0 } }),
      valid.request({
        command: "player.delay",
        payload: { sessionId: "test-1", kind: "subtitle", seconds: 601 },
      }),
      valid.request({
        command: "player.track",
        payload: { sessionId: "test-1", kind: "audio", trackId: -1 },
      }),
      valid.request({ command: "player.pickVideo", payload: { path: "/private/video.mkv" } }),
      valid.request({
        command: "player.seek",
        payload: { sessionId: "test-1", seconds: -1, relative: false },
      }),
      valid.snapshot({ ...fixture, duration: Infinity }),
      valid.snapshot({ ...fixture, active: false }),
      valid.request({
        command: "player.subtitleStyle",
        payload: { sessionId: "test-1", size: 55, position: 100 },
      }),
    ];
  }, initial);
  expect(results).toEqual([false, false, false, false, false, false, false, false, true]);
});

test("native-closed sessions stay closed even without a UI close command", async ({ page }) => {
  await mock(page);
  await update(page, { active: false, sessionId: null });
  await expect(page.locator(".player-host")).toHaveCount(0);
  await update(page, { active: true, sessionId: "test-1" });
  await page.waitForTimeout(1300);
  await expect(page.locator(".player-host")).toHaveCount(0);
});
