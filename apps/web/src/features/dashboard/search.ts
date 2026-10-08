import { z } from "zod";

import { catalogSearchSchema } from "@/features/database/works-model";
export const dashboardSearch = catalogSearchSchema.extend({
  view: z.enum(["grid", "table", "list"]).optional(),
  q: z.string().max(300).optional(),
  offset: z.coerce.number().int().nonnegative().catch(0).optional(),
  table: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .optional(),
  work: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).optional(),
  section: z
    .enum(["identity", "structure", "indexing", "editorial", "images", "references", "awards"])
    .optional(),
});
