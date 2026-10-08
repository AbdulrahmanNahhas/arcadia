import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { pageSchema, rowSchema } from "@/features/database/database-model";
import { databaseRequest } from "@/features/database/database.server";
const referenceTable = z.enum([
  "genres",
  "tags",
  "tones",
  "countries",
  "planets",
  "entities",
  "roles",
  "titles",
  "award_organizations",
  "award_categories",
  "award_ceremonies",
]);
export type ReferenceTable = z.infer<typeof referenceTable>;
export const findReferences = createServerFn({ method: "GET" })
  .validator(
    z.object({
      table: referenceTable,
      search: z.string().max(300),
      filters: rowSchema.default({}),
    }),
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      limit: "5",
      offset: "0",
      search: data.search,
      filters: JSON.stringify(data.filters),
    });
    const page = pageSchema.parse(await databaseRequest(`${data.table}?${params}`));
    const artwork = new Map<string, string>();
    if (data.table === "entities" && page.rows.length) {
      const { openDatabase } = await import("@arcadia/cli/db");
      const sql = openDatabase();
      const images = await sql<
        { entity_id: string; path: string }[]
      >`select distinct on (x.entity_id) x.entity_id, a.path from media_asset_assignments x join media_assets a on a.id = x.asset_id where x.entity_id in ${sql(page.rows.map((row) => z.string().uuid().parse(row.id)))} order by x.entity_id, x.is_primary desc, case x.role when 'profile' then 0 when 'logo' then 1 else 2 end, x.id`;
      for (const image of images) artwork.set(image.entity_id, image.path);
    }
    return page.rows.map((row) => ({
      id: z.string().uuid().parse(row.id),
      image: artwork.get(String(row.id)) ?? null,
      label: String(
        row.label_ar ??
          row.name_ar ??
          row.label ??
          row.name ??
          row.canonical_title ??
          row.slug ??
          row.year ??
          row.id,
      ),
      value: String(row.slug ?? row.name ?? row.canonical_title ?? row.id),
      organizationId: z
        .string()
        .uuid()
        .nullable()
        .parse(row.organization_id ?? null),
      year: z
        .number()
        .nullable()
        .parse(row.year ?? null),
      entityKind: z
        .enum(["person", "organization"])
        .nullable()
        .parse(row.entity_kind ?? row.kind ?? null),
    }));
  });
export type ReferenceOption = Awaited<ReturnType<typeof findReferences>>[number];
