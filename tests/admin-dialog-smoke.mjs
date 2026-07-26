import { chromium } from "playwright-core"
import { execFileSync } from "node:child_process"

const executablePath =
  process.env.CHROMIUM_PATH ??
  execFileSync("which", ["chromium"], { encoding: "utf8" }).trim()
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))

await page.goto(process.env.ARCADIA_URL ?? "http://localhost:3000/admin", {
  waitUntil: "networkidle",
})

await page.getByRole("button", { name: "إضافة أعمال" }).click()
const addDialog = page.getByRole("dialog", {
  name: "إضافة أعمال إلى المكتبة",
})
await addDialog.waitFor()
await addDialog.getByRole("combobox", { name: "طريقة الإضافة" }).click()
await page.getByRole("option", { name: /أعمال متعددة/ }).click()
await addDialog.getByText("2 صالح").waitFor()
await page.screenshot({ path: "/tmp/arcadia-admin-add.png" })
await addDialog.getByRole("button", { name: "إلغاء" }).click()

await page.getByRole("button", { name: "محرر JSON" }).click()
const jsonDialog = page.getByRole("dialog", {
  name: "مساحة تحرير JSON لقاعدة البيانات",
})
await jsonDialog.getByText("JSON صالح").waitFor({ timeout: 15_000 })
await page.screenshot({ path: "/tmp/arcadia-admin-json.png" })
await jsonDialog.getByRole("button", { name: "إلغاء" }).click()

await page.getByRole("button", { name: "قاموس التصنيفات" }).click()
const taxonomyDialog = page.getByRole("dialog", {
  name: "قاموس التصنيفات المنقّح",
})
await taxonomyDialog.getByRole("switch", { name: "تحرير JSON" }).click()
await taxonomyDialog.getByText("JSON صالح").waitFor()
await page.screenshot({ path: "/tmp/arcadia-admin-taxonomy-json.png" })

if (errors.length) {
  throw new Error(`Browser errors:\n${errors.join("\n")}`)
}

await browser.close()
