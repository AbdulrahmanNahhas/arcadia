import type { WorkDocument } from "@arcadia/cli/work";
import { describe, expect, it } from "vitest";

import {
  artworkContext,
  hasSeries,
  identityKeys,
  identityLink,
  installmentIdentityKeys,
} from "@/features/editor/artwork/artwork-model";

const anime: WorkDocument = {
  canonicalTitle: "Anime",
  format: "animated",
  tmdbId: 20,
  anilistId: 40,
  installments: [
    { id: "first", kind: "season", title: "Season 1", position: 1 },
    { id: "second", kind: "season", title: "Season 2", position: 2, anilistId: 41 },
    { id: "movie", kind: "movie", title: "Movie", position: 3, tmdbId: 100, anilistId: 101 },
  ],
};
describe("artwork identity ownership", () => {
  it("keeps title series IDs separate from movie IDs", () => {
    expect(hasSeries(anime)).toBe(true);
    expect(artworkContext(anime)).toMatchObject({
      kind: "animated-series",
      tmdbId: 20,
      anilistId: undefined,
    });
    expect(artworkContext(anime, anime.installments![2]!)).toMatchObject({
      kind: "animated-movie",
      tmdbId: 100,
      anilistId: 101,
      season: undefined,
    });
    expect(
      artworkContext(anime, { kind: "movie", title: "Unmatched", position: 4 }).tmdbId,
    ).toBeUndefined();
  });
  it("uses series IDs for seasons and each anime season's own AniList ID", () => {
    expect(artworkContext(anime, anime.installments![1])).toMatchObject({
      kind: "animated-series",
      tmdbId: 20,
      anilistId: 41,
      season: 2,
    });
    expect(
      artworkContext(anime, { id: "third", kind: "season", title: "Season 3", position: 3 })
        .anilistId,
    ).toBeUndefined();
    expect(installmentIdentityKeys(anime, anime.installments![0]!)).toEqual(["anilistId", "malId"]);
    expect(installmentIdentityKeys(anime, anime.installments![2]!)).toEqual(identityKeys);
    expect(
      installmentIdentityKeys({ ...anime, format: "live-action" }, anime.installments![2]!),
    ).toEqual(["tmdbId", "imdbId"]);
    expect(
      installmentIdentityKeys({ ...anime, format: "live-action" }, anime.installments![0]!),
    ).toEqual([]);
  });
  it("finds movie-only title artwork using the first movie's IDs", () => {
    const films: WorkDocument = {
      canonicalTitle: "Films",
      format: "live-action",
      tmdbId: 999,
      installments: [{ kind: "movie", title: "First film", position: 1, tmdbId: 7 }],
    };
    expect(hasSeries(films)).toBe(false);
    expect(artworkContext(films)).toMatchObject({ kind: "live-action-movie", tmdbId: 999 });
    expect(
      artworkContext({ canonicalTitle: "No parts", format: "animated" }).tmdbId,
    ).toBeUndefined();
  });
  it("qualifies a generic season name with its work and uses title IDs as fallback", () => {
    const part = { id: "third", kind: "season" as const, title: "Season 3", position: 3 };
    const work = { ...anime, installments: [...anime.installments!, part] };
    const context = artworkContext(work, part);
    expect(context).toMatchObject({
      title: "Anime Season 3",
      seriesTitle: "Anime",
      season: 3,
      tmdbId: 20,
      anilistId: undefined,
    });
    expect(
      artworkContext(anime, { kind: "season", title: "Anime Season 3", position: 3 }).title,
    ).toBe("Anime Season 3");
  });
  it("maps zero-based catalog sort positions to provider season numbers", () => {
    const parts = [0, 1, 2].map((position) => ({
      id: String(position),
      kind: "season" as const,
      title: `الموسم ${position + 1}`,
      position,
    }));
    expect(artworkContext({ ...anime, installments: parts }, parts[2]).season).toBe(3);
  });
  it("builds preview links from the current draft IDs", () => {
    expect(identityLink("tmdbId", 20, true)).toBe("https://www.themoviedb.org/tv/20");
    expect(identityLink("tmdbId", 100, false)).toBe("https://www.themoviedb.org/movie/100");
    expect(identityLink("imdbId", "tt123", false)).toBe("https://www.imdb.com/title/tt123/");
    expect(identityLink("anilistId", 41, true)).toBe("https://anilist.co/anime/41");
    expect(identityLink("malId", null, true)).toBeNull();
  });
});
