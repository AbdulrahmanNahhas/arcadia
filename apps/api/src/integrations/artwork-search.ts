import type { artworkSearchQuerySchema } from "@arcadia/contracts";
import { titleFormatOf, titleStructureOf } from "@arcadia/domain";
import type { z } from "zod";
import { searchAniListArtwork } from "./anilist";
import { fetchFanartMovieArtwork } from "./fanart";
import { searchTmdbArtwork } from "./tmdb";

type Query = z.infer<typeof artworkSearchQuerySchema>;

/**
 * Runs the providers relevant to `kind` and returns their candidates, kind-preferred provider
 * first. Each provider call is best-effort — a missing key or a failed request just yields no
 * candidates from that provider rather than failing the whole search, since admins are visually
 * picking from whatever came back, not relying on any single source being present.
 *
 * The two halves of `kind` route independently: the movie/series half picks TMDB's `/movie` vs
 * `/tv` endpoint and decides whether Fanart (movies only) can be chained, while the
 * animated/live-action half decides whether AniList is worth asking at all. An absent `kind`
 * falls back to the animated-movie shape, matching the catalog's historical default.
 */
export async function searchArtwork(query: Query) {
  const kind = query.kind ?? "animated-movie";
  const isAnimated = titleFormatOf(kind) === "animated";
  const isMovie = titleStructureOf(kind) === "movie";

  const [tmdb, anilist] = await Promise.all([
    searchTmdbArtwork({
      title: query.title,
      year: query.year,
      role: query.role,
      mediaType: isMovie ? "movie" : "tv",
      tmdbId: query.tmdbId,
    }).catch(() => ({ candidates: [], matchedId: null })),
    isAnimated
      ? searchAniListArtwork({
          title: query.title,
          role: query.role,
          anilistId: query.anilistId,
        }).catch(() => ({
          candidates: [],
        }))
      : Promise.resolve({ candidates: [] }),
  ]);

  // Fanart only covers movies here (see fanart.ts) — chain it off a movie-shaped TMDB match.
  const fanart =
    isMovie && tmdb.matchedId
      ? await fetchFanartMovieArtwork({
          tmdbId: tmdb.matchedId,
          role: query.role,
          matchLabel: tmdb.candidates[0]?.matchLabel ?? query.title,
        }).catch(() => ({ candidates: [] }))
      : { candidates: [] };

  // AniList's art is the closest match for animation, so it leads when it was queried at all.
  return isAnimated
    ? [...anilist.candidates, ...tmdb.candidates, ...fanart.candidates]
    : [...tmdb.candidates, ...fanart.candidates];
}
