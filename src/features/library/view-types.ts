export type Layout = "gallery" | "table" | "timeline" | "statistics"
export type LibraryView = "all" | "progress" | "favorites"
export type Sort = "title" | "rating" | "recent" | "year"
export type SortDirection = "asc" | "desc"

export type GalleryMode = "cover" | "title" | "full" | "custom"

export type GalleryOptions = {
  mode: GalleryMode
  imageType: "poster" | "logo"
  showType: boolean
  showRating: boolean
  showTitle: boolean
  showFavorite: boolean
  showCreator: boolean
  showYear: boolean
  showGenres: boolean
  showProgress: boolean
}

export const tableColumnIds = [
  "artwork",
  "title",
  "creator",
  "favorite",
  "type",
  "year",
  "releaseStatus",
  "status",
  "genres",
  "progress",
  "rating",
  "studios",
  "country",
  "audience",
  "addedAt",
  "trackedOn",
] as const

export type TableColumnId = (typeof tableColumnIds)[number]
export type TableDensity = "compact" | "comfortable" | "spacious"

export const defaultTableColumns: TableColumnId[] = [
  "artwork",
  "title",
  "type",
  "year",
  "status",
  "genres",
  "progress",
  "rating",
]
