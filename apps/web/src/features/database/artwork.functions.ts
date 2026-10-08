import { artworkSearchQuerySchema, artworkCandidateSchema } from "@arcadia/contracts";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { rowSchema, pageSchema } from "./database-model";
import { requireLocalAdmin, databaseRequest } from "./database.server";

export const searchArtwork = createServerFn({ method: "GET" })
  .inputValidator(artworkSearchQuerySchema)
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { searchArtworkDetailed: search } = await import("@arcadia/api/artwork");
    const result = await search(data);
    return {
      candidates: z.array(artworkCandidateSchema).parse(result.candidates),
      warnings: result.warnings,
    };
  });
export const getTmdbSeason = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ tmdbId: z.number().int().positive(), season: z.number().int().nonnegative() }),
  )
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { fetchTmdbSeason, tmdbConfigured } = await import("@arcadia/api/tmdb");
    if (!tmdbConfigured()) throw new Error("مفتاح TMDB غير مفعّل");
    return fetchTmdbSeason({ ...data, language: "ar-SA" });
  });
export const ingestArtwork = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      url: z.string().url(),
      role: z.enum(["poster", "banner", "logo"]),
      ownerName: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const host = new URL(data.url).hostname;
    if (!["image.tmdb.org", "assets.fanart.tv", "s4.anilist.co"].includes(host))
      throw new Error("مصدر الصورة غير مسموح");
    const { storeMediaFromUrl } = await import("@arcadia/api/media-storage");
    const stored = await storeMediaFromUrl({
      url: data.url,
      assetType: data.role,
      ownerName: data.ownerName,
    });
    const current = pageSchema.parse(
      await databaseRequest(
        `media_assets?filters=${encodeURIComponent(JSON.stringify({ sha256: stored.sha256 }))}`,
      ),
    );
    if (current.rows[0]) return current.rows[0];
    return rowSchema.parse(
      await databaseRequest(
        "media_assets",
        "POST",
        JSON.stringify({
          values: {
            path: stored.relativePath,
            sha256: stored.sha256,
            mime_type: stored.mimeType,
            byte_size: stored.byteSize,
            width: stored.width,
            height: stored.height,
            original_filename: stored.originalFilename,
          },
        }),
      ),
    );
  });

export const uploadArtwork = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      dataUrl: z.string().max(14000000),
      fileName: z.string().min(1).max(250),
      role: z.enum(["poster", "banner", "logo", "profile"]),
      ownerName: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { storeMedia } = await import("@arcadia/api/media-storage");
    const stored = await storeMedia({ ...data, assetType: data.role });
    const current = pageSchema.parse(
      await databaseRequest(
        `media_assets?filters=${encodeURIComponent(JSON.stringify({ sha256: stored.sha256 }))}`,
      ),
    );
    if (current.rows[0]) return current.rows[0];
    return rowSchema.parse(
      await databaseRequest(
        "media_assets",
        "POST",
        JSON.stringify({
          values: {
            path: stored.relativePath,
            sha256: stored.sha256,
            mime_type: stored.mimeType,
            byte_size: stored.byteSize,
            width: stored.width,
            height: stored.height,
            original_filename: stored.originalFilename,
          },
        }),
      ),
    );
  });
