import type { Work, WorkKind } from "./model"

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

export type FacetSelection = {
  include: string[]
  exclude: string[]
}

export type FacetFilters = Record<FacetKey, FacetSelection>
export type FacetOption = { value: string; count: number }
export type FacetOptions = Record<FacetKey, FacetOption[]>

export type WorkFilterState = {
  kinds: WorkKind[]
  excludedKinds: WorkKind[]
  statuses: Work["status"][]
  excludedStatuses: Work["status"][]
  minRating: number
  favoriteOnly: boolean
  yearFrom: number | null
  yearTo: number | null
  facets: FacetFilters
}

export const facetDefinitions: Array<{
  key: FacetKey
  label: string
  defaultOpen?: boolean
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
]

export const kindLabels: Record<WorkKind, string> = {
  movie: "Movie",
  series: "TV series",
  anime: "Anime",
  manga: "Manga",
  novel: "Novel",
  game: "Game",
  "visual-novel": "Visual novel",
  comic: "Comic",
}

export const personalStatuses: Work["status"][] = [
  "planned",
  "in-progress",
  "completed",
  "paused",
  "dropped",
]

const facetKeys = facetDefinitions.map(({ key }) => key)

export function createEmptyFacetFilters(): FacetFilters {
  return Object.fromEntries(
    facetKeys.map((key) => [key, { include: [], exclude: [] }])
  ) as unknown as FacetFilters
}

export function normalizeFacetFilters(value: unknown): FacetFilters {
  const empty = createEmptyFacetFilters()
  if (!value || typeof value !== "object") return empty
  const source = value as Record<string, unknown>
  for (const key of facetKeys) {
    const selection = source[key]
    if (Array.isArray(selection)) {
      empty[key].include = selection.filter(
        (item): item is string => typeof item === "string"
      )
    } else if (selection && typeof selection === "object") {
      const record = selection as Record<string, unknown>
      empty[key] = {
        include: Array.isArray(record.include)
          ? record.include.filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        exclude: Array.isArray(record.exclude)
          ? record.exclude.filter(
              (item): item is string => typeof item === "string"
            )
          : [],
      }
    }
  }
  return empty
}

export function cycleSelection(
  selection: FacetSelection,
  value: string
): FacetSelection {
  if (selection.include.includes(value)) {
    return {
      include: selection.include.filter((item) => item !== value),
      exclude: [...selection.exclude, value],
    }
  }
  if (selection.exclude.includes(value)) {
    return {
      include: selection.include,
      exclude: selection.exclude.filter((item) => item !== value),
    }
  }
  return { include: [...selection.include, value], exclude: selection.exclude }
}

export function cycleCategoricalValue<T extends string>(
  include: T[],
  exclude: T[],
  value: T
): { include: T[]; exclude: T[] } {
  const next = cycleSelection({ include, exclude }, value)
  return { include: next.include as T[], exclude: next.exclude as T[] }
}

export function getWorkFacetValues(work: Work, key: FacetKey): string[] {
  if (key === "genres") return work.genres
  if (key === "tags") return work.tags
  if (key === "tones") return work.tone
  if (key === "studios") return work.studios
  if (key === "contributors") return work.credits.map(({ name }) => name)
  if (key === "publishers")
    return work.publication?.publisher ? [work.publication.publisher] : []
  if (key === "publicationFormats")
    return work.publication?.format ? [work.publication.format] : []
  if (key === "releaseStatuses") return [work.releaseStatus]
  if (key === "countries") return work.country
  if (key === "audiences") return work.audience
  if (key === "sharedWith") return work.sharedWith
  if (key === "sourceTypes")
    return work.sourceMaterial ? [work.sourceMaterial.type] : []
  if (key === "sexualityRisks")
    return work.riskProfile ? [work.riskProfile.sexuality] : []
  if (key === "behavioralRisks")
    return work.riskProfile ? [work.riskProfile.behavioral] : []
  return work.riskProfile ? [work.riskProfile.theology] : []
}

function matchesSelection(selection: FacetSelection, values: string[]) {
  const includesMatch =
    selection.include.length === 0 ||
    selection.include.some((value) => values.includes(value))
  const excludesMatch = !selection.exclude.some((value) =>
    values.includes(value)
  )
  return includesMatch && excludesMatch
}

export function workMatchesFilters(work: Work, filters: WorkFilterState) {
  if (filters.kinds.length && !filters.kinds.includes(work.kind)) return false
  if (filters.excludedKinds.includes(work.kind)) return false
  if (filters.statuses.length && !filters.statuses.includes(work.status))
    return false
  if (filters.excludedStatuses.includes(work.status)) return false
  if ((work.rating ?? 0) < filters.minRating) return false
  if (filters.favoriteOnly && !work.favorite) return false
  if (filters.yearFrom !== null && (work.year ?? 0) < filters.yearFrom)
    return false
  if (filters.yearTo !== null && (work.year ?? 9999) > filters.yearTo)
    return false
  return facetKeys.every((key) =>
    matchesSelection(filters.facets[key], getWorkFacetValues(work, key))
  )
}

export function buildFacetOptions(works: Work[]): FacetOptions {
  const count = (values: string[][]): FacetOption[] => {
    const counts = new Map<string, number>()
    values
      .flat()
      .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
    return [...counts.entries()]
      .map(([value, total]) => ({ value, count: total }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  }
  return Object.fromEntries(
    facetKeys.map((key) => [
      key,
      count(works.map((work) => getWorkFacetValues(work, key))),
    ])
  ) as FacetOptions
}

export function countFacetFilters(facets: FacetFilters) {
  return Object.values(facets).reduce(
    (total, selection) =>
      total + selection.include.length + selection.exclude.length,
    0
  )
}

export function countActiveFilters(filters: WorkFilterState) {
  return (
    filters.kinds.length +
    filters.excludedKinds.length +
    filters.statuses.length +
    filters.excludedStatuses.length +
    countFacetFilters(filters.facets) +
    Number(filters.minRating > 0) +
    Number(filters.favoriteOnly) +
    Number(filters.yearFrom !== null || filters.yearTo !== null)
  )
}
