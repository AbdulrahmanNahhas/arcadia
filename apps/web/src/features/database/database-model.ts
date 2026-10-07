import { z } from "zod";

export const rowSchema = z.record(z.string(), z.json());
export type DatabaseRow = z.infer<typeof rowSchema>;
export const columnSchema = z.object({
  name: z.string(),
  data_type: z.string(),
  nullable: z.boolean(),
  primary: z.boolean(),
  generated: z.boolean(),
  default_value: z.string().nullable(),
  enum_values: z.array(z.string()),
});
export const tableSchema = z.object({
  name: z.string(),
  columns: z.array(columnSchema),
  writable: z.boolean(),
});
export type DatabaseTable = z.infer<typeof tableSchema>;
export const pageSchema = z.object({
  table: tableSchema,
  rows: z.array(rowSchema),
  total: z.number(),
  offset: z.number(),
});
const tableNameSchema = z.string().regex(/^[a-z_][a-z0-9_]*$/);
export const pageInput = z.object({
  table: tableNameSchema,
  offset: z.number().int().nonnegative().default(0),
  search: z.string().max(300).default(""),
  filters: rowSchema.default({}),
});
export const mutationInput = z.object({
  table: tableNameSchema,
  operation: z.enum(["create", "update", "delete"]),
  values: rowSchema.default({}),
  key: rowSchema.default({}),
  original: rowSchema.optional(),
});
