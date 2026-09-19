import type { Work } from "@/features/library/model";
import { type CatalogGap, catalogGaps, workHasGap } from "./catalog-gaps";

/**
 * The admin catalog's whole state, as URL search params — filters, sort and view — so a list is
 * shareable, the browser's back button works, and the last used view is restored from
 * `localStorage` when the page is opened bare (`rememberCatalogView`).
 */
export const catalogSorts = [
  "title",
  "year-desc",
  "year-asc",
  "rating-desc",
  "rating-asc",
] as const;
export type CatalogSort = (typeof catalogSorts)[number];
export const catalogSortLabels = {
  title: "الاسم",
  "year-desc": "الأحدث إصداراً",
  "year-asc": "الأقدم إصداراً",
  "rating-desc": "الأعلى تقييماً",
  "rating-asc": "الأدنى تقييماً",
} satisfies Record<CatalogSort, string>;

export const catalogStructures = ["movie", "series"] as const;
export const catalogFormats = ["animated", "live-action"] as const;
export const catalogVisibilities = ["public", "private"] as const;
export const catalogWorkflows = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
] as const;

export interface CatalogView {
  q?: string;
  view?: "table" | "grid";
  sort?: CatalogSort;
  structure?: (typeof catalogStructures)[number];
  format?: (typeof catalogFormats)[number];
  visibility?: (typeof catalogVisibilities)[number];
  workflow?: (typeof catalogWorkflows)[number];
  planet?: string;
  gap?: CatalogGap;
}

const storageKey = "arcadia:admin-catalog-view";

export function rememberCatalogView(view: CatalogView) {
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(view));
  } catch {
    // Storage disabled: the URL still carries the state for this session.
  }
}

export function recallCatalogView(): CatalogView | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey);
    if (!raw) return null;
    const parsed: CatalogView = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function isEmptyView(view: CatalogView) {
  return Object.values(view).every((value) => value === undefined || value === "");
}

export function countActiveFilters(view: CatalogView) {
  return [
    view.q,
    view.structure,
    view.format,
    view.visibility,
    view.workflow,
    view.planet,
    view.gap,
  ].filter((value) => value !== undefined && value !== "").length;
}

function structureOf(work: Work) {
  return work.kind.endsWith("-series") ? "series" : "movie";
}
function formatOf(work: Work) {
  return work.kind.startsWith("live-action") ? "live-action" : "animated";
}

export function filterWorks(works: readonly Work[], view: CatalogView): Work[] {
  const query = view.q?.trim().toLocaleLowerCase() ?? "";
  const list = works.filter(
    (work) =>
      (!query ||
        [work.title, work.arabicTitle ?? "", ...work.aliases]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)) &&
      (!view.structure || structureOf(work) === view.structure) &&
      (!view.format || formatOf(work) === view.format) &&
      (!view.visibility || (view.visibility === "private") === work.isPrivate) &&
      (!view.workflow || work.workflowStatus === view.workflow) &&
      (!view.planet || work.planetId === view.planet) &&
      (!view.gap || workHasGap(work, view.gap)),
  );
  const sort = view.sort ?? "title";
  return list.toSorted((a, b) => {
    switch (sort) {
      case "year-desc":
        return (b.year ?? -1) - (a.year ?? -1) || titleOf(a).localeCompare(titleOf(b));
      case "year-asc":
        return (a.year ?? 99999) - (b.year ?? 99999) || titleOf(a).localeCompare(titleOf(b));
      case "rating-desc":
        return (
          (b.calculatedRating ?? -1) - (a.calculatedRating ?? -1) ||
          titleOf(a).localeCompare(titleOf(b))
        );
      case "rating-asc":
        return (
          (a.calculatedRating ?? 99) - (b.calculatedRating ?? 99) ||
          titleOf(a).localeCompare(titleOf(b))
        );
      default:
        return titleOf(a).localeCompare(titleOf(b), "ar");
    }
  });
}

export function titleOf(work: Work) {
  return work.arabicTitle?.trim() || work.title;
}

/** Every gap a work has — the "النواقص" chips in the table. */
export function workGaps(work: Work): CatalogGap[] {
  return catalogGaps.filter((gap) => gap !== "unpublished" && workHasGap(work, gap));
}
