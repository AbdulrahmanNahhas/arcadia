import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { mutationInput, pageInput, pageSchema, rowSchema, tableSchema } from "./database-model";
import { databaseRequest } from "./database.server";

export const getDatabaseSchema = createServerFn({ method: "GET" }).handler(async () =>
  z.array(tableSchema).parse(await databaseRequest("schema")),
);
export const getDatabaseRecords = createServerFn({ method: "GET" })
  .inputValidator(pageInput)
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      offset: String(data.offset),
      limit: "30",
      search: data.search,
      filters: JSON.stringify(data.filters),
    });
    return pageSchema.parse(await databaseRequest(`${data.table}?${params}`));
  });
export const mutateDatabaseRecord = createServerFn({ method: "POST" })
  .inputValidator(mutationInput)
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
  .inputValidator(z.object({ audit_id: z.string().uuid() }))
  .handler(async ({ data }) =>
    rowSchema.parse(await databaseRequest("restore", "POST", JSON.stringify(data))),
  );
