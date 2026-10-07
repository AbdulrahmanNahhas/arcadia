import assert from "node:assert/strict";
const token = process.env.NAHHASIO_LOCAL_ADMIN_TOKEN;
if (!token) throw new Error("NAHHASIO_LOCAL_ADMIN_TOKEN is required");
const root = "http://127.0.0.1:23104/api/database";
const headers = { "x-nahhasio-admin": token, "content-type": "application/json" };
async function request(path, method = "GET", data) {
  const res =
    method === "GET"
      ? await fetch(root + path, { headers })
      : method === "POST"
        ? await fetch(root + path, { method: "POST", headers, body: JSON.stringify(data) })
        : method === "PATCH"
          ? await fetch(root + path, { method: "PATCH", headers, body: JSON.stringify(data) })
          : await fetch(root + path, { method: "DELETE", headers, body: JSON.stringify(data) });
  const value = await res.json();
  if (res.status >= 400) throw new Error(`${res.status}: ${value.message}`);
  return value;
}
assert.equal((await fetch(root + "/schema")).status, 403);
assert.equal((await request("/status")).database, "nahhasio_dashboard_test");
const schema = await request("/schema");
assert.equal(schema.length, 71);

const titles = await request("/titles");
assert.equal(titles.total, 223);
console.log("Titles:", titles.total);
const label = "nahhasio_disposable_test_" + Date.now();
const created = await request("/genres", "POST", {
  values: { slug: label, label_en: label, label_ar: "اختبار" },
});
console.log("Created record");
const key = { id: created.id };
const updated = await request("/genres", "PATCH", {
  key,
  original: created,
  values: { label_ar: "اختبار التعديل" },
});
assert.equal(updated.label_ar, "اختبار التعديل");
console.log("Updated record");
await assert.rejects(
  () => request("/genres", "PATCH", { key, original: created, values: { label_ar: "stale" } }),
  /409/,
);
console.log("Stale writes rejected");
await request("/genres", "DELETE", { key, original: updated });
console.log("Deleted leaf record");
const audits = await request(
  "/audit_logs?filters=" +
    encodeURIComponent(JSON.stringify({ action: "local.delete", target_type: "genres" })),
);
const audit = audits.rows.find((r) => r.changes.before.id === created.id);
assert.ok(audit);
const restored = await request("/restore", "POST", { audit_id: audit.id });
assert.equal(restored.id, created.id);
assert.equal(restored.label_ar, "اختبار التعديل");
console.log("Restored same ID and values");
await assert.rejects(
  () => request("/titles", "DELETE", { key: { id: titles.rows[0].id }, original: titles.rows[0] }),
  /409/,
);
console.log("Linked records protected");
await assert.rejects(() => request("/auth_users", "POST", { values: { name: "test" } }), /403/);
console.log("Identity tables protected");
console.log("All disposable database checks passed");
