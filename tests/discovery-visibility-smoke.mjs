import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const executablePath =
  process.env.CHROMIUM_PATH ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
const baseUrl = process.env.ARCADIA_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(`${baseUrl}/library`, { waitUntil: "domcontentloaded" });
const toolbar = page.getByRole("navigation", { name: "أدوات عرض المكتبة" });
await toolbar.waitFor();
await page.getByRole("button", { name: "فتح Cars 2" }).waitFor({ state: "detached" });
await toolbar.locator('[data-slot="dialog-trigger"]').filter({ hasText: "الفلاتر" }).waitFor();

await page.goto(`${baseUrl}/library?work=animation-movies-cars-2`, {
  waitUntil: "domcontentloaded",
});
const dialog = page.getByRole("dialog");
await dialog.waitFor();
await dialog.getByText("Cars 2", { exact: true }).first().waitFor();

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
await browser.close();
console.log("Discovery visibility browser smoke test passed.");
