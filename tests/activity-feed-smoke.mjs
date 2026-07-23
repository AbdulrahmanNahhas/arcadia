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

await page.goto(`${process.env.ARCADIA_URL ?? "http://localhost:3000"}/feed`, {
  waitUntil: "domcontentloaded",
})
await page.getByRole("heading", { name: "Activity feed" }).waitFor()
await page.getByText("Feed filters", { exact: true }).waitFor()
await page.waitForTimeout(750)
await page
  .locator("header")
  .getByRole("button", { name: "Add activity" })
  .click()

const dialog = page.getByRole("dialog").last()
await dialog.waitFor()
await dialog.getByText("Record activity", { exact: true }).waitFor()
await dialog.getByRole("heading", { name: /Choose a work/ }).waitFor()
await dialog.getByRole("heading", { name: /What happened?/ }).waitFor()
await dialog.getByRole("button", { name: /Made progress/ }).click()
await dialog.getByText("Episode, chapter, or season").waitFor()
await dialog.getByRole("button", { name: "More options" }).click()
await dialog.getByText("Time spent (minutes)").waitFor()
await dialog.getByRole("button", { name: "JSON import" }).click()
await dialog.getByLabel("History import JSON").waitFor()

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`)

await page.screenshot({ path: "/tmp/arcadia-activity-feed.png" })
await browser.close()
