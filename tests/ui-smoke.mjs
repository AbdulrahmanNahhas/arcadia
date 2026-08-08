import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const executablePath =
  process.env.CHROMIUM_PATH ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
const baseUrl = process.env.ARCADIA_URL ?? "http://localhost:3000";

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: /تسعة كواكب، لكل منها مدار/ }).waitFor();
await page.getByRole("navigation", { name: "التنقل على الهاتف" }).waitFor();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "البحث" }).click();
const command = page.locator("[data-slot=dialog-content]");
await command.waitFor();
await command.locator("[data-slot=command-input]").fill("Attack on Titan");
await command
  .getByText(/Attack on Titan/)
  .first()
  .waitFor();
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);
await page.goto(`${baseUrl}/database`, { waitUntil: "domcontentloaded" });

const toolbar = page.getByRole("navigation", { name: "أدوات عرض المكتبة" });
await toolbar.waitFor();
await page.waitForTimeout(1000);

// All and saved views share one destination selector; the old second control is gone.
const viewSelector = toolbar.getByRole("button", { name: "تبديل العرض" });
await viewSelector.click();
const viewsPopover = page.locator("[data-slot=popover-content]");
await viewsPopover.getByText("انتقل إلى عرض", { exact: true }).waitFor();
await viewsPopover.getByText("كل الأعمال", { exact: true }).last().waitFor();
if (await toolbar.getByRole("button", { name: /^العروض/ }).count()) {
  throw new Error("The legacy separate saved-views control is still rendered");
}
await page.keyboard.press("Escape");

// Gallery and table settings remain usable at a compact mobile width.
await toolbar.getByRole("button", { name: "خيارات عرض المعرض" }).click();
const displayPopover = page.locator("[data-slot=popover-content]");
await displayPopover.getByText("نمط البطاقة", { exact: true }).waitFor();
await displayPopover.getByRole("button", { name: "غلاف وعنوان" }).click();
await displayPopover.getByRole("button", { name: "الجدول" }).click();
await displayPopover.getByText("الأعمدة الظاهرة", { exact: true }).waitFor();
await displayPopover.getByRole("checkbox", { name: "العنوان" }).click();
await page.keyboard.press("Escape");
await page.getByRole("table").waitFor();

await page.screenshot({
  path: "/tmp/arcadia-unified-views-mobile.png",
  fullPage: false,
});

// The admin manager exposes view identity and promotion controls.
await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "إدارة العروض" }).click();
const manager = page.getByRole("dialog", { name: "إدارة العروض المحفوظة" });
await manager.waitFor();
const viewRows = manager.locator("[data-view-id]");
if (await viewRows.count()) {
  await viewRows.first().click();
  await manager.getByLabel("الاسم").waitFor();
  await manager.getByRole("switch", { name: "الترويج في الصفحة الرئيسية" }).waitFor();
}

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

await browser.close();
console.log("Platform, search, database, and admin browser smoke test passed.");
