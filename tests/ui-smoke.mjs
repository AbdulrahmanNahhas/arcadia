import { chromium } from "playwright-core"
import { execFileSync } from "node:child_process"

const executablePath =
  process.env.CHROMIUM_PATH ??
  execFileSync("which", ["chromium"], { encoding: "utf8" }).trim()
const baseUrl = process.env.ARCADIA_URL ?? "http://localhost:3000"

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))

await page.goto(baseUrl, { waitUntil: "networkidle" })
await page.getByRole("heading", { name: "العروض المثبّتة" }).waitFor()
await page.getByRole("heading", { name: "عروض أخرى" }).waitFor()
await page.getByRole("link", { name: /افتح المكتبة كاملة/ }).click()

const toolbar = page.getByRole("navigation", { name: "أدوات عرض المكتبة" })
await toolbar.waitFor()

// All and saved views share one destination selector; the old second control is gone.
const viewSelector = toolbar.getByRole("button", { name: "تبديل العرض" })
await viewSelector.click()
const viewsPopover = page.locator("[data-slot=popover-content]")
await viewsPopover.getByText("انتقل إلى عرض", { exact: true }).waitFor()
await viewsPopover.getByRole("button", { name: /كل الأعمال/ }).waitFor()
if (await toolbar.getByRole("button", { name: /^العروض/ }).count()) {
  throw new Error("The legacy separate saved-views control is still rendered")
}
await page.keyboard.press("Escape")

// Gallery and table settings remain usable at a compact mobile width.
await toolbar.getByRole("button", { name: "خيارات عرض المعرض" }).click()
const displayPopover = page.locator("[data-slot=popover-content]")
await displayPopover.getByText("نمط البطاقة", { exact: true }).waitFor()
await displayPopover.getByRole("button", { name: "غلاف وعنوان" }).click()
await displayPopover.getByRole("button", { name: "الجدول" }).click()
await displayPopover.getByText("الأعمدة الظاهرة", { exact: true }).waitFor()
await displayPopover.getByRole("checkbox", { name: "العنوان" }).click()
await page.keyboard.press("Escape")
await page.getByRole("table").waitFor()

await page.screenshot({
  path: "/tmp/arcadia-unified-views-mobile.png",
  fullPage: false,
})

// The admin manager exposes view identity and promotion controls.
await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" })
await page.getByRole("button", { name: "إدارة العروض" }).click()
const manager = page.getByRole("dialog", { name: "إدارة العروض المحفوظة" })
await manager.waitFor()
const viewRows = manager.locator("[data-view-id]")
if (await viewRows.count()) {
  await viewRows.first().click()
  await manager.getByLabel("الاسم").waitFor()
  await manager
    .getByRole("switch", { name: "الترويج في الصفحة الرئيسية" })
    .waitFor()
}

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`)

await browser.close()
console.log("Unified views browser smoke test passed.")
