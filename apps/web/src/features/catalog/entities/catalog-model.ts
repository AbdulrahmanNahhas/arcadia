import { z } from "zod";

import { rowSchema } from "@/features/database/data/database-model";
import { workScoreSchema } from "@/features/scoring/score-model";

export const catalogKindSchema = z.enum(["people", "studios", "planets"]);
export type CatalogKind = z.infer<typeof catalogKindSchema>;

export const catalogPageInputSchema = z.object({
  kind: catalogKindSchema,
  offset: z.number().int().min(0).default(0),
  search: z.string().max(300).default(""),
  sort: z.enum(["name", "related", "updated"]).default("name"),
  imageFilter: z.enum(["all", "with-image", "without-image"]).default("all"),
  planetFilter: z.enum(["all", "active", "inactive"]).default("all"),
});
export const catalogDetailInputSchema = catalogPageInputSchema.extend({
  id: z.string().uuid(),
});
export const movePlanetWorksInputSchema = z.object({
  sourcePlanetId: z.string().uuid(),
  targetPlanetId: z.string().uuid(),
  originals: z
    .array(
      z.object({
        titleId: z.string().uuid(),
        featuredRank: z.number().int().nonnegative().nullable(),
      }),
    )
    .min(1)
    .max(200),
});
export const changeCatalogContributionInputSchema = z.object({
  original: z.object({
    title_id: z.string().uuid(),
    entity_id: z.string().uuid(),
    role_id: z.string().uuid(),
    position: z.number().int().nonnegative(),
    is_primary: z.boolean(),
  }),
  roleId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
});
export const changeCatalogContributionResultSchema = z.object({ row: rowSchema });

const relatedItemSchema = z.object({
  row: rowSchema,
  titleId: z.string().uuid(),
  title: z.string(),
  image: z.string().nullable(),
  score: workScoreSchema,
  roleLabel: z.string().optional(),
});
const imageItemSchema = z.object({ row: rowSchema, path: z.string() });
const relationItemSchema = z.object({
  row: rowSchema,
  sourceName: z.string(),
  targetName: z.string(),
});

export const catalogPageSchema = z.object({
  items: z.array(
    z.object({ row: rowSchema, image: z.string().nullable(), relatedCount: z.number().int() }),
  ),
  total: z.number().int(),
  offset: z.number().int(),
});
export const catalogDetailSchema = z.object({
  row: rowSchema,
  aliases: z.array(rowSchema),
  members: z.array(relatedItemSchema),
  memberTotal: z.number().int(),
  images: z.array(imageItemSchema),
  relations: z.array(relationItemSchema),
  offset: z.number().int(),
});
export const movePlanetWorksResultSchema = z.object({ moved: z.number().int().nonnegative() });

export type CatalogPage = z.infer<typeof catalogPageSchema>;
export type CatalogDetail = z.infer<typeof catalogDetailSchema>;
