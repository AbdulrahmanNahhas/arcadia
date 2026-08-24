import type { artworkSearchQuerySchema } from "@arcadia/contracts";
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
 */
export async function searchArtwork(query: Query) {
  const isAnime = query.kind === "anime";
  const tmdbMediaType = isAnime ? "tv" : "movie";

  const [tmdb, anilist] = await Promise.all([
    searchTmdbArtwork({
      title: query.title,
      year: query.year,
      role: query.role,
      mediaType: tmdbMediaType,
    }).catch(() => ({ candidates: [], matchedId: null })),
    isAnime
      ? searchAniListArtwork({ title: query.title, role: query.role }).catch(() => ({
          candidates: [],
        }))
      : Promise.resolve({ candidates: [] }),
  ]);

  // Fanart only covers movies here (see fanart.ts) — chain it off a movie-shaped TMDB match.
  const fanart =
    !isAnime && tmdb.matchedId
      ? await fetchFanartMovieArtwork({
          tmdbId: tmdb.matchedId,
          role: query.role,
          matchLabel: tmdb.candidates[0]?.matchLabel ?? query.title,
        }).catch(() => ({ candidates: [] }))
      : { candidates: [] };

  return isAnime
    ? [...anilist.candidates, ...tmdb.candidates, ...fanart.candidates]
    : [...tmdb.candidates, ...fanart.candidates, ...anilist.candidates];
}
