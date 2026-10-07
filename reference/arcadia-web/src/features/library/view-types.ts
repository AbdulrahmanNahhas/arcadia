export type Layout = "gallery" | "wide" | "table" | "timeline";

export type Sort =
  | "title"
  | "rating"
  | "recent"
  | "year"
  | "creator"
  | "audience"
  | "kind"
  | "status"
  | "progress"
  | "trackedOn"
  | "story"
  | "characters"
  | "depth"
  | "worldBuilding"
  | "originality"
  | "craft";
export type SortDirection = "asc" | "desc";

export type GroupBy =
  | "none"
  | "audience"
  | "rating"
  | "kind"
  | "status"
  | "year"
  | "genre"
  | "depth"
  | "craft";

export type GalleryMode = "cover" | "title" | "full" | "custom";

export type GalleryOptions = {
  mode: GalleryMode;
  imageType: "poster" | "logo";
  showType: boolean;
  showRating: boolean;
  showTitle: boolean;
  showFavorite: boolean;
  showCreator: boolean;
  showYear: boolean;
  showGenres: boolean;
  showProgress: boolean;
};

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
  "story",
  "characters",
  "depth",
  "worldBuilding",
  "originality",
  "craft",
] as const;

export type TableColumnId = (typeof tableColumnIds)[number];
export type TableDensity = "compact" | "comfortable" | "spacious";

export const defaultTableColumns: TableColumnId[] = [
  "artwork",
  "title",
  "type",
  "year",
  "status",
  "genres",
  "progress",
  "rating",
];
