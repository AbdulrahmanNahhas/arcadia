import type { artworkCandidateSchema } from "@arcadia/contracts";
import type { z } from "zod";

type ArtworkCandidate = z.infer<typeof artworkCandidateSchema>;

type FanartImage = { id: string; url: string; lang: string };
type FanartMovieResponse = Partial<
  Record<"hdmovielogo" | "movielogo" | "moviebackground" | "movieposter", FanartImage[]>
>;

function readApiKey() {
  return process.env.FANART_API_KEY ?? null;
}

/**
 * Fanart.tv's movie endpoint is keyed directly by TMDB movie id — its TV endpoint needs a
 * TheTVDB id instead, which nothing else here resolves, so this only ever runs for movie-shaped
 * matches (see tmdb.ts). Fanart specializes in transparent "clearlogo" art, which is the main
 * reason to call it at all — TMDB's own logo coverage is inconsistent.
 */
export async function fetchFanartMovieArtwork(input: {
  tmdbId: number;
  role: "poster" | "banner" | "logo";
  matchLabel: string;
}): Promise<{ candidates: ArtworkCandidate[] }> {
  const apiKey = readApiKey();
  if (!apiKey) return { candidates: [] };
  const response = await fetch(
    `https://webservice.fanart.tv/v3/movies/${input.tmdbId}?api_key=${apiKey}`,
  );
  if (!response.ok) return { candidates: [] };
  const body = (await response.json()) as FanartMovieResponse;

  const images =
    input.role === "logo"
      ? (body.hdmovielogo ?? body.movielogo ?? [])
      : input.role === "banner"
        ? (body.moviebackground ?? [])
        : (body.movieposter ?? []);

  const candidates: ArtworkCandidate[] = images.slice(0, 12).map((image) => ({
    provider: "fanart",
    externalId: image.id,
    role: input.role,
    previewUrl: image.url,
    downloadUrl: image.url,
    width: null,
    height: null,
    language: image.lang || null,
    matchLabel: input.matchLabel,
  }));
  return { candidates };
}
