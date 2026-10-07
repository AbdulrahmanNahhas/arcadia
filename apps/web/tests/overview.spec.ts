import { expect, test } from "@playwright/test";

test("shows a ready server and retries on request", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/health/ready", (route) => {
    requests++;
    return route.fulfill({ json: { status: "ready" } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "لوحة التحكم" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("متصل");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "../../docs/screenshots/phase1-desktop.png", fullPage: true });
  const initialRequests = requests;
  await page.getByRole("button", { name: "إعادة فحص الاتصال" }).click();
  await expect.poll(() => requests).toBe(initialRequests + 1);
});

test("recovers from an unavailable server without inventing library data", async ({ page }) => {
  let ready = false;
  await page.route("**/api/health/ready", (route) =>
    route.fulfill({
      status: ready ? 200 : 503,
      json: { status: ready ? "ready" : "unavailable" },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("الخادم غير متاح الآن");
  ready = true;
  await page.getByRole("button", { name: "إعادة فحص الاتصال" }).click();
  await expect(page.getByRole("status")).toHaveText("متصل");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("rejects an invalid health response and remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/health/ready", (route) =>
    route.fulfill({ json: { status: "made-up" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("غير متصل");
  await expect(page.getByRole("button", { name: "إعادة فحص الاتصال" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("unknown routes offer a way back home", async ({ page }) => {
  await page.goto("/missing-page");
  await expect(page.getByText("تعذّر عرض هذه الصفحة")).toBeVisible();
  await expect(page.getByRole("link", { name: "الصفحة الرئيسية", exact: true })).toBeVisible();
});

test("the official sidebar collapses on desktop and opens as a mobile drawer", async ({ page }) => {
  await page.route("**/api/health/ready", (route) => route.fulfill({ json: { status: "ready" } }));
  await page.goto("/");
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await page.getByRole("button", { name: "إظهار أو إخفاء القائمة" }).click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "إظهار أو إخفاء القائمة" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/phase1-mobile-sidebar.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
