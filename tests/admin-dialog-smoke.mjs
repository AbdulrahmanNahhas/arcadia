import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const executablePath =
  process.env.CHROMIUM_PATH ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(process.env.ARCADIA_URL ?? "http://localhost:3000/admin", {
  waitUntil: "domcontentloaded",
});
await page.getByRole("heading", { name: "لوحة الإدارة" }).waitFor();

await page.getByRole("button", { name: "الأشخاص والمنظمات" }).click();
const entityDialog = page.locator('[data-slot="dialog-content"]').last();
await entityDialog.getByRole("heading", { name: "إدارة الأشخاص والمنظمات" }).waitFor();
await entityDialog.getByRole("button", { name: "إضافة جهة" }).waitFor();
await entityDialog.getByText(/عمل/).first().waitFor();
await page.screenshot({ path: "/tmp/arcadia-admin-entities.png" });
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "إضافة أعمال" }).click();
const addDialog = page.locator('[data-slot="dialog-content"]').last();
await addDialog.waitFor();
await addDialog.getByText("إضافة أعمال إلى المكتبة").waitFor();
await addDialog.getByRole("combobox", { name: "طريقة الإضافة" }).click();
await page.getByRole("option", { name: /أعمال متعددة/ }).click();
await addDialog.getByText("2 صالح").waitFor();
await page.screenshot({ path: "/tmp/arcadia-admin-add.png" });
await addDialog.getByRole("button", { name: "إلغاء" }).click();

await page.getByRole("button", { name: "محرر JSON" }).click();
const jsonDialog = page.locator('[data-slot="dialog-content"]').last();
await jsonDialog.getByText("مساحة تحرير JSON لقاعدة البيانات").waitFor();
await jsonDialog.getByText("JSON صالح").waitFor({ timeout: 15_000 });
await page.screenshot({ path: "/tmp/arcadia-admin-json.png" });
await jsonDialog.getByRole("button", { name: "إلغاء" }).click();

await page.getByRole("button", { name: "قاموس التصنيفات" }).click();
const taxonomyDialog = page.locator('[data-slot="dialog-content"]').last();
await taxonomyDialog.getByText("قاموس التصنيفات المنقّح").waitFor();
await taxonomyDialog.getByRole("switch", { name: "تحرير JSON" }).click();
await taxonomyDialog.getByText("JSON صالح").waitFor();
await page.screenshot({ path: "/tmp/arcadia-admin-taxonomy-json.png" });

if (errors.length) {
  throw new Error(`Browser errors:\n${errors.join("\n")}`);
}

await browser.close();
