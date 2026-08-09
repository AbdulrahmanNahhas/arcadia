import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { addSavedView, getSavedViews, getWorks, setWorkFavorite } from "@/server/library.functions";
import { EmptyState } from "./components/empty-state";
import { Gallery } from "./components/gallery";
import { GroupedResults } from "./components/grouped-results";
import { LibraryToolbar } from "./components/library-toolbar";
import { Timeline } from "./components/timeline";
import { WideGallery } from "./components/wide-gallery";
import { WorkDetailDialog } from "./components/work-detail-dialog";
import { WorkTable } from "./components/work-table";
import { AdvancedFilter } from "./filter-sheet";
import {
  buildFacetOptions,
  compareWorks,
  createDefaultFilters,
  workMatchesFilters,
} from "./filtering";
import { groupWorks } from "./grouping";
import {
  createDefaultViewState,
  type LibraryViewState,
  viewStateFromSavedView,
} from "./library-state";
import type { SavedUserView, Work } from "./model";

export type { Layout, Sort } from "./view-types";

export function LibraryViewPage({
  viewId,
  workId,
  onViewChange,
  onWorkChange,
  initialState,
  onStateChange,
  embedded = false,
}: {
  viewId?: string;
  workId?: string;
  onViewChange: (viewId?: string) => void;
  onWorkChange: (workId?: string) => void;
  initialState: LibraryViewState | null;
  onStateChange: (state: LibraryViewState) => void;
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  });
  const { data: savedViews } = useSuspenseQuery({
    queryKey: ["saved-views"],
    queryFn: () => getSavedViews(),
  });
  const [viewState, setViewState] = useState<LibraryViewState>(
    () => initialState ?? createDefaultViewState(),
  );
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const {
    search,
    layout,
    sort,
    sortDirection,
    groupBy,
    filters,
    cardSize,
    galleryOptions,
    timelineNewestFirst,
    tableColumns,
    tableDensity,
  } = viewState;

  const activeSavedView = savedViews.find((item) => item.id === viewId);

  useEffect(() => {
    const savedView = savedViews.find((item) => item.id === viewId);
    setViewState(
      initialState ?? (savedView ? viewStateFromSavedView(savedView) : createDefaultViewState()),
    );
  }, [initialState, savedViews, viewId]);

  const updateViewState = (patch: Partial<LibraryViewState>) => {
    const next = { ...viewState, ...patch };
    setViewState(next);
    onStateChange(next);
  };

  const facetOptions = useMemo(() => buildFacetOptions(works), [works]);

  const filteredWorks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const matches = works.filter((work) => {
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
        .toLocaleLowerCase();
      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        workMatchesFilters(work, filters)
      );
    });

    return [...matches].sort((left, right) => compareWorks(left, right, sort, sortDirection));
  }, [works, filters, search, sort, sortDirection]);

  const selectedWork = works.find((work) => work.id === workId) ?? null;

  const favoriteMutation = useMutation({
    mutationFn: setWorkFavorite,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["works"] }),
  });

  const savedViewMutation = useMutation({
    mutationFn: addSavedView,
    onSuccess: async (savedView) => {
      await queryClient.invalidateQueries({ queryKey: ["saved-views"] });
      onViewChange(savedView.id);
    },
  });

  const saveCurrentView = (name: string) => {
    const next: Omit<SavedUserView, "id"> = {
      name,
      description: "",
      icon: "bookmark",
      color: "primary",
      layout,
      sort,
      sortDirection,
      groupBy,
      kinds: filters.kinds,
      excludedKinds: filters.excludedKinds,
      statuses: filters.statuses,
      excludedStatuses: filters.excludedStatuses,
      minRating: filters.minRating,
      minScores: filters.minScores,
      favoriteOnly: filters.favoriteOnly,
      privateOnly: filters.privateOnly,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      cardSize,
      gallery: galleryOptions,
      tableDensity,
      timelineNewestFirst,
      facets: filters.facets,
      search,
      visibleColumns: tableColumns,
      isPinned: false,
    };
    savedViewMutation.mutate({ data: next });
  };

  const clearFilters = () => {
    updateViewState({ search: "", filters: createDefaultFilters() });
    onViewChange();
  };

  const toggleComparison = (workId: string) => {
    setComparisonIds((current) => {
      if (current.includes(workId)) return current.filter((id) => id !== workId);
      return [...current, workId].slice(-6);
    });
  };

  return (
    <div
      className={embedded ? "flex min-h-0 flex-col" : "flex min-h-screen flex-col bg-background"}
    >
      <div className="sticky top-0 z-20">
        <LibraryToolbar
          activeView={activeSavedView}
          search={search}
          onSearchChange={(value) => updateViewState({ search: value })}
          layout={layout}
          onLayoutChange={(value) => updateViewState({ layout: value })}
          sort={sort}
          sortDirection={sortDirection}
          onSortChange={(value) => updateViewState({ sort: value })}
          onSortDirectionChange={(value) => updateViewState({ sortDirection: value })}
          groupBy={groupBy}
          onGroupByChange={(value) => updateViewState({ groupBy: value })}
          resultCount={filteredWorks.length}
          savedViews={savedViews}
          onSavedViewChange={onViewChange}
          onSaveView={saveCurrentView}
          cardSize={cardSize}
          onCardSizeChange={(value) => updateViewState({ cardSize: value })}
          galleryOptions={galleryOptions}
          onGalleryOptionsChange={(value) => updateViewState({ galleryOptions: value })}
          tableColumns={tableColumns}
          onTableColumnsChange={(value) => updateViewState({ tableColumns: value })}
          tableDensity={tableDensity}
          onTableDensityChange={(value) => updateViewState({ tableDensity: value })}
          timelineNewestFirst={timelineNewestFirst}
          onTimelineOrderChange={(value) => updateViewState({ timelineNewestFirst: value })}
          filter={
            <AdvancedFilter
              filters={filters}
              facetOptions={facetOptions}
              onChange={(value) => updateViewState({ filters: value })}
              matchingCount={filteredWorks.length}
            />
          }
        />
      </div>

      <main className={embedded ? "flex-1 p-5" : "flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7"}>
        <div className="mx-auto max-w-[1600px]">
          {filteredWorks.length === 0 ? (
            <EmptyState clear={clearFilters} />
          ) : layout === "gallery" || layout === "wide" || layout === "table" ? (
            <GroupedResults
              groups={groupWorks(filteredWorks, groupBy)}
              grouped={groupBy !== "none"}
            >
              {(group) =>
                layout === "gallery" ? (
                  <Gallery
                    works={group.works}
                    selectedId={workId ?? null}
                    onSelect={() => undefined}
                    onOpen={(id) => onWorkChange(id)}
                    cardSize={cardSize}
                    options={galleryOptions}
                  />
                ) : layout === "wide" ? (
                  <WideGallery
                    works={group.works}
                    onOpen={(id) => onWorkChange(id)}
                    cardSize={cardSize}
                    options={galleryOptions}
                  />
                ) : (
                  <WorkTable
                    works={group.works}
                    selectedId={workId ?? null}
                    onOpen={(id) => onWorkChange(id)}
                    columns={tableColumns}
                    density={tableDensity}
                    sort={sort}
                    sortDirection={sortDirection}
                    onSortChange={(nextSort, nextDirection) =>
                      updateViewState({ sort: nextSort, sortDirection: nextDirection })
                    }
                  />
                )
              }
            </GroupedResults>
          ) : (
            <Timeline
              works={filteredWorks}
              onOpen={(id) => onWorkChange(id)}
              newestFirst={timelineNewestFirst}
            />
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
        comparisonIds={comparisonIds}
        toggleComparison={toggleComparison}
      />
    </div>
  );
}
