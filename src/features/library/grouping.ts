import { kindLabels } from "./filtering";
import { taxonomyLabels, type Work } from "./model";
import { scoreCriterionLabels } from "./scoring";
import { statusLabelsAr } from "./translations";
import type { GroupBy } from "./view-types";

export type WorkGroup = {
  key: string;
  label: string;
  works: Work[];
};

const audienceLabels: Record<string, string> = {
  Adult: "بالغون",
  "Young Adult": "شباب بالغون",
  Teen: "مراهقون",
  General: "عام",
};

function scoreBucket(value: number | null | undefined) {
  if (value === null || value === undefined) return { key: "unrated", label: "غير مقيّم" };
  const floor = Math.min(9, Math.max(0, Math.floor(value)));
  return {
    key: String(floor).padStart(2, "0"),
    label: floor === 9 ? "9–10" : `${floor}–${floor + 0.9}`,
  };
}

function groupValue(work: Work, groupBy: Exclude<GroupBy, "none">) {
  if (groupBy === "rating") return scoreBucket(work.calculatedRating);
  if (groupBy === "depth" || groupBy === "craft") {
    return scoreBucket(work.scoreComponents[groupBy]);
  }
  if (groupBy === "audience") {
    return work.audience
      ? { key: work.audience, label: audienceLabels[work.audience] ?? work.audience }
      : { key: "unknown", label: "جمهور غير محدد" };
  }
  if (groupBy === "kind") return { key: work.kind, label: kindLabels[work.kind] };
  if (groupBy === "status") return { key: work.status, label: statusLabelsAr[work.status] };
  if (groupBy === "year") {
    const decade = work.year === null ? null : Math.floor(work.year / 10) * 10;
    return decade === null
      ? { key: "unknown", label: "سنة غير محددة" }
      : { key: String(decade), label: `${decade}–${decade + 9}` };
  }
  const genre = work.genres[0];
  return genre
    ? {
        key: genre,
        label: taxonomyLabels.genres[genre as keyof typeof taxonomyLabels.genres] ?? genre,
      }
    : { key: "unknown", label: "بلا تصنيف" };
}

export function groupWorks(works: Work[], groupBy: GroupBy): WorkGroup[] {
  if (groupBy === "none") return [{ key: "all", label: "كل الأعمال", works }];

  const groups = new Map<string, WorkGroup>();
  for (const work of works) {
    const value = groupValue(work, groupBy);
    const group = groups.get(value.key);
    if (group) group.works.push(work);
    else groups.set(value.key, { ...value, works: [work] });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.key === "unknown" || left.key === "unrated") return 1;
    if (right.key === "unknown" || right.key === "unrated") return -1;
    if (["rating", "depth", "craft", "year"].includes(groupBy)) {
      return right.key.localeCompare(left.key);
    }
    return left.label.localeCompare(right.label, "ar");
  });
}

export function groupLabel(groupBy: GroupBy) {
  if (groupBy === "depth" || groupBy === "craft") return scoreCriterionLabels[groupBy].ar;
  return {
    none: "من دون تجميع",
    audience: "الجمهور",
    rating: "نطاق التقييم",
    kind: "نوع العمل",
    status: "حالة المتابعة",
    year: "العقد",
    genre: "التصنيف الأساسي",
  }[groupBy];
}
