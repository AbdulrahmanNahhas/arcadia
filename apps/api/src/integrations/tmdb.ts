import type { artworkCandidateSchema } from "@arcadia/contracts";
import type { z } from "zod";

type ArtworkCandidate = z.infer<typeof artworkCandidateSchema>;

const apiBase = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p";

function readAccessToken() {
  return process.env.TMDB_API_READ_ACCESS_KEY ?? null;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined>) {
  const token = readAccessToken();
  if (!token) return null;
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

type SearchResult = { id: number; title?: string; name?: string };
type SearchResponse = { results: SearchResult[] };
type ImagesResponse = {
  posters: TmdbImage[];
  backdrops: TmdbImage[];
  logos: TmdbImage[];
};
type TmdbImage = {
  file_path: string;
  width: number;
  height: number;
  iso_639_1: string | null;
};

/**
 * Finds the best-matching movie or TV title on TMDB and returns its poster/backdrop/logo
 * candidates for the requested role. Movies chain a Fanart.tv lookup by TMDB id (see fanart.ts);
 * TV/anime don't, since Fanart's TV endpoint needs a TheTVDB id, not a TMDB one — out of scope
 * for now (documented limitation, not a bug).
 *
 * When `tmdbId` is given (the title/installment already has a confirmed match — see the
 * player/torrent roadmap's Phase 0), this skips `/search/{mediaType}` and its "blindly take
 * `results[0]`" risk entirely, going straight to `/{mediaType}/{tmdbId}/images`. The search path
 * only runs for a row with no id yet.
 */
export async function searchTmdbArtwork(input: {
  title: string;
  year?: number;
  role: "poster" | "banner" | "logo";
  mediaType: "movie" | "tv";
  tmdbId?: number;
}): Promise<{ candidates: ArtworkCandidate[]; matchedId: number | null }> {
  let matchId: number;
  let label: string;
  if (input.tmdbId) {
    matchId = input.tmdbId;
    label = input.title;
  } else {
    const searchPath = input.mediaType === "movie" ? "/search/movie" : "/search/tv";
    const yearParam =
      input.mediaType === "movie" ? { year: input.year } : { first_air_date_year: input.year };
    const search = await tmdbFetch<SearchResponse>(searchPath, {
      query: input.title,
      ...yearParam,
    });
    const match = search?.results[0];
    if (!match) return { candidates: [], matchedId: null };
    matchId = match.id;
    label = match.title ?? match.name ?? input.title;
  }

  const images = await tmdbFetch<ImagesResponse>(`/${input.mediaType}/${matchId}/images`, {
    include_image_language: "en,ar,null",
  });
  if (!images) return { candidates: [], matchedId: matchId };

  const byRole: Record<typeof input.role, TmdbImage[]> = {
    poster: images.posters,
    banner: images.backdrops,
    logo: images.logos,
  };
  const candidates: ArtworkCandidate[] = byRole[input.role].slice(0, 12).map((image) => ({
    provider: "tmdb",
    externalId: String(matchId),
    role: input.role,
    previewUrl: `${imageBase}/w500${image.file_path}`,
    downloadUrl: `${imageBase}/original${image.file_path}`,
    width: image.width,
    height: image.height,
    language: image.iso_639_1,
    matchLabel: label,
  }));
  return { candidates, matchedId: matchId };
}
