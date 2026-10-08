import { createServerFn } from "@tanstack/react-start";

import {
  catalogDetailInputSchema,
  catalogPageInputSchema,
  changeCatalogContributionInputSchema,
  movePlanetWorksInputSchema,
} from "@/features/catalog/entities/catalog-model";
import { requireLocalAdmin } from "@/features/database/data/database.server";

export const getCatalogPage = createServerFn({ method: "GET" })
  .validator(catalogPageInputSchema)
  .handler(async ({ data }) => {
    await requireLocalAdmin();
    const { loadCatalogPage } = await import("@/features/catalog/entities/catalog.server");
    return loadCatalogPage(data);
  });

export const getCatalogDetail = createServerFn({ method: "GET" })
  .validator(catalogDetailInputSchema)
  .handler(async ({ data }) => {
    await requireLocalAdmin();
    const { loadCatalogDetail } = await import("@/features/catalog/entities/catalog.server");
    return loadCatalogDetail(data);
  });

export const movePlanetWorks = createServerFn({ method: "POST" })
  .validator(movePlanetWorksInputSchema)
  .handler(async ({ data }) => {
    await requireLocalAdmin();
    requireLocalWriteToken();
    const { transferPlanetWorks } = await import("@/features/catalog/entities/catalog.server");
    return transferPlanetWorks(data);
  });

export const changeCatalogContribution = createServerFn({ method: "POST" })
  .validator(changeCatalogContributionInputSchema)
  .handler(async ({ data }) => {
    await requireLocalAdmin();
    requireLocalWriteToken();
    const { changeCatalogContribution: change } =
      await import("@/features/catalog/entities/catalog.server");
    return change(data);
  });

function requireLocalWriteToken() {
  if (!process.env.NAHHASIO_LOCAL_ADMIN_TOKEN)
    throw new Error("إعداد الإدارة المحلية غير مكتمل؛ يلزم رمز الكتابة الخاص بالخادم.");
}
