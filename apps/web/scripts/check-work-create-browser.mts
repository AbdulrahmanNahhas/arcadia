import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { closeDatabase, openDatabase } from "@arcadia/cli/db";
import { chromium } from "@playwright/test";

const sql = openDatabase();
const [{ name }] = await sql`select current_database() as name`;
assert.equal(
  name,
  "nahhasio_dashboard_test",
  "Browser creation checks require the disposable catalog.",
);
const canonicalTitle = `Disposable browser creation ${randomUUID()}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:23105/database/works/new");
  assert.equal(new URL(page.url()).port, "23105");
  await page.getByRole("textbox", { name: "العنوان الأصلي", exact: true }).fill(canonicalTitle);
  await page.getByRole("tab", { name: "البنية", exact: true }).click();
  await page.getByRole("button", { name: "إضافة جزء", exact: true }).click();
  await page.getByRole("textbox", { name: "اسم الجزء", exact: true }).fill("Browser season");
  await page.getByRole("spinbutton", { name: "القصة", exact: true }).fill("8");
  await page.getByRole("button", { name: "إضافة حلقة", exact: true }).click();
  await page.getByRole("textbox", { name: "اسم الحلقة 1", exact: true }).fill("Browser episode");
  await page.getByRole("button", { name: "مراجعة العمل", exact: true }).click();
  await page
    .getByRole("heading", { name: "مراجعة قبل الحفظ", exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(
    (await sql`select id from titles where canonical_title = ${canonicalTitle}`).length,
    0,
  );
  await page.getByRole("button", { name: "تأكيد حفظ 1 عمل", exact: true }).click();
  await page.waitForURL(/\/database\/works\/[0-9a-f-]{36}/, { timeout: 30000 });
  assert.equal(new URL(page.url()).port, "23105");
  const [{ id }] = await sql`select id from titles where canonical_title = ${canonicalTitle}`;
  assert.equal(new URL(page.url()).pathname, `/database/works/${String(id)}`);
  const [episode] =
    await sql`select e.title from episodes e join installments i on i.id=e.installment_id where i.title_id=${id}`;
  assert.equal(episode.title, "Browser episode");
  console.log(
    "PASS: GUI creation stays rolled back until confirmation, saves the complete draft, and opens the created work. Disposable preview only.",
  );
} finally {
  await browser.close();
  const rows = await sql`select id from titles where canonical_title = ${canonicalTitle}`;
  for (const row of rows) {
    await sql`delete from titles where id = ${row.id}`;
    await sql`delete from audit_logs where target_id = ${String(row.id)}`;
  }
  await closeDatabase();
}
