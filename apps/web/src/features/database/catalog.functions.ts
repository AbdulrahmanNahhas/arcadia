import { createServerFn } from "@tanstack/react-start";

import {
  catalogDetailInputSchema,
  catalogPageInputSchema,
  changeCatalogContributionInputSchema,
  movePlanetWorksInputSchema,
} from "./catalog-model";
import { requireLocalAdmin } from "./database.server";

export const getCatalogPage = createServerFn({ method: "GET" })
  .inputValidator(catalogPageInputSchema)
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { loadCatalogPage } = await import("./catalog.server");
    return loadCatalogPage(data);
  });

export const getCatalogDetail = createServerFn({ method: "GET" })
  .inputValidator(catalogDetailInputSchema)
  .handler(async ({ data }) => {
    requireLocalAdmin();
    const { loadCatalogDetail } = await import("./catalog.server");
    return loadCatalogDetail(data);
  });

export const movePlanetWorks = createServerFn({ method: "POST" })
  .inputValidator(movePlanetWorksInputSchema)
  .handler(async ({ data }) => {
    requireLocalAdmin();
    requireLocalWriteToken();
    const { transferPlanetWorks } = await import("./catalog.server");
    return transferPlanetWorks(data);
  });

export const changeCatalogContribution = createServerFn({ method: "POST" })
  .inputValidator(changeCatalogContributionInputSchema)
  .handler(async ({ data }) => {
    requireLocalAdmin();
    requireLocalWriteToken();
    const { changeCatalogContribution: change } = await import("./catalog.server");
    return change(data);
  });

function requireLocalWriteToken() {
  if (!process.env.NAHHASIO_LOCAL_ADMIN_TOKEN)
    throw new Error("إعداد الإدارة المحلية غير مكتمل؛ يلزم رمز الكتابة الخاص بالخادم.");
}
