import { chromium } from "playwright-core"
import { execFileSync } from "node:child_process"

const executablePath =
  process.env.CHROMIUM_PATH ??
  execFileSync("which", ["chromium"], { encoding: "utf8" }).trim()
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-crashpad", "--disable-crash-reporter"],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))

await page.goto(`${process.env.ARCADIA_URL ?? "http://localhost:3000"}/feed`, {
  waitUntil: "domcontentloaded",
})
await page.getByRole("heading", { name: "النشاط" }).waitFor()
await page.getByText("اعرض السجل كما تحتاج", { exact: true }).waitFor()

// Weekly and monthly views merge repeated updates for each work into its own card.
await page
  .getByText(/تحديثات مدمجة لهذا العمل/)
  .first()
  .waitFor()
await page
  .getByText(/Oshi No Ko/i)
  .first()
  .waitFor()
await page
  .getByText(/الحلقات ٢، ٣، ٤، ٥/)
  .first()
  .waitFor()
await page.screenshot({
  path: ".tmp-arcadia-tracking-feed-week.png",
  fullPage: true,
})

await page.getByRole("button", { name: "شهري" }).click()
await page
  .getByText(/تحديثات مدمجة لهذا العمل/)
  .first()
  .waitFor()
await page.screenshot({
  path: ".tmp-arcadia-tracking-feed-month.png",
  fullPage: true,
})

// Daily mode exposes the underlying entries and their delete actions.
await page.getByRole("button", { name: "يومي" }).click()
await page
  .getByRole("button", { name: /حذف تحديث/ })
  .first()
  .waitFor()

// Summary counts real episode/chapter/movie movement by day, week, and month.
await page.getByRole("tab", { name: /ملخص/ }).click()
await page.getByText("دفتر النشاط", { exact: true }).waitFor()
await page.getByText("حلقات شوهدت", { exact: true }).waitFor()
await page.screenshot({
  path: ".tmp-arcadia-tracking-summary.png",
  fullPage: true,
})

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`)

await browser.close()
console.log("Activity feed browser smoke test passed.")
