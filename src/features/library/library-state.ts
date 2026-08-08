import type { WorkFilterState } from "./filtering";
import { createDefaultFilters, normalizeFacetFilters, personalStatuses } from "./filtering";
import type { SavedUserView } from "./model";
import { workKinds } from "./model";
import type {
  GalleryOptions,
  GroupBy,
  Layout,
  Sort,
  SortDirection,
  TableColumnId,
  TableDensity,
} from "./view-types";
import { defaultTableColumns, tableColumnIds } from "./view-types";

export const defaultGalleryOptions: GalleryOptions = {
  mode: "full",
  imageType: "poster",
  showType: true,
  showRating: true,
  showTitle: true,
  showFavorite: true,
  showCreator: false,
  showYear: true,
  showGenres: true,
  showProgress: false,
};

export type LibraryViewState = {
  search: string;
  layout: Layout;
  sort: Sort;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  filters: WorkFilterState;
  cardSize: number;
  galleryOptions: GalleryOptions;
  timelineNewestFirst: boolean;
  tableColumns: TableColumnId[];
  tableDensity: TableDensity;
};

const layouts: Layout[] = ["gallery", "wide", "table", "timeline"];
const sorts: Sort[] = [
  "title",
  "rating",
  "recent",
  "year",
  "creator",
  "audience",
  "kind",
  "status",
  "progress",
  "trackedOn",
  "story",
  "characters",
  "depth",
  "worldBuilding",
  "originality",
  "craft",
];
const groups: GroupBy[] = [
  "none",
  "audience",
  "rating",
  "kind",
  "status",
  "year",
  "genre",
  "depth",
  "craft",
];

export function createDefaultViewState(): LibraryViewState {
  return {
    search: "",
    layout: "gallery",
    sort: "rating",
    sortDirection: "desc",
    groupBy: "none",
    filters: createDefaultFilters(),
    cardSize: 154,
    galleryOptions: { ...defaultGalleryOptions },
    timelineNewestFirst: true,
    tableColumns: [...defaultTableColumns],
    tableDensity: "comfortable",
  };
}

export function viewStateFromSavedView(view: SavedUserView): LibraryViewState {
  return {
    search: view.search,
    layout: includes(layouts, view.layout) ? view.layout : "gallery",
    sort: view.sort,
    sortDirection: view.sortDirection,
    groupBy: view.groupBy,
    filters: {
      kinds: view.kinds,
      excludedKinds: view.excludedKinds,
      statuses: view.statuses,
      excludedStatuses: view.excludedStatuses,
      showSaved: view.showSaved,
      showAnnounced: view.showAnnounced,
      showSequelMovies: view.showSequelMovies,
      minRating: view.minRating,
      minScores: view.minScores,
      favoriteOnly: view.favoriteOnly,
      yearFrom: view.yearFrom,
      yearTo: view.yearTo,
      facets: normalizeFacetFilters(view.facets),
    },
    cardSize: view.cardSize,
    galleryOptions: view.gallery,
    timelineNewestFirst: view.timelineNewestFirst,
    tableColumns: view.visibleColumns.filter(isTableColumnId).length
      ? view.visibleColumns.filter(isTableColumnId)
      : [...defaultTableColumns],
    tableDensity: view.tableDensity,
  };
}

export function encodeViewState(state: LibraryViewState) {
  return JSON.stringify(state);
}

export function decodeViewState(value?: string): LibraryViewState | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    const defaults = createDefaultViewState();
    const filters = decodeFilters(raw.filters, defaults.filters);
    const gallery = decodeGallery(raw.galleryOptions, defaults.galleryOptions);
    const columns = Array.isArray(raw.tableColumns)
      ? raw.tableColumns.filter(
          (item): item is TableColumnId => typeof item === "string" && isTableColumnId(item),
        )
      : defaults.tableColumns;
    return {
      search: typeof raw.search === "string" ? raw.search : defaults.search,
      layout: includes(layouts, raw.layout) ? raw.layout : defaults.layout,
      sort: includes(sorts, raw.sort) ? raw.sort : defaults.sort,
      sortDirection:
        raw.sortDirection === "asc" || raw.sortDirection === "desc"
          ? raw.sortDirection
          : defaults.sortDirection,
      groupBy: includes(groups, raw.groupBy) ? raw.groupBy : defaults.groupBy,
      filters,
      cardSize:
        typeof raw.cardSize === "number" && Number.isFinite(raw.cardSize)
          ? Math.min(300, Math.max(110, Math.round(raw.cardSize)))
          : defaults.cardSize,
      galleryOptions: gallery,
      timelineNewestFirst:
        typeof raw.timelineNewestFirst === "boolean"
          ? raw.timelineNewestFirst
          : defaults.timelineNewestFirst,
      tableColumns: columns.length ? columns : defaults.tableColumns,
      tableDensity:
        raw.tableDensity === "compact" ||
        raw.tableDensity === "comfortable" ||
        raw.tableDensity === "spacious"
          ? raw.tableDensity
          : defaults.tableDensity,
    };
  } catch {
    return null;
  }
}

function decodeFilters(value: unknown, defaults: WorkFilterState): WorkFilterState {
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Record<string, unknown>;
  const numberOrNull = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
  return {
    kinds: Array.isArray(raw.kinds)
      ? raw.kinds.filter((item): item is WorkFilterState["kinds"][number] =>
          includes(workKinds, item),
        )
      : [],
    excludedKinds: Array.isArray(raw.excludedKinds)
      ? raw.excludedKinds.filter((item): item is WorkFilterState["kinds"][number] =>
          includes(workKinds, item),
        )
      : [],
    statuses: Array.isArray(raw.statuses)
      ? raw.statuses.filter((item): item is WorkFilterState["statuses"][number] =>
          includes(personalStatuses, item),
        )
      : [],
    excludedStatuses: Array.isArray(raw.excludedStatuses)
      ? raw.excludedStatuses.filter((item): item is WorkFilterState["statuses"][number] =>
          includes(personalStatuses, item),
        )
      : [],
    showSaved: raw.showSaved === true,
    showAnnounced: raw.showAnnounced === true,
    showSequelMovies: raw.showSequelMovies === true,
    minRating: typeof raw.minRating === "number" ? raw.minRating : 0,
    minScores:
      raw.minScores && typeof raw.minScores === "object"
        ? (raw.minScores as WorkFilterState["minScores"])
        : {},
    favoriteOnly: raw.favoriteOnly === true,
    yearFrom: numberOrNull(raw.yearFrom),
    yearTo: numberOrNull(raw.yearTo),
    facets: normalizeFacetFilters(raw.facets),
  };
}

function decodeGallery(value: unknown, defaults: GalleryOptions): GalleryOptions {
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Record<string, unknown>;
  return {
    mode:
      raw.mode === "cover" || raw.mode === "title" || raw.mode === "full" || raw.mode === "custom"
        ? raw.mode
        : defaults.mode,
    imageType: raw.imageType === "logo" ? "logo" : "poster",
    showType: typeof raw.showType === "boolean" ? raw.showType : defaults.showType,
    showRating: typeof raw.showRating === "boolean" ? raw.showRating : defaults.showRating,
    showTitle: typeof raw.showTitle === "boolean" ? raw.showTitle : defaults.showTitle,
    showFavorite: typeof raw.showFavorite === "boolean" ? raw.showFavorite : defaults.showFavorite,
    showCreator: typeof raw.showCreator === "boolean" ? raw.showCreator : defaults.showCreator,
    showYear: typeof raw.showYear === "boolean" ? raw.showYear : defaults.showYear,
    showGenres: typeof raw.showGenres === "boolean" ? raw.showGenres : defaults.showGenres,
    showProgress: typeof raw.showProgress === "boolean" ? raw.showProgress : defaults.showProgress,
  };
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isTableColumnId(value: string): value is TableColumnId {
  return tableColumnIds.includes(value as TableColumnId);
}
