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
await page.goto(`${baseUrl}/works/animation-tv-attack-on-titan`, {
  waitUntil: "domcontentloaded",
});

await page.getByRole("heading", { name: /Attack on Titan/ }).waitFor();
await page.getByRole("heading", { name: "المواسم والحلقات" }).waitFor();
await page.getByText(/لا يوجد تشغيل أو تقدم حلقات متزامن/).waitFor();
await page.getByRole("button", { name: "دليل المحتوى" }).click();
const guide = page.getByRole("dialog", { name: "دليل المحتوى والتحليل" });
await guide.waitFor();
await guide
  .getByText(/المحتوى الجنسي|المخاوف السلوكية|المحتوى العقدي/)
  .first()
  .waitFor();

await page.screenshot({
  path: ".tmp-arcadia-tracking-work-detail.png",
  fullPage: false,
});

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

await browser.close();
console.log("Premium work detail browser smoke test passed.");
