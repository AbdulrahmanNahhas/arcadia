import type { Work, WorkKind } from "../library/model";
import type { ScoreComponents, ScoreCriterion } from "../library/scoring";
import { scoreCriteria } from "../library/scoring";

export type CatalogPrivacy = "public" | "all" | "private";
export type CatalogFacetKey =
  | "kinds"
  | "releaseStatuses"
  | "audiences"
  | "ages"
  | "genres"
  | "tones"
  | "tags"
  | "countries"
  | "studios"
  | "contributors"
  | "awardPrograms"
  | "awardCategories"
  | "awardResults"
  | "ratingStates"
  | "warningStates"
  | "structureStates"
  | "sexualityRisks"
  | "behavioralRisks"
  | "theologyRisks";

export type CatalogSelection = { include: string[]; exclude: string[] };
export type CatalogFacetOption = { value: string; count: number };
export type CatalogFacetOptions = Record<CatalogFacetKey, CatalogFacetOption[]>;

export type CatalogFilterState = {
  facets: Record<CatalogFacetKey, CatalogSelection>;
  minimumRating: number;
  minimumScores: ScoreComponents;
  yearFrom: number | null;
  yearTo: number | null;
  privacy: CatalogPrivacy;
};

export const catalogFacetKeys: CatalogFacetKey[] = [
  "kinds",
  "releaseStatuses",
  "audiences",
  "ages",
  "genres",
  "tones",
  "tags",
  "countries",
  "studios",
  "contributors",
  "awardPrograms",
  "awardCategories",
  "awardResults",
  "ratingStates",
  "warningStates",
  "structureStates",
  "sexualityRisks",
  "behavioralRisks",
  "theologyRisks",
];

export function createCatalogFilters(): CatalogFilterState {
  return {
    facets: Object.fromEntries(
      catalogFacetKeys.map((key) => [key, { include: [], exclude: [] }]),
    ) as unknown as Record<CatalogFacetKey, CatalogSelection>,
    minimumRating: 0,
    minimumScores: {},
    yearFrom: null,
    yearTo: null,
    privacy: "public",
  };
}

export function cycleCatalogSelection(
  selection: CatalogSelection,
  value: string,
): CatalogSelection {
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

export function getCatalogFacetValues(work: Work, key: CatalogFacetKey): string[] {
  if (key === "kinds") {
    // Installment kinds (season/movie/special) and title kinds (movie/series/anime/…) only
    // overlap on "movie" — surface that so a movie installment under e.g. an anime title still
    // matches a "Movie" filter, without leaking "season"/"special" as bogus title-kind values.
    return work.installmentKinds?.includes("movie") ? [work.kind, "movie"] : [work.kind];
  }
  if (key === "releaseStatuses") return [work.releaseStatus];
  if (key === "audiences") return work.audience ? [work.audience] : ["unknown"];
  if (key === "ages") return work.age ? [work.age] : ["unknown"];
  if (key === "genres") return work.genres;
  if (key === "tones") return work.tone;
  if (key === "tags") return work.tags;
  if (key === "countries") return work.country;
  if (key === "studios") return work.studios;
  if (key === "contributors") return [...new Set(work.contributors.map(({ name }) => name))];
  if (key === "awardPrograms") {
    return [...new Set(work.awards.map(({ organizationName }) => organizationName))];
  }
  if (key === "awardCategories") {
    return [...new Set(work.awards.map(({ category }) => category))];
  }
  if (key === "awardResults") {
    return [...new Set(work.awards.map(({ result }) => result))];
  }
  if (key === "ratingStates") return [work.calculatedRating === null ? "unrated" : "rated"];
  if (key === "warningStates") return [work.contentWarnings ? "warnings" : "none"];
  if (key === "structureStates") {
    if (!work.installmentId) return ["title"];
    return [work.episodeCount !== null ? "season" : "standalone"];
  }
  const dimension = key.replace("Risks", "") as keyof NonNullable<Work["riskProfile"]>;
  return [work.riskProfile?.[dimension] ?? "unknown"];
}

function matchesSelection(selection: CatalogSelection, values: string[]) {
  return (
    (!selection.include.length || selection.include.some((value) => values.includes(value))) &&
    !selection.exclude.some((value) => values.includes(value))
  );
}

export function workMatchesCatalogFilters(work: Work, filters: CatalogFilterState) {
  if (filters.privacy === "public" && work.isPrivate) return false;
  if (filters.privacy === "private" && !work.isPrivate) return false;
  if (filters.yearFrom !== null && (work.year === null || work.year < filters.yearFrom))
    return false;
  if (filters.yearTo !== null && (work.year === null || work.year > filters.yearTo)) return false;
  if (
    filters.minimumRating > 0 &&
    (work.calculatedRating === null || work.calculatedRating < filters.minimumRating)
  ) {
    return false;
  }
  if (
    scoreCriteria.some((criterion) => {
      const minimum = filters.minimumScores[criterion];
      const score = work.scoreComponents[criterion];
      return minimum !== undefined && (score === undefined || score < minimum);
    })
  ) {
    return false;
  }
  const selectedAwardPrograms = filters.facets.awardPrograms.include;
  const selectedAwardCategories = filters.facets.awardCategories.include;
  const selectedAwardResults = filters.facets.awardResults.include;
  if (
    (selectedAwardPrograms.length ||
      selectedAwardCategories.length ||
      selectedAwardResults.length) &&
    !work.awards.some(
      (recognition) =>
        (!selectedAwardPrograms.length ||
          selectedAwardPrograms.includes(recognition.organizationName)) &&
        (!selectedAwardCategories.length ||
          selectedAwardCategories.includes(recognition.category)) &&
        (!selectedAwardResults.length || selectedAwardResults.includes(recognition.result)),
    )
  ) {
    return false;
  }
  return catalogFacetKeys.every((key) =>
    matchesSelection(filters.facets[key], getCatalogFacetValues(work, key)),
  );
}

export function buildCatalogFacetOptions(works: Work[]): CatalogFacetOptions {
  return Object.fromEntries(
    catalogFacetKeys.map((key) => {
      const counts = new Map<string, number>();
      for (const work of works) {
        for (const value of new Set(getCatalogFacetValues(work, key))) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      const options = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort(
          (left, right) => right.count - left.count || left.value.localeCompare(right.value, "ar"),
        );
      return [key, options];
    }),
  ) as CatalogFacetOptions;
}

export function countCatalogFilters(filters: CatalogFilterState) {
  return (
    Object.values(filters.facets).reduce(
      (total, selection) => total + selection.include.length + selection.exclude.length,
      0,
    ) +
    Number(filters.minimumRating > 0) +
    Object.keys(filters.minimumScores).length +
    Number(filters.yearFrom !== null || filters.yearTo !== null) +
    Number(filters.privacy !== "public")
  );
}

export function setMinimumScore(
  scores: ScoreComponents,
  criterion: ScoreCriterion,
  value: number,
): ScoreComponents {
  if (value <= 0) {
    const { [criterion]: _removed, ...rest } = scores;
    return rest;
  }
  return { ...scores, [criterion]: value };
}

export function catalogKind(value: string): value is WorkKind {
  return ["movie", "series", "anime", "manga", "novel", "game", "visual-novel", "comic"].includes(
    value,
  );
}
