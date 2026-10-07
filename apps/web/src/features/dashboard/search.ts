import { z } from "zod";
export const dashboardSearch = z.object({
  q: z.string().max(300).optional(),
  offset: z.coerce.number().int().nonnegative().catch(0).optional(),
  table: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .optional(),
  work: z.string().uuid().optional(),
});
