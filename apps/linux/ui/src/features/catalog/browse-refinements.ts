import type { BrowseFilters, CatalogEntry } from "@nahhasio/api-contract";

import type { CatalogQuery } from "../../lib/bridge";
import { criteria, emptyFilters, filterCount, optionLabel } from "./filter-model";

export const sortChoices = [
  { value: "year-desc", label: "الأحدث إصدارًا", description: "الإصدارات الأحدث أولًا" },
  { value: "year-asc", label: "الأقدم إصدارًا", description: "من البداية إلى اليوم" },
  { value: "score-desc", label: "الأعلى تقييمًا", description: "حسب تقييم المكتبة المحسوب" },
  { value: "title", label: "الاسم", description: "ترتيب أبجدي للعناوين" },
  { value: "updated-desc", label: "آخر تحديث", description: "الأعمال التي تغيّرت مؤخرًا" },
  { value: "added-desc", label: "آخر إضافة", description: "الأعمال الأحدث في المكتبة" },
] as const;
export const groupChoices = [
  { value: "none", label: "بلا تجميع" },
  { value: "year", label: "سنة الإصدار" },
  { value: "format", label: "الصيغة" },
  { value: "audience", label: "الجمهور" },
  { value: "status", label: "حالة الإصدار" },
] as const;
export type SortOrder = (typeof sortChoices)[number]["value"];
export type BrowseGroup = (typeof groupChoices)[number]["value"];
export type BrowseRefinements = {
  filters: BrowseFilters;
  privacy: "public" | "all" | "private";
  from: string;
  to: string;
  sort: SortOrder;
  group: BrowseGroup;
};
export type LockedFacet = { key: string; value: string };

export function parseSort(value: string | null): SortOrder {
  return sortChoices.find((item) => item.value === value)?.value ?? "year-desc";
}
export function parseGroup(value: string | null): BrowseGroup {
  return groupChoices.find((item) => item.value === value)?.value ?? "none";
}
export function withPreset(filters: BrowseFilters, locked?: LockedFacet): BrowseFilters {
  if (!locked) return filters;
  const previous = filters.facets.find((facet) => facet.key === locked.key) ?? {
    key: locked.key,
    include: [],
    exclude: [],
  };
  return {
    ...filters,
    facets: [
      ...filters.facets.filter((facet) => facet.key !== locked.key),
      {
        ...previous,
        include: [...previous.include.filter((value) => value !== locked.value), locked.value],
        exclude: previous.exclude.filter((value) => value !== locked.value),
      },
    ],
  };
}
export function resetRefinements(locked?: LockedFacet): BrowseRefinements {
  return {
    filters: withPreset(emptyFilters(), locked),
    privacy: "public",
    from: "",
    to: "",
    sort: "year-desc",
    group: "none",
  };
}
export function yearError(from: string, to: string) {
  if ([from, to].some((value) => value !== "" && (!/^\d{1,4}$/.test(value) || Number(value) < 1)))
    return "أدخل سنة صحيحة بين 1 و9999.";
  if (from && to && Number(from) > Number(to)) return "سنة البداية يجب ألا تكون بعد سنة النهاية.";
  return null;
}
export function refinementCount(value: BrowseRefinements, locked?: LockedFacet) {
  return (
    filterCount(value.filters) -
    Number(Boolean(locked)) +
    Number(value.privacy !== "public") +
    Number(Boolean(value.from)) +
    Number(Boolean(value.to))
  );
}
export function refinementQuery(
  value: BrowseRefinements,
  view: "works" | "installments",
  q: string,
): CatalogQuery {
  return {
    view,
    q: q || undefined,
    privacy: value.privacy,
    sort: value.sort,
    filters: JSON.stringify(value.filters),
    yearFrom: value.from ? Number(value.from) : undefined,
    yearTo: value.to ? Number(value.to) : undefined,
  };
}
export function removeFacet(filters: BrowseFilters, key: string, value: string) {
  return {
    ...filters,
    facets: filters.facets
      .map((facet) =>
        facet.key === key
          ? {
              ...facet,
              include: facet.include.filter((item) => item !== value),
              exclude: facet.exclude.filter((item) => item !== value),
            }
          : facet,
      )
      .filter((facet) => facet.include.length || facet.exclude.length),
  };
}
export function groupLabel(value: BrowseGroup, item: CatalogEntry) {
  if (value === "year")
    return String(
      item.installment
        ? (item.installment.releaseDate?.slice(0, 4) ?? "غير معروف")
        : (item.work.releaseYear ?? "غير معروف"),
    );
  if (value === "format") return item.work.format === "animated" ? "رسوم متحركة" : "تمثيل حي";
  if (value === "audience")
    return optionLabel(item.classification.audience, item.classification.audience);
  if (value === "status") return optionLabel(item.status, "غير معروف");
  return "all";
}

export function scoreLabel(key: string) {
  return criteria.find((criterion) => criterion.key === key)?.label ?? key;
}
