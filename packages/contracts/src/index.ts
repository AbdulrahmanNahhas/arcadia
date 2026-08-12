import { ageSchema, audienceSchema, riskLevelSchema, taxonomySchema } from "@arcadia/domain";
import { z } from "zod";

export const installmentKindSchema = z.enum(["season", "movie", "special"]);
export const installmentStatusSchema = z.enum(["announced", "airing", "completed", "unknown"]);
/** A title lifecycle is derived from the factual status of its installments. */
export const titleReleaseStatusSchema = z.enum([
  "upcoming",
  "airing",
  "returning",
  "completed",
  "unknown",
]);
export const effectiveClassificationSchema = z.object({
  audience: audienceSchema,
  age: ageSchema,
  sexuality: riskLevelSchema,
  behavioral: riskLevelSchema,
  theology: riskLevelSchema,
});
export const scoreSchema = z.object({
  story: z.number().min(0).max(10).nullable(),
  characters: z.number().min(0).max(10).nullable(),
  depth: z.number().min(0).max(10).nullable(),
  worldBuilding: z.number().min(0).max(10).nullable(),
  originality: z.number().min(0).max(10).nullable(),
  craft: z.number().min(0).max(10).nullable(),
});
export const episodeSchema = z.object({
  id: z.string().uuid(),
  number: z.number(),
  position: z.number().int(),
  title: z.string().nullable(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
});
export const installmentSchema = z.object({
  id: z.string().uuid(),
  titleId: z.string().uuid(),
  kind: installmentKindSchema,
  position: z.number().int(),
  title: z.string(),
  summary: z.string(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  status: installmentStatusSchema,
  posterPath: z.string().nullable(),
  episodeCount: z.number().int().min(0).nullable(),
  classification: effectiveClassificationSchema,
  classificationOverrides: z.array(z.string()),
  score: scoreSchema,
  rating: z.number().nullable(),
  episodes: z.array(episodeSchema).optional(),
});
export const titleSummarySchema = z.object({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  kind: z.enum(["movie", "anime"]),
  titleAr: z.string().nullable(),
  summary: z.string(),
  posterPath: z.string().nullable(),
  bannerPath: z.string().nullable(),
  logoPath: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  releaseStatus: titleReleaseStatusSchema,
  isPrivate: z.boolean().optional(),
  aliases: z.array(z.string()),
  contentWarnings: z.string().nullable(),
  genres: z.array(taxonomySchema("genres")),
  tones: z.array(taxonomySchema("tones")),
  tags: z.array(taxonomySchema("tags")),
  planet: z
    .object({ id: z.string().uuid(), slug: z.string(), nameAr: z.string(), icon: z.string() })
    .nullable(),
  score: z.object({
    rating: z.number().nullable(),
    scored: z.number().int(),
    total: z.number().int(),
    components: scoreSchema,
  }),
  classifications: z.array(effectiveClassificationSchema),
  credits: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      kind: z.enum(["person", "organization"]),
      role: z.string(),
    }),
  ),
});
export const titleDetailSchema = titleSummarySchema.extend({
  analysisNotes: z.string().nullable(),
  installments: z.array(installmentSchema),
  relationships: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      titleId: z.string().uuid(),
      title: z.string(),
    }),
  ),
});
export const browseQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  mode: z.enum(["titles", "installments"]).default("titles"),
  genre: z.string().optional(),
  tone: z.string().optional(),
  tag: z.string().optional(),
  planet: z.string().optional(),
  sort: z.enum(["title", "release", "score"]).default("title"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
export const browseResponseSchema = z.object({
  items: z.array(z.union([titleSummarySchema, installmentSchema])),
  total: z.number().int(),
  mode: z.enum(["titles", "installments"]),
});
export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ready", "unavailable"]),
  version: z.literal("v2"),
});
export type TitleSummary = z.infer<typeof titleSummarySchema>;
export type TitleDetail = z.infer<typeof titleDetailSchema>;
export type Installment = z.infer<typeof installmentSchema>;
export type InstallmentStatus = z.infer<typeof installmentStatusSchema>;
export type TitleReleaseStatus = z.infer<typeof titleReleaseStatusSchema>;
export type BrowseResponse = z.infer<typeof browseResponseSchema>;
