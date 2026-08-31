import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { database } from "../../database";

/**
 * Route-level coverage for `GET /api/v1/installments/:id/subtitles` (roadmap Phase 2). The
 * OpenSubtitles API itself is stubbed — what is under test here is id resolution (mirroring the
 * streams route) and the visibility guard.
 */

const fixture = JSON.stringify({
  data: [
    {
      attributes: {
        language: "ar",
        release: "Some.Release.1080p",
        download_count: 42,
        moviehash_match: true,
        files: [{ file_id: 111, file_name: "some.ar.srt" }],
      },
    },
    {
      attributes: {
        language: "en",
        release: null,
        download_count: 10,
        moviehash_match: false,
        files: [{ file_id: 222, file_name: "some.en.srt" }],
      },
    },
  ],
});

const suffix = randomUUID().slice(0, 8);
const titleIds: string[] = [];
const installments: Record<string, string> = {};
const episodes: Record<string, string> = {};

async function makeTitle(input: {
  key: string;
  imdbId?: string;
  films: Array<{ kind: "movie" | "season"; imdbId?: string }>;
}) {
  const sql = database().client;
  const name = `Subtitle Route Test ${input.key} ${suffix}`;
  const [title] = await sql`
    insert into titles (canonical_title, sort_title, imdb_id)
    values (${name}, ${name}, ${input.imdbId ?? null})
    returning id`;
  const titleId = String(title?.id);
  titleIds.push(titleId);

  let position = 0;
  for (const film of input.films) {
    const [row] = await sql`
      insert into installments (title_id, kind, position, title, imdb_id)
      values (${titleId}, ${film.kind}, ${position}, ${`${name} #${position}`}, ${film.imdbId ?? null})
      returning id`;
    installments[`${input.key}:${position}`] = String(row?.id);
    position += 1;
  }
  return titleId;
}

function stubOpenSubtitles(body = fixture) {
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
  await makeTitle({ key: "movie", films: [{ kind: "movie", imdbId: "tt0114369" }] });
  await makeTitle({ key: "season", imdbId: "tt0092455", films: [{ kind: "season" }] });
  const sql = database().client;
  const [episode] = await sql`
    insert into episodes (installment_id, number, position, title)
    values (${installments["season:0"] ?? ""}, 1, 0, 'Pilot')
    returning id`;
  episodes.pilot = String(episode?.id);

  // Same regression fixture as streams.test.ts: movie, season, movie, season — the second
  // season sits at position 3 but must resolve as season **2** (its rank among season-kind
  // siblings only). A single interspersed movie before it would leave position and rank
  // numerically equal by coincidence; two movies make the two schemes disagree unambiguously.
  await makeTitle({
    key: "multi-season",
    imdbId: "tt0126029",
    films: [{ kind: "movie" }, { kind: "season" }, { kind: "movie" }, { kind: "season" }],
  });
  const [secondSeasonEpisode] = await sql`
    insert into episodes (installment_id, number, position, title)
    values (${installments["multi-season:3"] ?? ""}, 6, 5, 'Episode 6')
    returning id`;
  episodes.secondSeason = String(secondSeasonEpisode?.id);
});

afterAll(async () => {
  const sql = database().client;
  if (titleIds.length) await sql`delete from titles where id in ${sql(titleIds)}`;
  await sql.end();
});

// A developer's own `.env` may legitimately set a real OPENSUBTITLES_API_KEY — cleared before
// every test too, not just after, so "no source configured" stays deterministic regardless of
// what's loaded into the process outside this suite's control.
beforeEach(() => {
  delete process.env.OPENSUBTITLES_API_KEY;
});
afterEach(() => {
  delete process.env.OPENSUBTITLES_API_KEY;
});

async function getSubtitles(installmentId: string, episodeId?: string) {
  const query = episodeId ? `?episodeId=${episodeId}` : "";
  const response = await app.request(`/api/v1/installments/${installmentId}/subtitles${query}`);
  return { status: response.status, body: await response.json() };
}

describe("installment subtitle discovery", () => {
  it("says so when no subtitle source is configured", async () => {
    const { status, body } = await getSubtitles(installments["movie:0"] ?? "");
    expect(status).toBe(503);
    expect(body.code).toBe("source_not_configured");
  });

  it("returns ranked candidates for a movie by its IMDb id", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const restore = stubOpenSubtitles();
    try {
      const { status, body } = await getSubtitles(installments["movie:0"] ?? "");
      expect(status).toBe(200);
      expect(body.candidates).toHaveLength(2);
      expect(body.candidates[0].matchedBy).toBe("hash");
    } finally {
      restore();
    }
  });

  it("requires an episode id for a season", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const { status, body } = await getSubtitles(installments["season:0"] ?? "");
    expect(status).toBe(400);
    expect(body.code).toBe("unsupported_kind");
  });

  it("resolves a series episode through the title's IMDb id", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const restore = stubOpenSubtitles();
    try {
      const { status, body } = await getSubtitles(installments["season:0"] ?? "", episodes.pilot);
      expect(status).toBe(200);
      expect(body.candidates).toHaveLength(2);
    } finally {
      restore();
    }
  });

  it("404s an installment that does not exist", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const { status, body } = await getSubtitles(randomUUID());
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
  });

  it("numbers a season by its rank among season-kind siblings, not its raw position", async () => {
    process.env.OPENSUBTITLES_API_KEY = "test-key";
    const original = globalThis.fetch;
    let requestedUrl = "";
    // SAFETY: the stub implements the one overload this test exercises (a single URL argument
    // returning a Response), which is all the route under test calls.
    globalThis.fetch = (async (url: string) => {
      requestedUrl = url;
      return new Response(fixture, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
    try {
      const { status } = await getSubtitles(
        installments["multi-season:3"] ?? "",
        episodes.secondSeason,
      );
      expect(status).toBe(200);
      expect(requestedUrl).toContain("season_number=2");
      expect(requestedUrl).toContain("episode_number=6");
    } finally {
      globalThis.fetch = original;
    }
  });
});
