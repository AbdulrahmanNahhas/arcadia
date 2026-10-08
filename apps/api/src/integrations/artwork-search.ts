import type { artworkSearchQuerySchema } from "@arcadia/contracts";
import { titleFormatOf, titleStructureOf } from "@arcadia/domain";
import type { z } from "zod";

import { searchAniListArtwork } from "./anilist";
import { fetchFanartMovieArtwork, fanartConfigured } from "./fanart";
import { searchTmdbArtwork, tmdbConfigured } from "./tmdb";

type Query = z.infer<typeof artworkSearchQuerySchema>;

/**
 * Runs the providers relevant to `kind` and returns their candidates, kind-preferred provider
 * first. Each provider call is best-effort — a missing key or a failed request just yields no
 * candidates from that provider rather than failing the whole search, since admins are visually
 * picking from whatever came back, not relying on any single source being present.
 *
 * The two halves of `kind` route independently: the movie/series half picks TMDB's `/movie` vs
 * `/tv` endpoint and whether Fanart movie artwork is available, while the
 * animated/live-action half decides whether AniList is worth asking at all. An absent `kind`
 * falls back to the animated-movie shape, matching the catalog's historical default.
 */
export async function searchArtworkDetailed(query: Query) {
  const warnings: string[] = [];
  if (!tmdbConfigured()) warnings.push("TMDB: مفتاح المصدر غير مفعّل.");
  if (query.kind?.endsWith("movie") !== false && !fanartConfigured())
    warnings.push("Fanart: مفتاح المصدر غير مفعّل.");
  function failed(provider: string) {
    warnings.push(`${provider}: تعذّر جلب الصور. أعد المحاولة أو راجع إعدادات المصدر.`);
    return { candidates: [], matchedId: null };
  }
  const kind = query.kind ?? "animated-movie";
  const isAnimated = titleFormatOf(kind) === "animated";
  const isMovie = titleStructureOf(kind) === "movie";

  const [tmdb, anilist] = await Promise.all([
    searchTmdbArtwork({
      title: isMovie ? query.title : (query.seriesTitle ?? query.title),
      year: isMovie ? query.year : undefined,
      role: query.role,
      mediaType: isMovie ? "movie" : "tv",
      tmdbId: query.tmdbId,
      season: query.season,
    }).catch(() => failed("TMDB")),
    isAnimated
      ? searchAniListArtwork({
          title: query.seriesTitle ?? query.title,
          role: query.role,
          anilistId: query.anilistId,
        }).catch(() => failed("AniList"))
      : Promise.resolve({ candidates: [] }),
  ]);

  // Fanart contributes movie artwork using the TMDB match.
  const fanart =
    isMovie && tmdb.matchedId
      ? await fetchFanartMovieArtwork({
          tmdbId: tmdb.matchedId,
          role: query.role,
          matchLabel: tmdb.candidates[0]?.matchLabel ?? query.title,
        }).catch(() => failed("Fanart"))
      : { candidates: [] };

  const candidates = isAnimated
    ? [...anilist.candidates, ...tmdb.candidates, ...fanart.candidates]
    : [...tmdb.candidates, ...fanart.candidates];
  return {
    candidates: [
      ...new Map(candidates.map((candidate) => [candidate.downloadUrl, candidate])).values(),
    ],
    warnings,
  };
}

export async function searchArtwork(query: Query) {
  return (await searchArtworkDetailed(query)).candidates;
}
