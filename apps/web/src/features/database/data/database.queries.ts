import { queryOptions } from "@tanstack/react-query";

import type { DatabaseRow } from "@/features/database/data/database-model";
import { getDatabaseRecords, getDatabaseSchema } from "@/features/database/data/database.functions";

export const databaseKeys = {
  all: ["database"] as const,
  schema: ["database", "schema"] as const,
  records: (table: string) => ["database", "records", table] as const,
};
export const databaseSchemaOptions = () =>
  queryOptions({
    queryKey: databaseKeys.schema,
    queryFn: () => getDatabaseSchema(),
    staleTime: 60000,
  });
export const databaseRecordsOptions = (
  table: string,
  offset = 0,
  search = "",
  filters: DatabaseRow = {},
) =>
  queryOptions({
    queryKey: [...databaseKeys.records(table), { offset, search, filters }],
    queryFn: ({ signal }) =>
      getDatabaseRecords({ data: { table, offset, search, filters }, signal }),
  });
