import { z } from "zod";

import { workScoreSchema } from "@/features/scoring/score-model";

import { rowSchema, tableSchema } from "./database-model";

export const workflowLabels = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
};
export const workflowSchema = z.enum(["draft", "in_review", "approved", "published", "archived"]);
export const catalogSearchSchema = z.object({
  structure: z.enum(["movie", "series"]).optional().catch(undefined),
  format: z.enum(["animated", "live-action"]).optional().catch(undefined),
  workflow: workflowSchema.optional().catch(undefined),
  visibility: z.enum(["public", "private"]).optional().catch(undefined),
  gap: z.enum(["poster", "summary", "arabic-name", "structure"]).optional().catch(undefined),
  sort: z.enum(["title", "year-desc", "year-asc", "updated"]).optional().catch(undefined),
  size: z.coerce.number().int().min(1).max(4).optional().catch(undefined),
  density: z.enum(["comfortable", "compact"]).optional().catch(undefined),
});
export type CatalogSearch = z.infer<typeof catalogSearchSchema>;
export const worksInputSchema = catalogSearchSchema.omit({ density: true, size: true }).extend({
  offset: z.number().int().nonnegative().default(0),
  search: z.string().max(300).default(""),
});
export const catalogWorkSchema = z.object({
  id: z.string().uuid(),
  canonical_title: z.string(),
  title_ar: z.string().nullable(),
  summary: z.string(),
  release_year: z.number().nullable(),
  format: z.enum(["animated", "live-action"]),
  workflow_status: workflowSchema,
  is_private: z.boolean(),
  catalog: z.object({
    score: workScoreSchema.optional(),
    poster: z.string().nullable(),
    is_series: z.boolean(),
    installments: z.number().int().nonnegative(),
    episodes: z.number().int().nonnegative(),
  }),
});
export type CatalogWork = z.infer<typeof catalogWorkSchema>;
export const worksPageSchema = z
  .object({
    table: tableSchema,
    rows: z.array(rowSchema),
    total: z.number(),
    offset: z.number(),
  })
  .transform((page) => ({
    ...page,
    items: page.rows.map((row) => ({ work: catalogWorkSchema.parse(row), row })),
  }));
export function workName(work: CatalogWork) {
  return work.title_ar?.trim() || work.canonical_title;
}
export function workFormat(work: CatalogWork) {
  return work.format === "animated" ? "رسوم متحركة" : "تمثيل حي";
}
export function workStructure(work: CatalogWork) {
  return work.catalog.installments === 0 ? "بلا أجزاء" : work.catalog.is_series ? "مسلسل" : "فيلم";
}
