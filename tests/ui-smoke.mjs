import { chromium } from "playwright-core"
import { execFileSync } from "node:child_process"

const executablePath = process.env.CHROMIUM_PATH ?? execFileSync("which", ["chromium"], { encoding: "utf8" }).trim()

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
await page.getByText("Attack on Titan", { exact: true }).first().waitFor()

// The metadata filter is a real sheet backed by live library facets.
await page.getByRole("button", { name: /Filter/ }).click()
const filterSheet = page.getByRole("dialog", { name: "Filter this view" })
await filterSheet.waitFor()
await filterSheet
  .locator(".facet-section")
  .filter({ hasText: "Genres" })
  .getByRole("button", { name: /^Action/ })
  .click()
await filterSheet.getByText(/matching works/).waitFor()
await page.screenshot({ path: "/tmp/arcadia-filter.png", fullPage: false })
await filterSheet.getByRole("button", { name: "Done" }).click()

// A configured query can be saved and is immediately available in the sidebar.
await page.getByRole("button", { name: /Views/ }).click()
await page.getByPlaceholder("View name").fill("Action library")
await page.getByRole("button", { name: "Save", exact: true }).click()
await page.locator('[data-sidebar="sidebar"]').getByText("Action library").waitFor()

// Base UI sort menu should open without a missing MenuGroupContext.
await page.getByRole("button", { name: /Sort/ }).click()
await page.getByRole("menuitem", { name: "year" }).click()
await page.getByRole("menu").waitFor({ state: "hidden" })

// Data-dense layouts retain readable local artwork at desktop size.
await page.getByRole("button", { name: "Table", exact: true }).click()
const tableCover = await page.locator(".mini-cover").first().boundingBox()
if (!tableCover || tableCover.width < 40 || tableCover.height < 58) {
  throw new Error("Table artwork is still too small")
}
await page.screenshot({ path: "/tmp/arcadia-table.png", fullPage: false })
await page.getByRole("button", { name: "Timeline", exact: true }).click()
const timelineBox = await page.locator(".timeline").boundingBox()
if (!timelineBox || timelineBox.width < 900) {
  throw new Error("Timeline does not use the available workspace width")
}
await page.getByRole("button", { name: "Use dark mode" }).click()
await page.screenshot({ path: "/tmp/arcadia-timeline-dark.png", fullPage: false })
await page.getByRole("button", { name: "Use light mode" }).click()
await page.getByRole("button", { name: "Gallery", exact: true }).click()

// Sidebar preference is persisted when the real shadcn trigger is used.
await page.locator('[data-sidebar="trigger"]').click()
await page.waitForTimeout(250)
if ((await page.evaluate(() => localStorage.getItem("arcadia:sidebar-open"))) !== "false") {
  throw new Error("Sidebar state was not persisted")
}
await page.screenshot({ path: "/tmp/arcadia-sidebar-collapsed.png", fullPage: false })

// Focus canvas keeps the working toolbar and removes page chrome.
await page.getByRole("button", { name: "Expand view" }).click()
await page.getByRole("button", { name: "Exit focus" }).waitFor()
if (await page.locator(".workspace-focus .library-header").isVisible()) {
  throw new Error("Library header remained visible in focus mode")
}
await page.screenshot({ path: "/tmp/arcadia-focus.png", fullPage: false })
await page.getByRole("button", { name: "Exit focus" }).click()

// Rich records open as deep-linkable dialogs and can enter full screen.
await page.getByText("Attack on Titan", { exact: true }).first().click()
await page.getByRole("dialog").waitFor()
await page.getByText("Local record · obsidian-animation-tv-attack-on-titan").waitFor()
await page.getByRole("link", { name: /MyAnimeList/ }).waitFor()
await page.getByRole("button", { name: "Open full screen" }).click()
if (!(await page.getByRole("dialog").getAttribute("class"))?.includes("full-screen")) {
  throw new Error("Work dialog did not enter full-screen mode")
}
await page.waitForTimeout(300)
const dialogBox = await page.getByRole("dialog").boundingBox()
if (!dialogBox || dialogBox.width < 1400 || dialogBox.height < 880) {
  throw new Error("Work dialog did not fill the viewport")
}

if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`)

await page.screenshot({ path: "/tmp/arcadia-e2e.png", fullPage: false })
await browser.close()
