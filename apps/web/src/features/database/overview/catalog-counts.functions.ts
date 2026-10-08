import { createServerFn } from "@tanstack/react-start";

import { requireLocalAdmin } from "@/features/database/data/database.server";

export const getCatalogCounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireLocalAdmin();
  const { loadCatalogCounts } = await import("@/features/database/overview/catalog-counts.server");
  return loadCatalogCounts();
});
