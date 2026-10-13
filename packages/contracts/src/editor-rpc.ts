import { z } from "zod";

import { artworkSearchQuerySchema, artworkCandidateSchema } from "./index";
import { workDocument } from "./work-document";
export const editorTables = [
  "genres",
  "tones",
  "tags",
  "countries",
  "planets",
  "entities",
  "roles",
  "titles",
  "award_organizations",
  "award_categories",
  "award_ceremonies",
  "media_assets",
] as const;
export const jsonRow = z.record(z.string(), z.json());
export const snapshotSchema = z.object({ document: workDocument, revision: z.string() });
export const reviewSchema = z.object({
  ticket: z.string(),
  expiresAt: z.number(),
  records: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      changes: z.array(
        z.object({ path: z.string(), before: z.json().nullable(), after: z.json().nullable() }),
      ),
    }),
  ),
});
export const originalSchema = z.object({ id: z.string().uuid(), revision: z.string().length(64) });
export const rpcInputs = {
  read: z.strictObject({ ids: z.array(z.string().uuid()).min(1).max(30) }),
  review: z.strictObject({
    json: z.string().max(4000000),
    originals: z.array(originalSchema).min(1).max(30),
  }),
  save: z.strictObject({ ticket: z.string().max(8000000) }),
  create: z.strictObject({ json: z.string().max(4000000) }),
  parse: z.strictObject({ json: z.string().max(4000000) }),
  links: z.strictObject({ workId: z.string().uuid(), episodeId: z.string().uuid() }),
  refs: z.strictObject({
    table: z.enum(editorTables),
    search: z.string().max(300),
    offset: z.number().int().min(0).max(1000000).default(0),
    filters: jsonRow.default({}),
  }),
  schema: z.strictObject({}),
  vocabulary: z.strictObject({
    tables: z.array(z.enum(["genres", "tones", "tags", "countries", "planets", "roles"])).max(6),
  }),
  media: z.strictObject({ path: z.string().startsWith("/media/").max(1000) }),
  search: artworkSearchQuerySchema,
  season: z.strictObject({
    tmdbId: z.number().int().positive(),
    season: z.number().int().nonnegative(),
  }),
  ingest: z.strictObject({
    url: z.string().url(),
    role: z.enum(["poster", "banner", "logo"]),
    ownerName: z.string().min(1).max(200),
  }),
  upload: z.strictObject({
    dataUrl: z.string().max(14000000),
    fileName: z.string().min(1).max(250),
    role: z.enum(["poster", "banner", "logo", "profile"]),
    ownerName: z.string().min(1).max(200),
  }),
  preview: z.strictObject({ url: z.string().url() }),
};
export const tableSchema = z.object({
  name: z.string(),
  writable: z.boolean(),
  columns: z.array(
    z.object({
      name: z.string(),
      data_type: z.string(),
      nullable: z.boolean(),
      primary: z.boolean(),
      generated: z.boolean(),
      default_value: z.string().nullable(),
      enum_values: z.array(z.string()),
    }),
  ),
});
export const rpcResults = {
  read: z.array(snapshotSchema),
  review: reviewSchema,
  save: z.object({ saved: z.number(), createdId: z.string().nullable() }),
  create: reviewSchema,
  parse: workDocument,
  links: z.array(z.object({ table: z.string(), count: z.number() })),
  refs: z.object({ rows: z.array(jsonRow), offset: z.number(), total: z.number() }),
  schema: z.array(tableSchema),
  vocabulary: z.array(
    z.object({
      table: z.string(),
      options: z.array(z.object({ value: z.string(), label: z.string() })),
    }),
  ),
  media: z.object({ id: z.string().uuid() }),
  search: z.object({ candidates: z.array(artworkCandidateSchema), warnings: z.array(z.string()) }),
  season: z.json(),
  ingest: z.object({ id: z.string().uuid(), path: z.string() }),
  upload: z.object({ id: z.string().uuid(), path: z.string() }),
  preview: z.object({ dataUrl: z.string() }),
};
