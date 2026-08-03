import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const executablePath =
  process.env.CHROMIUM_PATH ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-crashpad", "--disable-crash-reporter"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

const baseUrl = process.env.ARCADIA_URL ?? "http://localhost:3000";
await page.goto(`${baseUrl}/library?work=animation-tv-attack-on-titan`, {
  waitUntil: "domcontentloaded",
});

const dialog = page.getByRole("dialog");
await dialog.waitFor();
await dialog.getByText("متابعة التقدّم", { exact: true }).waitFor();
await dialog.getByText("سجل النشاط", { exact: true }).waitFor();
await dialog
  .getByText(/الحلقات/)
  .first()
  .waitFor();

await dialog.getByRole("button", { name: "تحديث التقدّم" }).click();
await dialog.getByText(/(الوحدات التي ستُضاف إلى هذا اليوم|لا توجد وحدات جديدة)/).waitFor();
await dialog
  .getByText(/الموسم/)
  .first()
  .waitFor();

await page.screenshot({
  path: ".tmp-arcadia-tracking-work-detail.png",
  fullPage: false,
});

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

await browser.close();
console.log("Work detail browser smoke test passed.");
