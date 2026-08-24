import type { artworkCandidateSchema } from "@arcadia/contracts";
import type { z } from "zod";

type ArtworkCandidate = z.infer<typeof artworkCandidateSchema>;

const endpoint = "https://graphql.anilist.co";

const query = `
  query ($search: String) {
    Media(search: $search, type: ANIME) {
      id
      title { romaji english }
      coverImage { extraLarge large }
      bannerImage
    }
  }
`;

type AniListResponse = {
  data: {
    Media: {
      id: number;
      title: { romaji: string | null; english: string | null };
      coverImage: { extraLarge: string | null; large: string | null };
      bannerImage: string | null;
    } | null;
  };
};

/**
 * AniList has no API key (public read access) and no separate preview/full-resolution pair per
 * image — one URL per field, used for both. It only ever contributes "poster" (coverImage) and
 * "banner" (bannerImage) candidates; it has no clear-logo concept, so role "logo" always returns
 * nothing here — Fanart or TMDB are the only logo sources.
 */
export async function searchAniListArtwork(input: {
  title: string;
  role: "poster" | "banner" | "logo";
}): Promise<{ candidates: ArtworkCandidate[] }> {
  if (input.role === "logo") return { candidates: [] };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { search: input.title } }),
  });
  if (!response.ok) return { candidates: [] };
  const body = (await response.json()) as AniListResponse;
  const media = body.data.Media;
  if (!media) return { candidates: [] };

  const label = media.title.english ?? media.title.romaji ?? input.title;
  const imageUrl =
    input.role === "poster"
      ? (media.coverImage.extraLarge ?? media.coverImage.large)
      : media.bannerImage;
  if (!imageUrl) return { candidates: [] };

  return {
    candidates: [
      {
        provider: "anilist",
        externalId: String(media.id),
        role: input.role,
        previewUrl: imageUrl,
        downloadUrl: imageUrl,
        width: null,
        height: null,
        language: null,
        matchLabel: label,
      },
    ],
  };
}
