import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";
import { clearStreamCache } from "../../integrations/torrent-source";

/**
 * Route-level coverage for `GET /api/v1/installments/:id/streams` (roadmap Phase 1.5). The addon
 * itself is stubbed — what is under test here is id resolution, the visibility guard, and the
 * promise that every failure mode gets its own code instead of a spinner that never resolves.
 */

const fixture = readFileSync(
  join(import.meta.dirname, "../../integrations/torrent-source.fixture.json"),
  "utf8",
);

const suffix = randomUUID().slice(0, 8);
const titleIds: string[] = [];
const installments: Record<string, string> = {};

async function makeTitle(input: {
  key: string;
  imdbId?: string;
  isPrivate?: boolean;
  films: Array<{ kind: "movie" | "special" | "season"; imdbId?: string; tmdbId?: number }>;
}) {
  const sql = database().client;
  const name = `Stream Route Test ${input.key} ${suffix}`;
  const [title] = await sql`
    insert into titles (canonical_title, sort_title, imdb_id, is_private)
    values (${name}, ${name}, ${input.imdbId ?? null}, ${input.isPrivate ?? false})
    returning id`;
  const titleId = String(title?.id);
  titleIds.push(titleId);

  let position = 0;
  for (const film of input.films) {
    const [row] = await sql`
      insert into installments (title_id, kind, position, title, imdb_id, tmdb_id)
      values (${titleId}, ${film.kind}, ${position}, ${`${name} #${position}`},
        ${film.imdbId ?? null}, ${film.tmdbId ?? null})
      returning id`;
    installments[`${input.key}:${position}`] = String(row?.id);
    position += 1;
  }
  return titleId;
}

function stubAddon(body = fixture) {
  const original = globalThis.fetch;
  // SAFETY: the stub implements the one overload these tests exercise (a single URL argument
  // returning a Response), which is all the route under test calls.
  globalThis.fetch = (async () =>
    new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

beforeAll(async () => {
  // Its own IMDb id on the installment — the path Phase 0.5 backfilled the catalog for.
  await makeTitle({ key: "own-id", films: [{ kind: "movie", imdbId: "tt0133093" }] });
  // No id on the single film, but the parent title carries one.
  await makeTitle({ key: "title-id", imdbId: "tt0111161", films: [{ kind: "movie" }] });
  // Two films under one title: the title's id names a different work, so it must not be borrowed.
  await makeTitle({
    key: "collection",
    imdbId: "tt0088763",
    films: [{ kind: "movie" }, { kind: "movie" }],
  });
  // TMDB only — gated behind the flag until the family addon is confirmed to accept `tmdb:` ids.
  await makeTitle({ key: "tmdb-only", films: [{ kind: "movie", tmdbId: 603 }] });
  await makeTitle({ key: "season", films: [{ kind: "season" }] });
  await makeTitle({
    key: "private",
    isPrivate: true,
    films: [{ kind: "movie", imdbId: "tt0109830" }],
  });
});

afterAll(async () => {
  const sql = database().client;
  if (titleIds.length) await sql`delete from titles where id in ${sql(titleIds)}`;
  await sql.end();
});

afterEach(() => {
  clearStreamCache();
  delete process.env.ARCADIA_STREAM_ADDON_URL;
  delete process.env.ARCADIA_STREAM_ALLOW_TMDB_IDS;
});

async function getStreams(installmentId: string) {
  const response = await app.request(`/api/v1/installments/${installmentId}/streams`);
  return { status: response.status, body: await response.json() };
}

describe("installment stream discovery", () => {
  it("returns ranked candidates for an installment carrying its own IMDb id", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const { status, body } = await getStreams(installments["own-id:0"] ?? "");
      expect(status).toBe(200);
      expect(body.streamId).toBe("tt0133093");
      expect(body.idSource).toBe("installment.imdb");
      expect(body.candidates.length).toBeGreaterThan(0);
      expect(body.candidates[0].kind).toBe("direct");
    } finally {
      restore();
    }
  });

  it("falls back to the title's id only when the title holds exactly one film", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const single = await getStreams(installments["title-id:0"] ?? "");
      expect(single.status).toBe(200);
      expect(single.body.streamId).toBe("tt0111161");
      expect(single.body.idSource).toBe("title.imdb");

      // Two films under the collection: borrowing the title's id would play the wrong movie.
      const collection = await getStreams(installments["collection:0"] ?? "");
      expect(collection.status).toBe(409);
      expect(collection.body.code).toBe("no_identifier");
    } finally {
      restore();
    }
  });

  it("keeps tmdb: ids behind the flag until the addon is known to accept them", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const gated = await getStreams(installments["tmdb-only:0"] ?? "");
      expect(gated.status).toBe(409);
      expect(gated.body.code).toBe("no_identifier");

      process.env.ARCADIA_STREAM_ALLOW_TMDB_IDS = "true";
      const allowed = await getStreams(installments["tmdb-only:0"] ?? "");
      expect(allowed.status).toBe(200);
      expect(allowed.body.streamId).toBe("tmdb:603");
      expect(allowed.body.idSource).toBe("installment.tmdb");
    } finally {
      restore();
    }
  });

  it("refuses a season with its own code rather than pretending to search", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const { status, body } = await getStreams(installments["season:0"] ?? "");
    expect(status).toBe(400);
    expect(body.code).toBe("unsupported_kind");
  });

  it("says so when no stream source is configured at all", async () => {
    const { status, body } = await getStreams(installments["own-id:0"] ?? "");
    expect(status).toBe(503);
    expect(body.code).toBe("source_not_configured");
  });

  it("reports an unreachable addon as a source failure, not as an empty result", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise (a single URL argument),
    // which is all the code under test calls.
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof globalThis.fetch;
    try {
      const { status, body } = await getStreams(installments["own-id:0"] ?? "");
      expect(status).toBe(502);
      expect(body.code).toBe("source_unavailable");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("distinguishes an addon with nothing to offer from an addon that failed", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon(JSON.stringify({ streams: [] }));
    try {
      const { status, body } = await getStreams(installments["own-id:0"] ?? "");
      expect(status).toBe(200);
      expect(body.candidates).toEqual([]);
    } finally {
      restore();
    }
  });

  it("does not resolve a stream for a private title", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const { status, body } = await getStreams(installments["private:0"] ?? "");
      expect(status).toBe(404);
      expect(body.code).toBe("not_found");
    } finally {
      restore();
    }
  });

  it("404s an installment that does not exist", async () => {
    process.env.ARCADIA_STREAM_ADDON_URL = "https://addon.test";
    const { status, body } = await getStreams(randomUUID());
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
  });
});
