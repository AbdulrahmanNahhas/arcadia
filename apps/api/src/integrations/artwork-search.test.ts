import { afterEach, describe, expect, it, vi } from "vitest";

import { searchArtworkDetailed } from "./artwork-search";

const image = { file_path: "/oshi.jpg", width: 1000, height: 1500, iso_639_1: "ja" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("season artwork search", () => {
  it("falls back to labeled series posters when TMDB has no such season", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture");
    vi.stubEnv("FANART_API_KEY", "");
    const requests: string[] = [];
    let anilistVariables: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        requests.push(String(url));
        if (String(url).includes("graphql.anilist.co")) {
          anilistVariables = JSON.parse(String(init?.body)).variables;
          return Response.json({ data: { Page: { media: [] } } });
        }
        if (String(url).includes("/season/3/")) return new Response(null, { status: 404 });
        return Response.json({ posters: [image], backdrops: [], logos: [] });
      }),
    );
    const result = await searchArtworkDetailed({
      title: "Oshi No Ko الموسم الثالث",
      seriesTitle: "Oshi No Ko",
      kind: "animated-series",
      role: "poster",
      tmdbId: 203737,
      season: 3,
    });
    expect(anilistVariables).toEqual({ search: "Oshi No Ko" });
    expect(requests.some((url) => url.includes("/tv/203737/season/3/images"))).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.matchLabel).toContain("لا تتوفر ملصقات الموسم 3");
    expect(result.warnings.some((message) => message.startsWith("TMDB:"))).toBe(false);
  });

  it("uses saved season AniList IDs and retains TMDB posters from every language", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture");
    vi.stubEnv("FANART_API_KEY", "");
    let anilistVariables: unknown;
    const imageRequests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        if (String(url).includes("graphql.anilist.co")) {
          anilistVariables = JSON.parse(String(init?.body)).variables;
          return Response.json({
            data: {
              Media: {
                id: 999,
                title: { english: "Oshi No Ko Season 3", romaji: null },
                coverImage: { extraLarge: "https://s4.anilist.co/season3.jpg", large: null },
                bannerImage: null,
              },
            },
          });
        }
        imageRequests.push(String(url));
        return Response.json({ posters: [image], backdrops: [], logos: [] });
      }),
    );
    const result = await searchArtworkDetailed({
      title: "Oshi No Ko Season 3",
      kind: "animated-series",
      role: "poster",
      tmdbId: 203737,
      anilistId: 999,
      season: 3,
    });
    expect(anilistVariables).toEqual({ id: 999 });
    expect(
      imageRequests.every((url) => !new URL(url).searchParams.has("include_image_language")),
    ).toBe(true);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.externalId).toBe("999");
  });
});
