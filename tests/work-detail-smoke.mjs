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

await page.goto(process.env.ARCADIA_URL ?? "http://localhost:3000", {
  waitUntil: "domcontentloaded",
})
await page.waitForTimeout(750)
await page.getByRole("button", { name: "Open Attack on Titan" }).click()

const dialog = page.getByRole("dialog")
await dialog.waitFor()
await dialog
  .getByText(
    "Archive record · obsidian-animation-tv-attack-on-titan · verified"
  )
  .waitFor()
await dialog.getByText("Progress ledger", { exact: true }).waitFor()
await dialog.getByText("Season 1", { exact: true }).waitFor()
await dialog.getByRole("link", { name: "IMDb" }).waitFor()
await dialog.getByText("Primary credits", { exact: true }).waitFor()
await dialog.getByText("Content dossier", { exact: true }).waitFor()

await dialog.getByRole("button", { name: "Open full screen" }).click()
if (!(await dialog.getAttribute("class"))?.includes("full-screen")) {
  throw new Error("Work dialog did not enter full-screen mode")
}
const dialogBox = await dialog.boundingBox()
if (!dialogBox || dialogBox.width < 1400 || dialogBox.height < 880) {
  throw new Error("Work dialog did not fill the viewport")
}
if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`)

await page.screenshot({ path: "/tmp/arcadia-work-detail.png" })
await browser.close()
