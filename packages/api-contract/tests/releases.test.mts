import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiClient, ReleaseEntrySchema, ReleasesPageSchema } from "../src/generated.ts";
import type { ReleaseEntry, ReleasesPage } from "../src/generated.ts";

const id = "00112233-4455-4677-8899-aabbccddeeff";
const entry: ReleaseEntry = {
  id,
  workId: id,
  workTitle: "Recorded work",
  workTitleAr: null,
  installmentId: id,
  installmentTitle: null,
  installmentKind: "season",
  episodeNumber: "12.50",
  title: null,
  kind: "episode",
  releaseDate: null,
  status: "airing",
  runtimeMinutes: null,
  episodeCount: null,
  poster: null,
};
const page: ReleasesPage = {
  items: [entry],
  total: 1,
  page: 1,
  pageSize: 24,
  years: [2025, 2026],
  days: [],
  asOf: "2026-10-11",
};

test("release contracts preserve unknown dates, decimal episode numbers and nullable metadata", () => {
  assert.deepEqual(ReleasesPageSchema.parse(page), page);
  assert.equal(ReleaseEntrySchema.parse(entry).episodeNumber, "12.50");
  const installment = ReleaseEntrySchema.parse({
    ...entry,
    kind: "installment",
    episodeNumber: null,
    releaseDate: "2026-10-01",
    episodeCount: 0,
  });
  assert.equal(installment.episodeCount, 0);
  assert.equal(installment.releaseDate, "2026-10-01");
});

test("release contracts reject invalid dates, enums, pagination and unexpected private fields", () => {
  for (const patch of [
    { kind: "movie" },
    { releaseDate: "2026-10-01T00:00:00Z" },
    { releaseDate: "2026-02-30" },
    { episodeNumber: 12.5 },
    { episodeCount: -1 },
    { storagePath: "/private" },
  ]) {
    assert.throws(() => ReleaseEntrySchema.parse({ ...entry, ...patch }));
  }
  for (const patch of [
    { page: 0 },
    { page: 100001 },
    { pageSize: 101 },
    { total: -1 },
    { years: [0] },
    { years: [10000] },
    { asOf: "2026-13-01" },
    { days: [{ date: "2026-02-30", count: 1 }] },
    { days: [{ date: "2026-10-11T00:00:00Z", count: 1 }] },
    { days: [{ date: "2026-10-11", count: 0 }] },
    { days: [{ date: "2026-10-11", count: -1 }] },
    { days: [{ date: "2026-10-11", count: 1.5 }] },
    { days: [{ date: "2026-10-11", count: 1, privateCount: 1 }] },
    { days: undefined },
    { token: "secret" },
  ]) {
    assert.throws(() => ReleasesPageSchema.parse({ ...page, ...patch }));
  }
});

test("calendar overview and selected-day replies retain pre-pagination counts", async () => {
  const original = globalThis.fetch;
  const days = [
    { date: "2026-10-11", count: 150 },
    { date: "2026-10-12", count: 250 },
  ];
  globalThis.fetch = async (input) => {
    const query = new URL(String(input)).searchParams;
    assert.equal(query.get("month"), "10");
    assert.equal(query.get("pageSize"), "1");
    const selectedDay = query.get("day");
    assert.ok(selectedDay === null || selectedDay === "11");
    return new Response(
      JSON.stringify({
        ...page,
        items: [{ ...entry, releaseDate: "2026-10-11" }],
        total: selectedDay ? 150 : 400,
        page: Number(query.get("page") ?? 1),
        pageSize: 1,
        days: selectedDay ? days.slice(0, 1) : days,
      }),
    );
  };
  try {
    const client = new ApiClient("http://127.0.0.1:23103", () => "fixture-only-token");
    const overview = await client.getReleases({ year: 2026, month: 10, pageSize: 1 });
    assert.equal(overview.items.length, 1);
    assert.deepEqual(overview.days, days);
    assert.equal(
      overview.days.reduce((sum, day) => sum + day.count, 0),
      overview.total,
    );
    const selected = await client.getReleases({
      year: 2026,
      month: 10,
      day: 11,
      page: 2,
      pageSize: 1,
    });
    assert.equal(selected.page, 2);
    assert.deepEqual(selected.days, days.slice(0, 1));
    assert.equal(selected.days[0]?.count, selected.total);
    assert.equal(selected.items.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("generated releases client sends typed GET query with Bearer header and cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const calls: { url: string; method: string | undefined }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url: url.pathname + url.search, method: init?.method });
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-only-token");
    assert.equal(url.searchParams.has("token"), false);
    assert.equal(init?.body, undefined);
    if (calls.length === 1) {
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        year: "2026",
        month: "10",
        day: "11",
        kind: "episodes",
        scope: "year",
        page: "2",
        pageSize: "100",
      });
      assert.equal(init?.signal, controller.signal);
    }
    return new Response(JSON.stringify({ ...page, page: calls.length === 1 ? 2 : 1 }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const client = new ApiClient("http://127.0.0.1:23103", () => "fixture-only-token");
    assert.equal(
      (
        await client.getReleases(
          {
            year: 2026,
            month: 10,
            day: 11,
            kind: "episodes",
            scope: "year",
            page: 2,
            pageSize: 100,
          },
          controller.signal,
        )
      ).page,
      2,
    );
    assert.deepEqual(await client.getReleases(), page);
    assert.equal(calls[0]?.method, "GET");
    assert.deepEqual(calls[1], { url: "/api/v1/releases", method: "GET" });
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ...page, items: [{ ...entry, kind: "unknown" }] }));
    await assert.rejects(() => client.getReleases({ scope: "undated" }));
    globalThis.fetch = async () => new Response("{}", { status: 401 });
    await assert.rejects(() => client.getReleases({ scope: "upcoming" }), /401/);
  } finally {
    globalThis.fetch = original;
  }
});
