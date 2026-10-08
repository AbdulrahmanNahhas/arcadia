import assert from "node:assert/strict";

import {
  SessionSchema,
  WorkPageSchema,
  WorkDetailSchema,
  CatalogFiltersSchema,
} from "../../../packages/api-contract/src/generated.ts";

const root = "http://127.0.0.1:23104";
const token = process.env.NAHHASIO_TEST_TOKEN;
if (!token)
  throw new Error("NAHHASIO_TEST_TOKEN is required for the disposable client test server");
async function request(path, schema) {
  const response = await fetch(root + path, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200, "authorized client request must succeed");
  const value = await response.json();
  schema.parse(value);
  return value;
}
assert.equal((await fetch(root + "/api/v1/works")).status, 401);
await request("/api/v1/auth/session", SessionSchema);
const page = await request("/api/v1/works?page=1&pageSize=2", WorkPageSchema);
assert.equal(page.page, 1);
assert.equal(page.pageSize, 2);
assert.equal(page.items.length, 2);
assert.equal(page.total, 223);
const second = await request("/api/v1/works?page=2&pageSize=2", WorkPageSchema);
assert.ok(page.items.every((item) => second.items.every((other) => other.id !== item.id)));
assert.equal((await request("/api/v1/works?q=%25%25%25%25", WorkPageSchema)).total, 0);
const beyondEnd = await request("/api/v1/works?page=100000&pageSize=2", WorkPageSchema);
assert.equal(beyondEnd.items.length, 0);
assert.equal(beyondEnd.total, page.total);
for (const query of [
  "pageSize=101",
  "page=0",
  "sort=bad",
  "yearFrom=2026&yearTo=2020",
  "page=abc",
  "unsupported=1",
]) {
  const response = await fetch(root + "/api/v1/works?" + query, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 400);
}
for (const sort of ["title", "year-desc", "year-asc", "updated-desc"])
  await request(`/api/v1/works?sort=${sort}&pageSize=2`, WorkPageSchema);
const filters = await request("/api/v1/catalog/filters", CatalogFiltersSchema);
if (filters.genres.length)
  await request(
    `/api/v1/works?genre=${encodeURIComponent(filters.genres[0].slug)}&format=animated&audience=general&yearFrom=1900&yearTo=9999`,
    WorkPageSchema,
  );
const samplePage = await request("/api/v1/works?pageSize=24", WorkPageSchema);
const selected = samplePage.items.find((item) => item.episodeCount > 0) ?? page.items[0];
const detail = await request(`/api/v1/works/${selected.id}`, WorkDetailSchema);
assert.equal(detail.id, selected.id);
const allEpisodes = detail.installments.flatMap((item) => item.episodes);
assert.equal(detail.episodeCount, allEpisodes.length);
assert.equal(detail.installmentCount, detail.installments.length);
const artwork = detail.artwork[0] ?? detail.poster;
if (process.env.NAHHASIO_TEST_REQUIRE_ARTWORK === "true")
  assert.ok(artwork, "strict artwork fixture must include a registered asset");
if (artwork) {
  assert.equal((await fetch(root + artwork.url)).status, 401);
  const response = await fetch(root + artwork.url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (process.env.NAHHASIO_TEST_REQUIRE_ARTWORK === "true")
    assert.equal(response.status, 200, "mounted registered artwork must be served");
  // A restore contains mappings but may not have its artwork mounted.
  assert.ok([200, 404].includes(response.status));
  if (response.status === 200) {
    assert.equal(response.headers.get("content-type"), artwork.mimeType);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
}
assert.equal(
  (
    await fetch(root + "/api/v1/works/../invalid", {
      headers: { authorization: `Bearer ${token}` },
    })
  ).status,
  404,
);
if (process.env.NAHHASIO_TEST_REVOKE === "1") {
  assert.equal(
    (
      await fetch(root + "/api/v1/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
    204,
  );
  assert.equal(
    (await fetch(root + "/api/v1/works", { headers: { authorization: `Bearer ${token}` } })).status,
    401,
  );
}
console.log(
  "Authorized client contract smoke passed: pagination, all sorts, filters, detail, artwork access and request boundaries.",
);
