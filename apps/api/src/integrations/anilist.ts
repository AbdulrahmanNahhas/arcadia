import type { artworkCandidateSchema } from "@arcadia/contracts";
import { z } from "zod";

type ArtworkCandidate = z.infer<typeof artworkCandidateSchema>;

const endpoint = "https://graphql.anilist.co";

const mediaFields = `id title { romaji english } coverImage { extraLarge large } bannerImage`;
const searchByTitleQuery = `query ($search: String) {
  Page(page: 1, perPage: 8) { media(search: $search, type: ANIME) { ${mediaFields} } }
}`;
const searchByIdQuery = `query ($id: Int) {
  Media(id: $id, type: ANIME) { ${mediaFields} }
}`;
const mediaSchema = z.object({
  id: z.number().int(),
  title: z.object({ romaji: z.string().nullable(), english: z.string().nullable() }),
  coverImage: z.object({ extraLarge: z.string().nullable(), large: z.string().nullable() }),
  bannerImage: z.string().nullable(),
});
const responseSchema = z.object({
  data: z.object({
    Media: mediaSchema.nullable().optional(),
    Page: z.object({ media: z.array(mediaSchema) }).optional(),
  }),
});

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * AniList has no API key (public read access) and no separate preview/full-resolution pair per
 * image — one URL per field, used for both. It only ever contributes "poster" (coverImage) and
 * "banner" (bannerImage) candidates; it has no clear-logo concept, so role "logo" always returns
 * nothing here — Fanart or TMDB are the only logo sources.
 *
 * When `anilistId` is given (a confirmed match already on the title/installment), this queries
 * `Media(id:)` directly instead of `Media(search:)` — AniList ids anime per season/movie, not per
 * franchise, so this matters most for exactly the entries (a franchise's later seasons and
 * spin-off films) a title-only text search is likeliest to mismatch.
 */
export async function searchAniListArtwork(input: {
  title: string;
  role: "poster" | "banner" | "logo";
  anilistId?: number;
}): Promise<{ candidates: ArtworkCandidate[] }> {
  if (input.role === "logo") return { candidates: [] };
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      input.anilistId
        ? { query: searchByIdQuery, variables: { id: input.anilistId } }
        : { query: searchByTitleQuery, variables: { search: input.title } },
    ),
  });
  if (!response.ok) throw new Error("تعذّر الاتصال بـ AniList.");
  const body = responseSchema.parse(await response.json());
  const matches = input.anilistId
    ? body.data.Media
      ? [body.data.Media]
      : []
    : (body.data.Page?.media ?? []);
  // Fuzzy provider search can include unrelated titles; keep only full-name matches.
  const name = normalized(input.title);
  const relevant = input.anilistId
    ? matches
    : matches.filter((media) =>
        [media.title.english, media.title.romaji].some(
          (title) => title && ` ${normalized(title)} `.includes(` ${name} `),
        ),
      );
  return {
    candidates: relevant.flatMap((media): ArtworkCandidate[] => {
      const imageUrl =
        input.role === "poster"
          ? (media.coverImage.extraLarge ?? media.coverImage.large)
          : media.bannerImage;
      if (!imageUrl) return [];
      return [
        {
          provider: "anilist",
          externalId: String(media.id),
          role: input.role,
          previewUrl: imageUrl,
          downloadUrl: imageUrl,
          width: null,
          height: null,
          language: null,
          matchLabel: media.title.english ?? media.title.romaji ?? input.title,
        },
      ];
    }),
  };
}
