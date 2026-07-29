import { useEffect, useMemo, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  addSavedView,
  getSavedViews,
  getWorks,
  setWorkFavorite,
} from "@/server/library.functions"
import { AdvancedFilter } from "./filter-sheet"
import {
  buildFacetOptions,
  createEmptyFacetFilters,
  normalizeFacetFilters,
  workMatchesFilters,
} from "./filtering"
import type { WorkFilterState } from "./filtering"
import { getCollection, workBelongsToCollection } from "./collections"
import type { CollectionId } from "./collections"
import type { SavedUserView, Work } from "./model"
import { defaultTableColumns, tableColumnIds } from "./view-types"
import type {
  GalleryOptions,
  Layout,
  LibraryView,
  Sort,
  SortDirection,
  TableColumnId,
  TableDensity,
} from "./view-types"
import { AddWorkDialog } from "./components/add-work-dialog"
import { CollectionToolbar } from "./components/collection-toolbar"
import { EmptyState } from "./components/empty-state"
import { Gallery } from "./components/gallery"
import { Statistics } from "./components/statistics"
import { Timeline } from "./components/timeline"
import { WorkDetailDialog } from "./components/work-detail-dialog"
import { WorkTable } from "./components/work-table"

export type { Layout, LibraryView, Sort } from "./view-types"

function createDefaultFilters(): WorkFilterState {
  return {
    kinds: [],
    excludedKinds: [],
    statuses: [],
    excludedStatuses: [],
    minRating: 0,
    minScores: {},
    favoriteOnly: false,
    yearFrom: null,
    yearTo: null,
    facets: createEmptyFacetFilters(),
  }
}

const defaultGalleryOptions: GalleryOptions = {
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
}

function isTableColumnId(value: string): value is TableColumnId {
  return tableColumnIds.includes(value as TableColumnId)
}

export function CollectionView({
  collectionId,
  view,
  workId,
  savedViewId,
  onCollectionChange,
  onViewChange,
  onWorkChange,
  onSavedViewChange,
}: {
  collectionId: CollectionId
  view: LibraryView
  workId?: string
  savedViewId?: string
  onCollectionChange: (collectionId: CollectionId) => void
  onViewChange: (view: LibraryView) => void
  onWorkChange: (workId?: string) => void
  onSavedViewChange: (savedViewId?: string) => void
}) {
  const collection = getCollection(collectionId)
  const queryClient = useQueryClient()
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  })
  const { data: savedViews } = useSuspenseQuery({
    queryKey: ["saved-views"],
    queryFn: () => getSavedViews(),
  })
  const [search, setSearch] = useState("")
  const [layout, setLayout] = useState<Layout>("gallery")
  const [sort, setSort] = useState<Sort>("title")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [filters, setFilters] = useState<WorkFilterState>(createDefaultFilters)
  const [cardSize, setCardSize] = useState(154)
  const [galleryOptions, setGalleryOptions] = useState<GalleryOptions>(
    defaultGalleryOptions
  )
  const [timelineNewestFirst, setTimelineNewestFirst] = useState(true)
  const [tableColumns, setTableColumns] =
    useState<TableColumnId[]>(defaultTableColumns)
  const [tableDensity, setTableDensity] = useState<TableDensity>("comfortable")

  const activeSavedView = savedViews.find((item) => item.id === savedViewId)

  useEffect(() => {
    if (!savedViewId) return
    const savedView = savedViews.find((item) => item.id === savedViewId)
    if (!savedView) return

    setSearch(savedView.search)
    setLayout(savedView.layout)
    setSort(savedView.sort)
    setSortDirection(savedView.sortDirection)
    setCardSize(savedView.cardSize)
    setGalleryOptions(savedView.gallery)
    const savedColumns = savedView.visibleColumns.filter(isTableColumnId)
    setTableColumns(savedColumns.length ? savedColumns : defaultTableColumns)
    setTableDensity(savedView.tableDensity)
    setFilters({
      kinds: savedView.kinds,
      excludedKinds: savedView.excludedKinds,
      statuses: savedView.statuses,
      excludedStatuses: savedView.excludedStatuses,
      minRating: savedView.minRating,
      minScores: savedView.minScores,
      favoriteOnly: savedView.favoriteOnly,
      yearFrom: savedView.yearFrom,
      yearTo: savedView.yearTo,
      facets: normalizeFacetFilters(savedView.facets),
    })
  }, [savedViewId, savedViews])

  useEffect(() => {
    const stored = window.localStorage.getItem("arcadia:gallery-card-size")
    if (stored && !savedViewId) {
      setCardSize(Math.min(220, Math.max(110, Number(stored))))
    }
  }, [savedViewId])

  const changeCardSize = (value: number) => {
    setCardSize(value)
    window.localStorage.setItem("arcadia:gallery-card-size", String(value))
  }

  const collectionWorks = useMemo(
    () => works.filter((work) => workBelongsToCollection(work, collection)),
    [collection, works]
  )
  const facetOptions = useMemo(
    () => buildFacetOptions(collectionWorks),
    [collectionWorks]
  )

  const filteredWorks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    const matches = collectionWorks.filter((work) => {
      const searchable = [
        work.title,
        work.arabicTitle ?? "",
        work.creator,
        work.summary,
        ...work.tags,
        ...work.genres,
        ...work.aliases,
        ...work.studios,
      ]
        .join(" ")
        .toLocaleLowerCase()
      const matchesView =
        Boolean(activeSavedView) ||
        view === "all" ||
        (view === "progress" && work.status === "in-progress") ||
        (view === "favorites" && work.favorite)

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        matchesView &&
        workMatchesFilters(work, filters)
      )
    })

    return [...matches].sort((left, right) => {
      let comparison: number
      if (sort === "rating") {
        comparison =
          (left.calculatedRating ?? -1) - (right.calculatedRating ?? -1)
      } else if (sort === "recent") {
        comparison = left.addedAt - right.addedAt
      } else if (sort === "year") {
        comparison = (left.year ?? 0) - (right.year ?? 0)
      } else {
        comparison = (left.arabicTitle || left.title).localeCompare(
          right.arabicTitle || right.title,
          "ar"
        )
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [
    activeSavedView,
    collectionWorks,
    filters,
    search,
    sort,
    sortDirection,
    view,
  ])

  const selectedWork = works.find((work) => work.id === workId) ?? null

  const favoriteMutation = useMutation({
    mutationFn: setWorkFavorite,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["works"] }),
  })

  const savedViewMutation = useMutation({
    mutationFn: addSavedView,
    onSuccess: async (savedView) => {
      await queryClient.invalidateQueries({ queryKey: ["saved-views"] })
      onSavedViewChange(savedView.id)
    },
  })

  const saveCurrentView = (name: string) => {
    const next: Omit<SavedUserView, "id"> = {
      name,
      layout,
      sort,
      sortDirection,
      kinds: filters.kinds,
      excludedKinds: filters.excludedKinds,
      statuses: filters.statuses,
      excludedStatuses: filters.excludedStatuses,
      minRating: filters.minRating,
      minScores: filters.minScores,
      favoriteOnly: filters.favoriteOnly,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      cardSize,
      gallery: galleryOptions,
      tableDensity,
      facets: filters.facets,
      search,
      visibleColumns: tableColumns,
      isPinned: false,
    }
    savedViewMutation.mutate({ data: next })
  }

  const refreshWorks = async () => {
    await queryClient.invalidateQueries({ queryKey: ["works"] })
  }

  const clearFilters = () => {
    setSearch("")
    setFilters(createDefaultFilters())
    onSavedViewChange()
    onViewChange("all")
  }

  const chooseStandardView = (nextView: LibraryView) => {
    onSavedViewChange()
    onViewChange(nextView)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-20">
        <CollectionToolbar
          collectionId={collectionId}
          onCollectionChange={onCollectionChange}
          activeViewName={activeSavedView?.name}
          search={search}
          onSearchChange={setSearch}
          view={view}
          onViewChange={chooseStandardView}
          layout={layout}
          onLayoutChange={setLayout}
          sort={sort}
          sortDirection={sortDirection}
          onSortChange={setSort}
          onSortDirectionChange={setSortDirection}
          resultCount={filteredWorks.length}
          savedViews={savedViews}
          activeSavedViewId={savedViewId}
          onSavedViewChange={onSavedViewChange}
          onSaveView={saveCurrentView}
          cardSize={cardSize}
          onCardSizeChange={changeCardSize}
          galleryOptions={galleryOptions}
          onGalleryOptionsChange={setGalleryOptions}
          tableColumns={tableColumns}
          onTableColumnsChange={setTableColumns}
          tableDensity={tableDensity}
          onTableDensityChange={setTableDensity}
          timelineNewestFirst={timelineNewestFirst}
          onTimelineOrderChange={setTimelineNewestFirst}
          filter={
            <AdvancedFilter
              filters={filters}
              facetOptions={facetOptions}
              onChange={setFilters}
              matchingCount={filteredWorks.length}
            />
          }
          addWork={<AddWorkDialog onCreated={refreshWorks} />}
        />
      </div>

      <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1600px]">
          {filteredWorks.length === 0 ? (
            <EmptyState clear={clearFilters} />
          ) : layout === "gallery" ? (
            <Gallery
              works={filteredWorks}
              selectedId={workId ?? null}
              onSelect={() => undefined}
              onOpen={(id) => onWorkChange(id)}
              cardSize={cardSize}
              options={galleryOptions}
            />
          ) : layout === "table" ? (
            <WorkTable
              works={filteredWorks}
              selectedId={workId ?? null}
              onOpen={(id) => onWorkChange(id)}
              columns={tableColumns}
              density={tableDensity}
            />
          ) : layout === "timeline" ? (
            <Timeline
              works={filteredWorks}
              onOpen={(id) => onWorkChange(id)}
              newestFirst={timelineNewestFirst}
            />
          ) : (
            <Statistics works={filteredWorks} />
          )}
        </div>
      </main>

      <WorkDetailDialog
        work={selectedWork}
        open={Boolean(selectedWork)}
        onOpenChange={(open) => !open && onWorkChange()}
        toggleFavorite={(work: Work) =>
          favoriteMutation.mutate({
            data: { workId: work.id, favorite: !work.favorite },
          })
        }
        favoritePending={favoriteMutation.isPending}
        openRelated={(id) => onWorkChange(id)}
      />
    </div>
  )
}
