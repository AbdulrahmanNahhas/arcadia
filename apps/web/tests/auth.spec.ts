import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { z } from "zod";

test.use({ storageState: { cookies: [], origins: [] } });

test("logged-out dashboard navigation redirects to the minimal owner login", async ({ page }) => {
  await page.goto("/database/works");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "تسجيل الدخول", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "البريد الإلكتروني" })).toBeVisible();
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "تسجيل الدخول", exact: true })).toBeDisabled();
  await expect(page.getByLabel("التنقل الرئيسي")).toHaveCount(0);
});

test("login accepts keyboard input without claiming authentication succeeded", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill("fixture@example.invalid");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("fixture-password");
  await expect(page.getByRole("button", { name: "تسجيل الدخول", exact: true })).toBeEnabled();
  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("a disposable owner can sign in and revoke the dashboard session", async ({ page }) => {
  const fixtureFile = process.env.NAHHASIO_E2E_LOGIN_FILE;
  test.skip(
    process.env.NAHHASIO_E2E_ISOLATED !== "true" || !fixtureFile,
    "Requires owner credentials from the disposable client test database",
  );
  if (!fixtureFile) throw new Error("Disposable login fixture is required");
  const input: unknown = JSON.parse(readFileSync(fixtureFile, "utf8"));
  const credentials = z.object({ email: z.email(), password: z.string().min(1) }).parse(input);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill(credentials.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:23105/");
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/database/works");
  await expect(page).toHaveURL(/\/login$/);
});
