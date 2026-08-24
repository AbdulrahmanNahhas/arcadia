import type { Work } from "../library/model";
import { ageValues, taxonomyLabels, workKinds } from "../library/model";
import { kindLabelsAr } from "../library/translations";

export type CatalogGroupBy = "none" | "year" | "audience" | "age" | "kind" | "releaseStatus";

export type CatalogGroup = {
  key: string;
  label: string;
  works: Work[];
};

export const catalogGroupByOptions: Array<{ value: CatalogGroupBy; label: string }> = [
  { value: "none", label: "بلا تجميع" },
  { value: "year", label: "سنة الإصدار" },
  { value: "kind", label: "النوع" },
  { value: "releaseStatus", label: "حالة العرض" },
  { value: "audience", label: "الجمهور" },
  { value: "age", label: "الفئة العمرية" },
];

const unknownLabel = "غير معروف";
const unknownKey = "unknown";

const releaseStatusOrder = ["airing", "upcoming", "returning", "completed", unknownKey];
export const releaseStatusLabelsAr = {
  airing: "يعرض الآن",
  upcoming: "قادم",
  returning: "مستمر",
  completed: "مكتمل",
  unknown: unknownLabel,
} satisfies Record<Work["releaseStatus"], string>;

// Widest audience first, matching this app's family-safety framing: who can safely watch grows
// narrower as the list goes on.
const audienceOrder = ["General", "Teen", "Young Adult", "Adult", unknownKey];
const ageOrder = [...ageValues, unknownKey];
const kindOrder = [...workKinds];

function groupIdentity(work: Work, groupBy: CatalogGroupBy) {
  if (groupBy === "year") {
    const key = work.year === null ? unknownKey : String(work.year);
    return { key, label: work.year === null ? unknownLabel : key };
  }
  if (groupBy === "kind") {
    return { key: work.kind, label: kindLabelsAr[work.kind] };
  }
  if (groupBy === "releaseStatus") {
    return { key: work.releaseStatus, label: releaseStatusLabelsAr[work.releaseStatus] };
  }
  if (groupBy === "audience") {
    const key = work.audience ?? unknownKey;
    return { key, label: work.audience ? taxonomyLabels.audiences[work.audience] : unknownLabel };
  }
  const key = work.age ?? unknownKey;
  return { key, label: work.age ? taxonomyLabels.ages[work.age] : unknownLabel };
}

function groupOrder(groupBy: Exclude<CatalogGroupBy, "none" | "year">): string[] {
  if (groupBy === "kind") return kindOrder;
  if (groupBy === "releaseStatus") return releaseStatusOrder;
  if (groupBy === "audience") return audienceOrder;
  return ageOrder;
}

function bucketWorks(works: Work[], groupBy: CatalogGroupBy) {
  const buckets = new Map<string, CatalogGroup>();
  for (const work of works) {
    const { key, label } = groupIdentity(work, groupBy);
    const existing = buckets.get(key);
    if (existing) existing.works.push(work);
    else buckets.set(key, { key, label, works: [work] });
  }
  return buckets;
}

function pickGroups(buckets: Map<string, CatalogGroup>, order: string[]) {
  const ordered = order.flatMap((key) => {
    const group = buckets.get(key);
    return group ? [group] : [];
  });
  const remainingKeys = new Set(order);
  const extra = [...buckets.values()].filter((group) => !remainingKeys.has(group.key));
  return [...ordered, ...extra];
}

/**
 * Buckets already-sorted works into ordered sections. Works keep the incoming sort order within
 * each group. Groups over a fixed taxonomy (kind/releaseStatus/audience/age) always appear in
 * the same intentional order; year groups follow `yearsDescending` (matched to the active sort
 * so a "newest" sort reads as descending years, "oldest" as ascending).
 */
export function groupWorks(
  works: Work[],
  groupBy: CatalogGroupBy,
  yearsDescending = true,
): CatalogGroup[] {
  if (groupBy === "none") return works.length ? [{ key: "all", label: "", works }] : [];

  const buckets = bucketWorks(works, groupBy);

  if (groupBy === "year") {
    const yearOrder = [...buckets.keys()]
      .filter((key) => key !== unknownKey)
      .toSorted((left, right) =>
        yearsDescending ? Number(right) - Number(left) : Number(left) - Number(right),
      );
    return pickGroups(buckets, [...yearOrder, unknownKey]);
  }

  return pickGroups(buckets, groupOrder(groupBy));
}
