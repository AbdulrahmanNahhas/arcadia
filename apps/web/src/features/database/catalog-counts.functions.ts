import { createServerFn } from "@tanstack/react-start";

import { requireLocalAdmin } from "./database.server";

export const getCatalogCounts = createServerFn({ method: "GET" }).handler(async () => {
  requireLocalAdmin();
  const { loadCatalogCounts } = await import("./catalog-counts.server");
  return loadCatalogCounts();
});
