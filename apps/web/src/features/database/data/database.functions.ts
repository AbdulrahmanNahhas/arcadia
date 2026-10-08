import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { worksInputSchema, worksPageSchema } from "@/features/catalog/works/works-model";
import type { DatabaseRow } from "@/features/database/data/database-model";
import {
  mutationInput,
  pageInput,
  pageSchema,
  rowSchema,
  tableSchema,
} from "@/features/database/data/database-model";
import { databaseRequest } from "@/features/database/data/database.server";

export const getDatabaseSchema = createServerFn({ method: "GET" }).handler(async () =>
  z.array(tableSchema).parse(await databaseRequest("schema")),
);
export const getDatabaseRecords = createServerFn({ method: "GET" })
  .validator(pageInput)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      offset: String(data.offset),
      limit: "50",
      search: data.search,
      filters: JSON.stringify(data.filters),
    });
    return pageSchema.parse(await databaseRequest(`${data.table}?${params}`));
  });
export const mutateDatabaseRecord = createServerFn({ method: "POST" })
  .validator(mutationInput)
  .handler(async ({ data }) =>
    rowSchema.parse(
      await databaseRequest(
        data.table,
        data.operation === "create" ? "POST" : data.operation === "update" ? "PATCH" : "DELETE",
        JSON.stringify(data),
      ),
    ),
  );
export const restoreDatabaseRecord = createServerFn({ method: "POST" })
  .validator(z.object({ audit_id: z.string().uuid() }))
  .handler(async ({ data }) =>
    rowSchema.parse(await databaseRequest("restore", "POST", JSON.stringify(data))),
  );

function catalogParams(data: z.infer<typeof worksInputSchema>, limit: number) {
  const filters: DatabaseRow = {};
  if (data.format) filters.format = data.format;
  if (data.workflow) filters.workflow_status = data.workflow;
  if (data.visibility) filters.is_private = data.visibility === "private";
  const params = new URLSearchParams({
    offset: String(data.offset),
    limit: String(limit),
    search: data.search,
    catalog: "true",
    sort: data.sort ?? "title",
    filters: JSON.stringify(filters),
  });
  if (data.structure) params.set("structure", data.structure);
  if (data.gap) params.set("gap", data.gap);
  return params;
}
export const getWorksPage = createServerFn({ method: "GET" })
  .validator(worksInputSchema)
  .handler(async ({ data }) => {
    const page = worksPageSchema.parse(await databaseRequest(`titles?${catalogParams(data, 30)}`));
    const { getTitleScores } = await import("@/features/scoring/score.server");
    const scores = await getTitleScores(page.items.map(({ work }) => work.id));
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        work: { ...item.work, catalog: { ...item.work.catalog, score: scores.get(item.work.id) } },
      })),
    };
  });

// Resolve selection only on explicit intent; browsing still loads 30 works at a time.
export const getWorksSelection = createServerFn({ method: "GET" })
  .validator(worksInputSchema.omit({ offset: true }))
  .handler(async ({ data }) => {
    const ids = new Set<string>();
    let offset = 0;
    while (true) {
      const page = worksPageSchema.parse(
        await databaseRequest(`titles?${catalogParams({ ...data, offset }, 100)}`),
      );
      for (const { work } of page.items) ids.add(work.id);
      offset += page.items.length;
      if (page.items.length === 0 || offset >= page.total) break;
    }
    return [...ids];
  });
