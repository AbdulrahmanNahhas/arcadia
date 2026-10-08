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

/** Movie artwork is resolved using the TMDB movie ID. */
export async function fetchFanartMovieArtwork(input: {
  tmdbId: number;
  role: "poster" | "banner" | "logo";
  matchLabel: string;
}): Promise<{ candidates: ArtworkCandidate[] }> {
  const apiKey = readApiKey();
  if (!apiKey) return { candidates: [] };
  const response = await fetch(
    `https://webservice.fanart.tv/v3/movies/${input.tmdbId}?api_key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (response.status === 404) return { candidates: [] };
  if (!response.ok) throw new Error("تعذّر الاتصال بـ Fanart. راجع مفتاح المصدر.");
  // SAFETY: Fanart's movie endpoint responds with an object keyed by art-type slugs (or omits a
  // key entirely when it has no art of that type); FanartMovieResponse models exactly that shape.
  const body = (await response.json()) as FanartMovieResponse;

  const images =
    input.role === "logo"
      ? (body.hdmovielogo ?? body.movielogo ?? [])
      : input.role === "banner"
        ? (body.moviebackground ?? [])
        : (body.movieposter ?? []);

  const candidates: ArtworkCandidate[] = images.slice(0, 100).map((image) => ({
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

export function fanartConfigured() {
  return readApiKey() !== null;
}
