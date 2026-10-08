import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { pageSchema } from "@/features/database/database-model";
import { databaseRequest } from "@/features/database/database.server";

export const jsonVocabularySchema = z.enum([
  "genres",
  "tones",
  "tags",
  "countries",
  "planets",
  "roles",
]);
export type JsonVocabulary = z.infer<typeof jsonVocabularySchema>;

export const getJsonVocabulary = createServerFn({ method: "GET" })
  .inputValidator(z.object({ tables: z.array(jsonVocabularySchema).max(6) }))
  .handler(async ({ data }) =>
    Promise.all(
      [...new Set(data.tables)].map(async (table) => {
        const options: Array<{ value: string; label: string }> = [];
        let offset = 0;
        while (true) {
          const params = new URLSearchParams({
            offset: String(offset),
            limit: "100",
            search: "",
            filters: "{}",
          });
          const page = pageSchema.parse(await databaseRequest(`${table}?${params}`));
          for (const row of page.rows) {
            const value = z.string().parse(row.slug);
            const label = z
              .string()
              .parse(row.label_ar ?? row.name_ar ?? row.label ?? row.name ?? value);
            options.push({ value, label });
          }
          offset += page.rows.length;
          if (!page.rows.length || offset >= page.total) break;
        }
        return {
          table,
          options: options.toSorted((left, right) => left.label.localeCompare(right.label, "ar")),
        };
      }),
    ),
  );
