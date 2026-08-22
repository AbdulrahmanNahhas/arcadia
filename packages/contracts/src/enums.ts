import { z } from "zod";

/**
 * Small, dependency-free enum/shape primitives shared by both the read-side schemas
 * (`index.ts`) and the write-side admin schemas (`admin-catalog.ts`). Kept in their own
 * leaf module so neither of those two files has to import from the other — `index.ts`
 * re-exports these unchanged, `admin-catalog.ts` imports them directly. This is the single
 * source of truth for these values; do not redeclare them elsewhere.
 */

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
export const awardResultSchema = z.enum(["winner", "nominee"]);
export const workflowStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
]);
export const scoreSchema = z.object({
  story: z.number().min(0).max(10).nullable(),
  characters: z.number().min(0).max(10).nullable(),
  depth: z.number().min(0).max(10).nullable(),
  worldBuilding: z.number().min(0).max(10).nullable(),
  originality: z.number().min(0).max(10).nullable(),
  craft: z.number().min(0).max(10).nullable(),
});
