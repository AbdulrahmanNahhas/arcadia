import { openDatabase } from "@arcadia/cli/db";
import { z } from "zod";

const catalogCountsSchema = z
  .object({
    works: z.number().int().nonnegative(),
    people: z.number().int().nonnegative(),
    studios: z.number().int().nonnegative(),
    planets: z.number().int().nonnegative(),
    mediaAssets: z.number().int().nonnegative(),
  })
  .strict();

const rowListSchema = z.array(z.record(z.string(), z.unknown()));

export async function loadCatalogCounts() {
  const sql = openDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    const rows = rowListSchema.parse(
      await transaction`
      select
        (select count(*)::integer from titles) as works,
        (select count(*)::integer from entities where kind = 'person') as people,
        (select count(*)::integer from entities where kind = 'organization') as studios,
        (select count(*)::integer from planets) as planets,
        (select count(*)::integer from media_assets) as "mediaAssets"
    `,
    );
    const row = rows[0];
    if (!row) throw new Error("تعذّر تحميل أعداد المكتبة.");
    return catalogCountsSchema.parse(row);
  });
}
