import type { Work, WorkKind } from "./model";
import type { ScoreComponents } from "./scoring";
import { scoreCriteria } from "./scoring";
import type { Sort, SortDirection } from "./view-types";

export type FacetKey =
  | "genres"
  | "tags"
  | "tones"
  | "studios"
  | "contributors"
  | "publishers"
  | "publicationFormats"
  | "releaseStatuses"
  | "countries"
  | "audiences"
  | "sharedWith"
  | "sourceTypes"
  | "sexualityRisks"
  | "behavioralRisks"
  | "theologyRisks"
  | "curationStatuses"
  | "creatorRoles"
  | "externalProviders"
  | "structureStates";

export type FacetSelection = {
  include: string[];
  exclude: string[];
};

export type FacetFilters = Record<FacetKey, FacetSelection>;
export type FacetOption = { value: string; count: number };
export type FacetOptions = Record<FacetKey, FacetOption[]>;

export type WorkFilterState = {
  kinds: WorkKind[];
  excludedKinds: WorkKind[];
  minRating: number;
  minScores: ScoreComponents;
  favoriteOnly: boolean;
  privateOnly: boolean;
  yearFrom: number | null;
  yearTo: number | null;
  facets: FacetFilters;
};

export function createEmptyScoreFilters(): ScoreComponents {
  return {};
}

export const facetDefinitions: Array<{
  key: FacetKey;
  label: string;
  defaultOpen?: boolean;
}> = [
  { key: "genres", label: "Genres", defaultOpen: true },
  { key: "tags", label: "Tags & themes" },
  { key: "tones", label: "Tone" },
  { key: "studios", label: "Studios" },
  { key: "contributors", label: "Contributors" },
  { key: "publishers", label: "Publishers" },
  { key: "publicationFormats", label: "Publication format" },
  { key: "releaseStatuses", label: "Release status" },
  { key: "countries", label: "Countries" },
  { key: "audiences", label: "Audience" },
  { key: "sharedWith", label: "Shared with" },
  { key: "sourceTypes", label: "Source material" },
  { key: "sexualityRisks", label: "Sexual-content guidance" },
  { key: "behavioralRisks", label: "Violence & distress" },
  { key: "theologyRisks", label: "Religious / occult themes" },
  { key: "curationStatuses", label: "Curation status" },
  { key: "creatorRoles", label: "Creator roles" },
  { key: "externalProviders", label: "External providers" },
  { key: "structureStates", label: "Tracking structure" },
];

export const kindLabels: Record<WorkKind, string> = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  manga: "مانغا",
  novel: "رواية",
  game: "لعبة",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصورة",
};

export function createDefaultFilters(): WorkFilterState {
  return {
    kinds: [],
    excludedKinds: [],
    minRating: 0,
    minScores: {},
    favoriteOnly: false,
    privateOnly: false,
    yearFrom: null,
    yearTo: null,
    facets: createEmptyFacetFilters(),
  };
}

export function isWorkVisibleByDefault(work: Work) {
  return !work.isPrivate;
}

export function compareWorks(left: Work, right: Work, sort: Sort, direction: SortDirection) {
  let comparison = 0;
  const scoreSorts = [
    "story",
    "characters",
    "depth",
    "worldBuilding",
    "originality",
    "craft",
  ] as const;
  if (sort === "rating") {
    comparison = compareOptionalNumber(left.calculatedRating, right.calculatedRating, direction);
  } else if (sort === "recent") {
    comparison = left.addedAt - right.addedAt;
  } else if (sort === "year") {
    comparison = compareOptionalNumber(left.year, right.year, direction);
  } else if (sort === "creator") {
    comparison = left.creator.localeCompare(right.creator, "ar");
  } else if (sort === "audience") {
    comparison = (left.audience ?? "").localeCompare(right.audience ?? "", "en");
  } else if (sort === "kind") {
    comparison = kindLabels[left.kind].localeCompare(kindLabels[right.kind], "ar");
  } else if ((scoreSorts as readonly string[]).includes(sort)) {
    const criterion = sort as (typeof scoreSorts)[number];
    comparison = compareOptionalNumber(
      left.scoreComponents[criterion],
      right.scoreComponents[criterion],
      direction,
    );
  }
  if (sort !== "title" && comparison !== 0) return direction === "asc" ? comparison : -comparison;
  const titleComparison = (left.arabicTitle || left.title).localeCompare(
    right.arabicTitle || right.title,
    "ar",
  );
  return sort === "title" && direction === "desc" ? -titleComparison : titleComparison;
}

function compareOptionalNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: SortDirection,
) {
  if (left === null || left === undefined)
    return right === null || right === undefined ? 0 : direction === "asc" ? 1 : -1;
  if (right === null || right === undefined) return direction === "asc" ? -1 : 1;
  return left - right;
}

const facetKeys = facetDefinitions.map(({ key }) => key);

export function createEmptyFacetFilters(): FacetFilters {
  return Object.fromEntries(
    facetKeys.map((key) => [key, { include: [], exclude: [] }]),
  ) as unknown as FacetFilters;
}

export function normalizeFacetFilters(value: unknown): FacetFilters {
  const empty = createEmptyFacetFilters();
  if (!value || typeof value !== "object") return empty;
  const source = value as Record<string, unknown>;
  for (const key of facetKeys) {
    const selection = source[key];
    if (Array.isArray(selection)) {
      empty[key].include = selection.filter((item): item is string => typeof item === "string");
    } else if (selection && typeof selection === "object") {
      const record = selection as Record<string, unknown>;
      empty[key] = {
        include: Array.isArray(record.include)
          ? record.include.filter((item): item is string => typeof item === "string")
          : [],
        exclude: Array.isArray(record.exclude)
          ? record.exclude.filter((item): item is string => typeof item === "string")
          : [],
      };
    }
  }
  return empty;
}

export function cycleSelection(selection: FacetSelection, value: string): FacetSelection {
  if (selection.include.includes(value)) {
    return {
      include: selection.include.filter((item) => item !== value),
      exclude: [...selection.exclude, value],
    };
  }
  if (selection.exclude.includes(value)) {
    return {
      include: selection.include,
      exclude: selection.exclude.filter((item) => item !== value),
    };
  }
  return { include: [...selection.include, value], exclude: selection.exclude };
}

export function cycleCategoricalValue<T extends string>(
  include: T[],
  exclude: T[],
  value: T,
): { include: T[]; exclude: T[] } {
  const next = cycleSelection({ include, exclude }, value);
  return { include: next.include as T[], exclude: next.exclude as T[] };
}

export function getWorkFacetValues(work: Work, key: FacetKey): string[] {
  if (key === "genres") return work.genres;
  if (key === "tags") return work.tags;
  if (key === "tones") return work.tone;
  if (key === "studios") return work.studios;
  if (key === "contributors") return work.contributors.map(({ name }) => name);
  if (key === "publishers")
    return [
      ...new Set([
        ...(work.publication?.publisher ? [work.publication.publisher] : []),
        ...work.contributors.filter(({ role }) => role === "publisher").map(({ name }) => name),
      ]),
    ];
  if (key === "publicationFormats")
    return work.publication?.format ? [work.publication.format] : [];
  if (key === "releaseStatuses") return [work.releaseStatus];
  if (key === "countries") return work.country;
  if (key === "audiences") return work.audience ? [work.audience] : [];
  if (key === "sharedWith") return work.sharedWith;
  if (key === "sourceTypes") return work.sourceMaterial ? [work.sourceMaterial.type] : [];
  if (key === "sexualityRisks") return work.riskProfile ? [work.riskProfile.sexuality] : [];
  if (key === "behavioralRisks") return work.riskProfile ? [work.riskProfile.behavioral] : [];
  if (key === "theologyRisks") return work.riskProfile ? [work.riskProfile.theology] : [];
  if (key === "curationStatuses") return [work.curation?.status ?? "unreviewed"];
  if (key === "creatorRoles") return [...new Set(work.contributors.map(({ role }) => role))];
  if (key === "externalProviders")
    return [...new Set(work.externalLinks.map(({ provider }) => provider))];
  return [work.episodeCount !== null || work.chapterCount !== null ? "structured" : "unstructured"];
}

function matchesSelection(selection: FacetSelection, values: string[]) {
  const includesMatch =
    selection.include.length === 0 || selection.include.some((value) => values.includes(value));
  const excludesMatch = !selection.exclude.some((value) => values.includes(value));
  return includesMatch && excludesMatch;
}

export function workMatchesFilters(work: Work, filters: WorkFilterState) {
  if (filters.privateOnly ? !work.isPrivate : work.isPrivate) return false;
  if (filters.kinds.length && !filters.kinds.includes(work.kind)) return false;
  if (filters.excludedKinds.includes(work.kind)) return false;
  if ((work.calculatedRating ?? 0) < filters.minRating) return false;
  if (!matchesScoreFilters(work.scoreComponents, filters.minScores)) return false;
  if (filters.favoriteOnly && !work.favorite) return false;
  if (filters.yearFrom !== null && (work.year ?? 0) < filters.yearFrom) return false;
  if (filters.yearTo !== null && (work.year ?? 9999) > filters.yearTo) return false;
  return facetKeys.every((key) =>
    matchesSelection(filters.facets[key], getWorkFacetValues(work, key)),
  );
}

export function matchesScoreFilters(scores: ScoreComponents, minimums: ScoreComponents) {
  return scoreCriteria.every((criterion) => {
    const minimum = minimums[criterion];
    const score = scores[criterion];
    return minimum === undefined || (score !== undefined && score >= minimum);
  });
}

export function buildFacetOptions(works: Work[]): FacetOptions {
  const count = (values: string[][]): FacetOption[] => {
    const counts = new Map<string, number>();
    for (const value of values.flat()) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, total]) => ({ value, count: total }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  return Object.fromEntries(
    facetKeys.map((key) => [key, count(works.map((work) => getWorkFacetValues(work, key)))]),
  ) as FacetOptions;
}

export function countFacetFilters(facets: FacetFilters) {
  return Object.values(facets).reduce(
    (total, selection) => total + selection.include.length + selection.exclude.length,
    0,
  );
}

export function countActiveFilters(filters: WorkFilterState) {
  return (
    filters.kinds.length +
    filters.excludedKinds.length +
    countFacetFilters(filters.facets) +
    Number(filters.minRating > 0) +
    Object.keys(filters.minScores).length +
    Number(filters.favoriteOnly) +
    Number(filters.privateOnly) +
    Number(filters.yearFrom !== null || filters.yearTo !== null)
  );
}
