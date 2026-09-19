import type { Work } from "@/features/library/model";

/**
 * "What is missing" filters for the admin catalog, reachable by URL (`/admin/catalog?gap=poster`)
 * so the overview's work queue, validation rows and links in chat all land on the exact list.
 */
export const catalogGaps = [
  "poster",
  "arabic",
  "guidance",
  "year",
  "planet",
  "ids",
  "unpublished",
] as const;
export type CatalogGap = (typeof catalogGaps)[number];

export function isCatalogGap(value: string): value is CatalogGap {
  return catalogGaps.some((entry) => entry === value);
}

export const catalogGapLabels = {
  poster: "بلا ملصق",
  arabic: "بلا عنوان عربي",
  guidance: "بلا تحليل أو تحذيرات",
  year: "بلا سنة إصدار",
  planet: "بلا كوكب",
  ids: "غير قابل للتشغيل",
  unpublished: "غير منشور",
} satisfies Record<CatalogGap, string>;

export function workHasGap(work: Work, gap: CatalogGap): boolean {
  switch (gap) {
    case "poster":
      return !work.imagePath;
    case "arabic":
      return !work.arabicTitle?.trim();
    case "guidance":
      return !work.contentWarnings?.trim() && !work.analysisNotes?.trim();
    case "year":
      return work.year === null;
    case "planet":
      return work.planetId === null;
    case "ids":
      // Released, yet no installment can resolve a stream — in practice a missing IMDb/TMDB id
      // (`isPlayable` is the API's own verdict; the title-level ids alone say nothing for films).
      return !work.isPlayable && work.releaseStatus !== "upcoming";
    case "unpublished":
      return work.workflowStatus !== "published";
    default:
      return false;
  }
}
