import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ApiClient,
  FavoriteRequestSchema,
  WatchedRequestSchema,
  WorkActivityPageSchema,
  WorkViewerStateSchema,
} from "../src/generated.ts";

const workId = "00112233-4455-4677-8899-aabbccddeeff";
const installmentId = "00112233-4455-4677-8899-aabbccddee01";
const episodeId = "00112233-4455-4677-8899-aabbccddee02";
const summary = {
  catalogUnits: 1,
  releasedUnits: 0,
  watchedReleasedUnits: 0,
  isFullyWatched: false,
  watchState: "in-progress",
};
const state = {
  workId,
  isFavorite: true,
  summary,
  installments: [{ installmentId, summary }],
  units: [
    {
      stateId: null,
      installmentId,
      episodeId,
      isReleased: false,
      positionSeconds: 23,
      durationSeconds: null,
      isPlayed: true,
      playedManually: true,
      playedAt: "2026-10-09T10:00:00Z",
      subtitleOffsetMs: -250,
      updatedAt: null,
    },
  ],
};
const activity = {
  workId,
  page: 1,
  pageSize: 20,
  total: 1,
  items: [
    {
      id: episodeId,
      kind: "comment",
      body: "<script>plain text, never HTML</script>",
      containsSpoilers: true,
      rating: null,
      parentId: null,
      author: { id: installmentId, displayName: "العائلة", avatarKey: "avatar-1.png" },
      createdAt: "2026-10-09T10:00:00Z",
      updatedAt: "2026-10-09T10:00:00Z",
    },
  ],
};

test("viewer contracts retain manual future choices and nullable unrecorded metadata", () => {
  const result = WorkViewerStateSchema.parse(state);
  assert.equal(result.units[0]?.isReleased, false);
  assert.equal(result.units[0]?.isPlayed, true);
  assert.equal(result.summary.isFullyWatched, false);
  assert.equal(result.units[0]?.subtitleOffsetMs, -250);
  assert.equal(result.units[0]?.durationSeconds, null);
  const empty = WorkViewerStateSchema.parse({
    workId,
    isFavorite: false,
    units: [],
    installments: [],
    summary: { ...summary, catalogUnits: 0, watchState: "unwatched" },
  });
  assert.equal(empty.units.length, 0);
  assert.throws(() => WorkViewerStateSchema.parse({ ...state, token: "secret" }));
  assert.throws(() =>
    WorkViewerStateSchema.parse({ ...state, summary: { ...summary, releasedUnits: -1 } }),
  );
});

test("mutation request shapes reject extra ownership/progress fields", () => {
  assert.deepEqual(FavoriteRequestSchema.parse({ isFavorite: false }), { isFavorite: false });
  assert.throws(() => FavoriteRequestSchema.parse({ isFavorite: true, notes: "erase" }));
  assert.deepEqual(
    WatchedRequestSchema.parse({ installmentId: null, episodeId: null, isPlayed: true }),
    {
      installmentId: null,
      episodeId: null,
      isPlayed: true,
    },
  );
  assert.throws(() =>
    WatchedRequestSchema.parse({ installmentId, episodeId, isPlayed: true, accountId: workId }),
  );
  assert.throws(() =>
    WatchedRequestSchema.parse({ installmentId, episodeId, isPlayed: true, positionSeconds: 999 }),
  );
});

test("discussion preserves spoilers, author and review rating with validated pagination", () => {
  const result = WorkActivityPageSchema.parse(activity);
  assert.equal(result.items[0]?.containsSpoilers, true);
  assert.equal(result.items[0]?.body, activity.items[0]?.body);
  assert.equal(result.items[0]?.author.displayName, "العائلة");
  WorkActivityPageSchema.parse({
    ...activity,
    items: [{ ...activity.items[0], kind: "review", rating: 4 }],
  });
  assert.throws(() => WorkActivityPageSchema.parse({ ...activity, page: 0 }));
  assert.throws(() =>
    WorkActivityPageSchema.parse({ ...activity, items: [{ ...activity.items[0], rating: 6 }] }),
  );
});

test("generated transport uses correct state paths, methods, bodies and native-independent bearer auth", async () => {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-only");
    requests.push({
      path,
      method: init?.method ?? "",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return Response.json(path.includes("/activity") ? activity : state);
  };
  try {
    const api = new ApiClient("http://127.0.0.1:23103/", () => "fixture-only");
    assert.equal((await api.getWorkState(workId)).workId, workId);
    await api.setFavorite(workId, { isFavorite: false });
    await api.setWatched(workId, { installmentId, episodeId, isPlayed: true });
    await api.getWorkActivity(workId, { page: 2 });
    assert.deepEqual(
      requests.map(({ path, method }) => [path, method]),
      [
        [`http://127.0.0.1:23103/api/v1/works/${workId}/state`, "GET"],
        [`http://127.0.0.1:23103/api/v1/works/${workId}/favorite`, "PUT"],
        [`http://127.0.0.1:23103/api/v1/works/${workId}/watched`, "PATCH"],
        [`http://127.0.0.1:23103/api/v1/works/${workId}/activity?page=2`, "GET"],
      ],
    );
    assert.deepEqual(requests[1]?.body, { isFavorite: false });
    assert.deepEqual(requests[2]?.body, { installmentId, episodeId, isPlayed: true });
    globalThis.fetch = async () => Response.json({ ...state, isFavorite: "not-a-boolean" });
    await assert.rejects(() => api.getWorkState(workId));
  } finally {
    globalThis.fetch = original;
  }
});
