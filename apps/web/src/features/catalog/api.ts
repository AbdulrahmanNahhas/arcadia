import { queryOptions } from "@tanstack/react-query";
import { getWorks } from "@/server/library.functions";
import {
  getAdminPlatformCatalogInstallments,
  getAdminPlatformCatalogWorks,
  getPlatformCatalogInstallments,
  getPlatformCatalogWorks,
} from "@/server/platform.functions";

/**
 * The whole-catalog reads the desk browse/awards/compare pages still make (their facets need
 * every title). Keyed once and cached for a session (D2a): navigating between those pages used
 * to download the catalog again each time, since each page keyed and fetched on its own.
 * Display Mode and Home never use these — they page through `/api/v1/titles`.
 */
const CATALOG_STALE_MS = 5 * 60_000;

export const catalogKeys = {
  all: ["catalog"] as const,
  titles: () => [...catalogKeys.all, "titles"] as const,
  installments: () => [...catalogKeys.all, "installments"] as const,
  adminTitles: () => [...catalogKeys.all, "admin", "titles"] as const,
  adminInstallments: () => [...catalogKeys.all, "admin", "installments"] as const,
  works: () => [...catalogKeys.all, "works"] as const,
};

export const catalogTitlesQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.titles(),
    queryFn: () => getPlatformCatalogWorks(),
    staleTime: CATALOG_STALE_MS,
  });
export const catalogInstallmentsQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.installments(),
    queryFn: () => getPlatformCatalogInstallments(),
    staleTime: CATALOG_STALE_MS,
  });
export const adminCatalogTitlesQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.adminTitles(),
    queryFn: getAdminPlatformCatalogWorks,
    staleTime: CATALOG_STALE_MS,
  });
export const adminCatalogInstallmentsQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.adminInstallments(),
    queryFn: getAdminPlatformCatalogInstallments,
    staleTime: CATALOG_STALE_MS,
  });
/** The v1-shaped `Work[]` list awards/compare still read. */
export const worksQueryOptions = () =>
  queryOptions({
    queryKey: catalogKeys.works(),
    queryFn: () => getWorks(),
    staleTime: CATALOG_STALE_MS,
  });
