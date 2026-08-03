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
await page.goto(`${baseUrl}/entities`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "الأشخاص والشركات خلف كل عمل." }).waitFor();
await page.getByText(/نتيجة/).first().waitFor();

const mappaLink = page.getByRole("link", { name: /MAPPA/ }).first();
await mappaLink.getByRole("img", { name: "MAPPA logo" }).waitFor();
await mappaLink.click();
await page.getByRole("heading", { name: "MAPPA", exact: true }).waitFor();
await page.getByRole("img", { name: "MAPPA logo" }).waitFor();
await page.getByRole("heading", { name: "الأعمال", exact: true }).waitFor();
await page.getByRole("link", { name: /MyAnimeList/ }).waitFor();

await page.screenshot({
  path: ".tmp-arcadia-entity-profile.png",
  fullPage: true,
});

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);

await browser.close();
console.log("Entity directory and profile browser smoke test passed.");
