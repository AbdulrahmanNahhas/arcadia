import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { Link } from "@tanstack/react-router"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  ArrowsDownUpIcon,
  BookmarkSimpleIcon,
  CornersInIcon,
  CornersOutIcon,
  FadersHorizontalIcon,
  FloppyDiskIcon,
  ArrowsOutIcon,
  BooksIcon,
  CalendarBlankIcon,
  ChartDonutIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  GridFourIcon,
  GearSixIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PlusIcon,
  RowsIcon,
  SparkleIcon,
  SquaresFourIcon,
  StarIcon,
  SunIcon,
  TableIcon,
  XIcon,
  MinusIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  addSavedView,
  getSavedViews,
  getWorks,
  removeSavedView,
  setWorkFavorite,
} from "@/server/library.functions"
import { cn } from "@/lib/utils"
import { AdvancedFilter } from "./filter-sheet"
import {
  buildFacetOptions,
  countFacetFilters,
  createEmptyFacetFilters,
  kindLabels,
  normalizeFacetFilters,
  workMatchesFilters,
} from "./filtering"
import type { FacetFilters, WorkFilterState } from "./filtering"
import type { Work, WorkKind } from "./model"
import { scoreLabel, type ScoreCriterion } from "./scoring"
import { Badge } from "@/components/ui/badge"
import { AddWorkDialog as LibraryAddWorkDialog } from "./components/add-work-dialog"
import { EmptyState as LibraryEmptyState } from "./components/empty-state"
import { Gallery as LibraryGallery } from "./components/gallery"
import { Inspector as LibraryInspector } from "./components/inspector"
import { Statistics as LibraryStatistics } from "./components/statistics"
import { Timeline as LibraryTimeline } from "./components/timeline"
import { WorkTable as LibraryWorkTable } from "./components/work-table"
import { WorkArtwork } from "./components/work-artwork"
import { WorkDetailDialog as LibraryWorkDetailDialog } from "./components/work-detail-dialog"

type Layout = "gallery" | "table" | "timeline" | "statistics"
type SavedView = "all" | "progress" | "favorites" | "recent"
type Sort = "title" | "rating" | "recent" | "year"
type CardMode = "cover" | "title" | "full"

type GalleryOptions = {
  mode: CardMode
  imageType: "poster" | "logo"
  showType: boolean
  showRating: boolean
}

type SavedUserView = {
  id: string
  name: string
  layout: Layout
  sort: Sort
  kinds: WorkKind[]
  excludedKinds?: WorkKind[]
  statuses: Work["status"][]
  excludedStatuses?: Work["status"][]
  minRating: number
  favoriteOnly: boolean
  yearFrom: number | null
  yearTo: number | null
  cardSize: number
  gallery: GalleryOptions
  facets?: FacetFilters
  sortDirection: "asc" | "desc"
  search: string
  visibleColumns: string[]
  isPinned: boolean
}

const defaultGalleryOptions: GalleryOptions = {
  mode: "full",
  imageType: "poster",
  showType: true,
  showRating: true,
}

const viewItems = [
  { id: "all" as const, label: "كل الأعمال", icon: SquaresFourIcon },
  {
    id: "progress" as const,
    label: "قيد المتابعة",
    icon: ClockCounterClockwiseIcon,
  },
  { id: "favorites" as const, label: "المفضلة", icon: HeartIcon },
  { id: "recent" as const, label: "المضافة حديثاً", icon: SparkleIcon },
]

const layoutItems = [
  { id: "gallery" as const, label: "المعرض", icon: GridFourIcon },
  { id: "table" as const, label: "الجدول", icon: TableIcon },
  { id: "timeline" as const, label: "الخط الزمني", icon: CalendarBlankIcon },
  { id: "statistics" as const, label: "الإحصاءات", icon: ChartDonutIcon },
]

const sortLabels: Record<Sort, string> = {
  title: "العنوان",
  rating: "التقييم",
  recent: "الأحدث",
  year: "السنة",
}

const columnLabels: Record<string, string> = {
  type: "النوع",
  year: "السنة",
  status: "الحالة",
  genres: "التصنيفات",
  progress: "التقدم",
  rating: "التقييم",
}

function progressText(work: Work) {
  if (work.status === "completed" && !work.progressTotal) return "مكتمل"
  if (!work.progressTotal)
    return work.progress ? `${work.progress} ${work.progressUnit}` : "لم يبدأ"
  return `${work.progress} / ${work.progressTotal} ${work.progressUnit}`
}

function usesProgress(work: Work) {
  return (
    work.kind !== "manga" && work.kind !== "novel" && Boolean(work.progressUnit)
  )
}

function relationLabel(relation: Work["relations"][number]) {
  if (relation.relationType === "adaptation")
    return relation.direction === "outgoing" ? "مقتبس من" : "اقتباس"
  if (relation.relationType === "prequel")
    return relation.direction === "outgoing" ? "سابقة" : "تكملة"
  if (relation.relationType === "sequel")
    return relation.direction === "outgoing" ? "تكملة" : "سابقة"
  return relation.relationType.replace("-", " ")
}

function progressPercent(work: Work) {
  if (!work.progressTotal) return 0
  return Math.min(100, Math.round((work.progress / work.progressTotal) * 100))
}

export function LibraryApp() {
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
  const [activeView, setActiveView] = useState<SavedView>("all")
  const [layout, setLayout] = useState<Layout>("gallery")
  const [sort, setSort] = useState<Sort>("title")
  const [kindFilter, setKindFilter] = useState<WorkKind[]>([])
  const [excludedKindFilter, setExcludedKindFilter] = useState<WorkKind[]>([])
  const [statusFilter, setStatusFilter] = useState<Work["status"][]>([])
  const [excludedStatusFilter, setExcludedStatusFilter] = useState<
    Work["status"][]
  >([])
  const [minRating, setMinRating] = useState(0)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [yearFrom, setYearFrom] = useState<number | null>(null)
  const [yearTo, setYearTo] = useState<number | null>(null)
  const [facetFilters, setFacetFilters] = useState<FacetFilters>(() =>
    createEmptyFacetFilters()
  )
  const [activeCollection, setActiveCollection] = useState<
    "books" | "screen" | null
  >(null)
  const [cardSize, setCardSize] = useState(142)
  const [galleryOptions, setGalleryOptions] = useState<GalleryOptions>(
    defaultGalleryOptions
  )
  const [tableColumns, setTableColumns] = useState([
    "type",
    "year",
    "status",
    "genres",
    "rating",
  ])
  const [timelineNewestFirst, setTimelineNewestFirst] = useState(true)
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(
    null
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const stored = window.localStorage.getItem("arcadia:gallery-card-size")
    if (stored) setCardSize(Math.min(220, Math.max(110, Number(stored))))
    const storedTheme = window.localStorage.getItem("arcadia:theme")
    const nextTheme = storedTheme === "dark" ? "dark" : "light"
    setTheme(nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
    setSidebarOpen(
      window.localStorage.getItem("arcadia:sidebar-open") !== "false"
    )
    setFocusMode(window.localStorage.getItem("arcadia:focus-mode") === "true")
    try {
      const storedGallery = JSON.parse(
        window.localStorage.getItem("arcadia:gallery-options") ?? "null"
      ) as GalleryOptions | null
      if (storedGallery) setGalleryOptions(storedGallery)
    } catch {
      // Ignore malformed local preferences and use safe defaults.
    }
  }, [])

  useEffect(() => {
    const workId = window.location.hash.startsWith("#work=")
      ? decodeURIComponent(window.location.hash.slice(6))
      : null
    if (workId && works.some((work) => work.id === workId)) {
      setSelectedId(workId)
      setDetailOpen(true)
    }
  }, [works])

  function changeCardSize(value: number) {
    setCardSize(value)
    window.localStorage.setItem("arcadia:gallery-card-size", String(value))
  }

  function changeGalleryOptions(next: GalleryOptions) {
    setGalleryOptions(next)
    window.localStorage.setItem("arcadia:gallery-options", JSON.stringify(next))
  }

  function changeSidebarOpen(open: boolean) {
    setSidebarOpen(open)
    window.localStorage.setItem("arcadia:sidebar-open", String(open))
    document.documentElement.dataset.sidebarOpen = String(open)
  }

  function changeFocusMode(enabled: boolean) {
    setFocusMode(enabled)
    window.localStorage.setItem("arcadia:focus-mode", String(enabled))
    document.documentElement.dataset.focusMode = String(enabled)
    if (enabled) setInspectorOpen(false)
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    window.localStorage.setItem("arcadia:theme", nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
    document.documentElement.style.colorScheme = nextTheme
  }

  const filterState = useMemo<WorkFilterState>(
    () => ({
      kinds: kindFilter,
      excludedKinds: excludedKindFilter,
      statuses: statusFilter,
      excludedStatuses: excludedStatusFilter,
      minRating,
      favoriteOnly,
      yearFrom,
      yearTo,
      facets: facetFilters,
    }),
    [
      excludedKindFilter,
      excludedStatusFilter,
      facetFilters,
      favoriteOnly,
      kindFilter,
      minRating,
      statusFilter,
      yearFrom,
      yearTo,
    ]
  )

  function changeFilters(next: WorkFilterState) {
    setKindFilter(next.kinds)
    setExcludedKindFilter(next.excludedKinds)
    setStatusFilter(next.statuses)
    setExcludedStatusFilter(next.excludedStatuses)
    setMinRating(next.minRating)
    setFavoriteOnly(next.favoriteOnly)
    setYearFrom(next.yearFrom)
    setYearTo(next.yearTo)
    setFacetFilters(next.facets)
    setActiveSavedViewId(null)
  }

  const filteredWorks = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase()
    const next = works.filter((work) => {
      const matchesSearch =
        !normalized ||
        [
          work.title,
          work.arabicTitle ?? "",
          work.creator,
          work.summary,
          ...work.tags,
          ...work.genres,
          ...work.aliases,
          ...work.studios,
          ...work.credits.map(({ name, role }) => `${name} ${role}`),
          ...work.tone,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized)
      const matchesView =
        activeView === "all" ||
        (activeView === "progress" && work.status === "in-progress") ||
        (activeView === "favorites" && work.favorite) ||
        (activeView === "recent" && Date.now() / 1000 - work.addedAt < 86_400)
      return (
        matchesSearch && workMatchesFilters(work, filterState) && matchesView
      )
    })

    return [...next].sort((a, b) => {
      if (sort === "rating")
        return (b.calculatedRating ?? -1) - (a.calculatedRating ?? -1)
      if (sort === "recent") return b.addedAt - a.addedAt
      if (sort === "year") return (b.year ?? 0) - (a.year ?? 0)
      return a.title.localeCompare(b.title)
    })
  }, [activeView, filterState, search, sort, works])

  const facetOptions = useMemo(() => buildFacetOptions(works), [works])

  const selectedWork =
    works.find((work) => work.id === selectedId) ?? filteredWorks.at(0) ?? null

  const activeSavedView = savedViews.find(
    (view) => view.id === activeSavedViewId
  )
  const displayTitle = activeSavedView
    ? activeSavedView.name
    : activeCollection === "books"
      ? "الكتب والقصص المصورة"
      : activeCollection === "screen"
        ? "الشاشة والألعاب"
        : (viewItems.find((item) => item.id === activeView)?.label ??
          "كل الأعمال")

  function chooseView(view: SavedView) {
    setActiveSavedViewId(null)
    setActiveView(view)
    setActiveCollection(null)
    setKindFilter([])
    setExcludedKindFilter([])
    setStatusFilter([])
    setExcludedStatusFilter([])
    setMinRating(0)
    setFavoriteOnly(false)
    setYearFrom(null)
    setYearTo(null)
    setSearch("")
    setFacetFilters(createEmptyFacetFilters())
  }

  function chooseCollection(collection: "books" | "screen") {
    setActiveSavedViewId(null)
    setActiveCollection(collection)
    setActiveView("all")
    setSearch("")
    setKindFilter(
      collection === "books"
        ? ["novel", "manga", "comic", "visual-novel"]
        : ["movie", "series", "anime", "game"]
    )
    setExcludedKindFilter([])
    setStatusFilter([])
    setExcludedStatusFilter([])
    setFacetFilters(createEmptyFacetFilters())
  }

  function saveCurrentView(name: string) {
    const next: Omit<SavedUserView, "id"> = {
      name,
      layout,
      sort,
      sortDirection: sort === "title" ? "asc" : "desc",
      kinds: kindFilter,
      excludedKinds: excludedKindFilter,
      statuses: statusFilter,
      excludedStatuses: excludedStatusFilter,
      minRating,
      favoriteOnly,
      yearFrom,
      yearTo,
      cardSize,
      gallery: galleryOptions,
      facets: facetFilters,
      search,
      visibleColumns: tableColumns,
      isPinned: false,
    }
    savedViewMutation.mutate({ data: next })
  }

  function applySavedView(view: SavedUserView) {
    setActiveSavedViewId(view.id)
    setLayout(view.layout)
    setSort(view.sort)
    setKindFilter(view.kinds)
    setExcludedKindFilter(view.excludedKinds ?? [])
    setStatusFilter(view.statuses)
    setExcludedStatusFilter(view.excludedStatuses ?? [])
    setMinRating(view.minRating)
    setFavoriteOnly(view.favoriteOnly)
    setYearFrom(view.yearFrom)
    setYearTo(view.yearTo)
    changeCardSize(view.cardSize)
    changeGalleryOptions(view.gallery)
    setFacetFilters(normalizeFacetFilters(view.facets))
    setActiveView("all")
    setActiveCollection(null)
    setSearch(view.search)
    setTableColumns(view.visibleColumns)
  }

  function deleteSavedView(id: string) {
    deleteSavedViewMutation.mutate({ data: { id } })
    if (activeSavedViewId === id) setActiveSavedViewId(null)
  }

  function openWork(id: string) {
    setSelectedId(id)
    setDetailOpen(true)
    window.history.replaceState(null, "", `#work=${encodeURIComponent(id)}`)
  }

  function changeDetailOpen(open: boolean) {
    setDetailOpen(open)
    if (!open && window.location.hash.startsWith("#work=")) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      )
    }
  }

  const favoriteMutation = useMutation({
    mutationFn: setWorkFavorite,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["works"] }),
  })

  const savedViewMutation = useMutation({
    mutationFn: addSavedView,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["saved-views"] }),
  })

  const deleteSavedViewMutation = useMutation({
    mutationFn: removeSavedView,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["saved-views"] }),
  })

  async function handleCreated() {
    await queryClient.invalidateQueries({ queryKey: ["works"] })
  }

  return (
    <SidebarProvider
      className={cn(
        "min-h-screen bg-background font-sans antialiased",
        focusMode && "focus-mode"
      )}
      style={
        {
          "--sidebar-width": "220px",
          "--sidebar-width-icon": "55px",
        } as CSSProperties
      }
      open={sidebarOpen}
      onOpenChange={changeSidebarOpen}
    >
      {/* --- SIDEBAR --- */}
      {!focusMode && (
        <AppSidebar
          activeView={activeView}
          activeCollection={activeCollection}
          total={works.length}
          savedViews={savedViews}
          activeSavedViewId={activeSavedViewId}
          onViewChange={chooseView}
          onCollectionChange={chooseCollection}
          onSavedViewChange={applySavedView}
          onSavedViewDelete={deleteSavedView}
        />
      )}

      {/* --- MAIN WORKSPACE INSET --- */}
      <SidebarInset className="flex h-screen flex-1 flex-col overflow-hidden bg-background">
        {/* --- STICKY UNIFIED HEADER --- */}
        <header className="z-10 flex flex-col border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          {/* Level 1: Breadcrumbs & App Status Bar */}
          {!focusMode && (
            <div className="flex h-12 items-center justify-between gap-1 border-b border-border/40 px-4 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <SidebarTrigger className="-ml-1 h-7 w-7" />
                <div className="flex items-center gap-1.5 font-medium">
                  <span>المكتبة</span>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="font-semibold text-foreground">
                    {displayTitle}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  className="h-7 text-xs"
                  render={<Link to="/feed">النشاط</Link>}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  className="h-7 text-xs"
                  render={<Link to="/admin">الإدارة</Link>}
                />

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={toggleTheme}
                        aria-label={
                          theme === "light"
                            ? "استخدام الوضع الداكن"
                            : "استخدام الوضع الفاتح"
                        }
                      >
                        {theme === "light" ? (
                          <MoonIcon className="h-3.5 w-3.5" />
                        ) : (
                          <SunIcon className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {theme === "light" ? "الوضع الداكن" : "الوضع الفاتح"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Level 2: Layout Switcher, Search Bar & Actions */}
          <div className="flex items-center justify-between gap-3 border-b border-border/40 p-3">
            {/* Layout Segmented Control */}
            <div className="flex items-center rounded-lg border border-border/50 bg-muted/60 p-1">
              {layoutItems.map((item) => {
                const Icon = item.icon
                const isActive = layout === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLayout(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all",
                      isActive
                        ? "bg-background font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Global Search */}
            <div className="relative max-w-md flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في العناوين والوسوم والأشخاص…"
                aria-label="البحث في المكتبة"
                className="h-8 border-border/60 bg-muted/30 pr-8 pl-9 text-xs transition-colors focus-visible:bg-background"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="مسح البحث"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* View Actions Toolbar */}
            <div className="flex items-center gap-1.5">
              <LibraryAddWorkDialog onCreated={handleCreated} />

              <ViewSettings
                layout={layout}
                gallery={galleryOptions}
                onGalleryChange={changeGalleryOptions}
                cardSize={cardSize}
                onCardSizeChange={changeCardSize}
                tableColumns={tableColumns}
                onTableColumnsChange={setTableColumns}
                timelineNewestFirst={timelineNewestFirst}
                onTimelineOrderChange={setTimelineNewestFirst}
              />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={inspectorOpen ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      aria-label="إظهار أو إخفاء التفاصيل"
                      onClick={() => setInspectorOpen((value) => !value)}
                    >
                      <RowsIcon className="h-4 w-4" />
                    </Button>
                  }
                />
                <TooltipContent>إظهار أو إخفاء التفاصيل</TooltipContent>
              </Tooltip>

              {!focusMode && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => changeFocusMode(true)}
                        aria-label="توسيع العرض"
                      >
                        <CornersOutIcon className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>وضع التركيز</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Level 3: Filters, Sort Dropdown & Active Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <AdvancedFilter
                filters={filterState}
                facetOptions={facetOptions}
                onChange={changeFilters}
                matchingCount={filteredWorks.length}
              />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-border/60 text-xs font-normal"
                    >
                      <ArrowsDownUpIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      الترتيب:{" "}
                      <span className="font-medium">{sortLabels[sort]}</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs">
                      ترتيب الأعمال حسب
                    </DropdownMenuLabel>
                    {(["title", "rating", "recent", "year"] as const).map(
                      (option) => (
                        <DropdownMenuItem
                          key={option}
                          onClick={() => setSort(option)}
                          className="justify-between text-xs"
                        >
                          <span>{sortLabels[option]}</span>
                          {sort === option && (
                            <CheckIcon className="h-3.5 w-3.5 text-primary" />
                          )}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {layout === "gallery" && (
                <CardSizeControl value={cardSize} onChange={changeCardSize} />
              )}

              <SavedViewsControl
                views={savedViews}
                onSave={saveCurrentView}
                onApply={applySavedView}
                onDelete={deleteSavedView}
              />

              {/* Active Filter Badges */}
              {(kindFilter.length > 0 || excludedKindFilter.length > 0) && (
                <div className="ml-1 flex flex-wrap items-center gap-1.5 border-l border-border/60 pl-2">
                  {kindFilter.map((kind) => (
                    <Badge
                      key={kind}
                      variant="secondary"
                      className="gap-1 pr-1 text-xs font-normal transition-colors hover:bg-secondary/80"
                    >
                      {kindLabels[kind]}
                      <button
                        type="button"
                        onClick={() =>
                          setKindFilter((items) =>
                            items.filter((item) => item !== kind)
                          )
                        }
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}

                  {excludedKindFilter.map((kind) => (
                    <Badge
                      key={`not-${kind}`}
                      variant="outline"
                      className="gap-1 border-destructive/20 bg-destructive/10 pr-1 text-xs font-normal text-destructive hover:bg-destructive/20"
                    >
                      ليس {kindLabels[kind]}
                      <button
                        type="button"
                        onClick={() =>
                          setExcludedKindFilter((items) =>
                            items.filter((item) => item !== kind)
                          )
                        }
                        className="rounded-full p-0.5 hover:bg-destructive/20"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Results Count & Focus Exit Action */}
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">
                {filteredWorks.length}{" "}
                {filteredWorks.length === 1 ? "عنصر" : "عناصر"}
              </span>

              {focusMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-border/60 text-xs"
                  onClick={() => changeFocusMode(false)}
                >
                  <CornersInIcon className="h-3.5 w-3.5" /> إنهاء التركيز
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* --- MAIN CONTENT & INSPECTOR --- */}
        <div className="relative z-10 flex flex-1 overflow-hidden bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
              {filteredWorks.length === 0 ? (
                <LibraryEmptyState
                  clear={() => {
                    setSearch("")
                    setKindFilter([])
                    setExcludedKindFilter([])
                    setStatusFilter([])
                    setExcludedStatusFilter([])
                    setFacetFilters(createEmptyFacetFilters())
                    setActiveView("all")
                  }}
                />
              ) : layout === "gallery" ? (
                <LibraryGallery
                  works={filteredWorks}
                  selectedId={selectedWork?.id ?? null}
                  onSelect={setSelectedId}
                  onOpen={openWork}
                  cardSize={cardSize}
                  options={galleryOptions}
                />
              ) : layout === "table" ? (
                <LibraryWorkTable
                  works={filteredWorks}
                  selectedId={selectedWork?.id ?? null}
                  onOpen={openWork}
                  columns={tableColumns}
                />
              ) : layout === "timeline" ? (
                <LibraryTimeline
                  works={filteredWorks}
                  onOpen={openWork}
                  newestFirst={timelineNewestFirst}
                />
              ) : (
                <LibraryStatistics works={filteredWorks} />
              )}
            </div>
          </main>

          {/* Inspector Panel Drawer */}
          {inspectorOpen && selectedWork && (
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border/60 bg-card/60 shadow-sm backdrop-blur-sm lg:block">
              <LibraryInspector
                work={selectedWork}
                close={() => setInspectorOpen(false)}
                open={() => openWork(selectedWork.id)}
              />
            </aside>
          )}
        </div>

        {/* --- WORK DETAIL DIALOG --- */}
        <LibraryWorkDetailDialog
          work={selectedWork}
          open={detailOpen}
          onOpenChange={changeDetailOpen}
          toggleFavorite={(work) =>
            favoriteMutation.mutate({
              data: { workId: work.id, favorite: !work.favorite },
            })
          }
          favoritePending={favoriteMutation.isPending}
          openRelated={openWork}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppSidebar({
  activeView,
  activeCollection,
  total,
  savedViews,
  activeSavedViewId,
  onViewChange,
  onCollectionChange,
  onSavedViewChange,
  onSavedViewDelete,
}: {
  activeView: SavedView
  activeCollection: "books" | "screen" | null
  total: number
  savedViews: SavedUserView[]
  activeSavedViewId: string | null
  onViewChange: (view: SavedView) => void
  onCollectionChange: (collection: "books" | "screen") => void
  onSavedViewChange: (view: SavedUserView) => void
  onSavedViewDelete: (id: string) => void
}) {
  return (
    <ShadcnSidebar side="right" variant="sidebar" collapsible="icon">
      {/* Brand Header */}
      <SidebarHeader className="pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="مكتبة أركاديا"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <BooksIcon className="size-4" weight="duotone" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-sidebar-foreground">
                  Arcadia
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  مكتبة محلية
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation Group */}
        <SidebarGroup>
          <SidebarGroupLabel>المكتبة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {viewItems.map((item) => (
                <SidebarMenuItem
                  className="flex items-center justify-center p-0!"
                  key={item.id}
                >
                  <SidebarMenuButton
                    type="button"
                    tooltip={item.label}
                    isActive={!activeCollection && activeView === item.id}
                    onClick={() => onViewChange(item.id)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.id === "all" && (
                    <SidebarMenuBadge className="absolute top-1/2! -translate-y-1/2! border border-primary/25 bg-primary/20 font-mono text-[10px] text-primary-foreground!">
                      {total}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Media Groups */}
        <SidebarGroup>
          <SidebarGroupLabel>مجموعات الوسائط</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  tooltip="الكتب والقصص المصورة"
                  isActive={activeCollection === "books"}
                  onClick={() => onCollectionChange("books")}
                >
                  <BooksIcon className="h-4 w-4" />
                  <span>الكتب والقصص المصورة</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  tooltip="الشاشة والألعاب"
                  isActive={activeCollection === "screen"}
                  onClick={() => onCollectionChange("screen")}
                >
                  <SquaresFourIcon className="h-4 w-4" />
                  <span>الشاشة والألعاب</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Saved Views */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex w-full items-center justify-between">
            <span>العروض المحفوظة</span>
            {savedViews.length > 0 && (
              <span className="ml-auto font-mono text-[10px] text-sidebar-foreground/60">
                {savedViews.length}
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {savedViews.length > 0 ? (
              <SidebarMenu>
                {savedViews.map((view) => (
                  <SidebarMenuItem
                    key={view.id}
                    className="group/item relative"
                  >
                    <SidebarMenuButton
                      type="button"
                      tooltip={view.name}
                      isActive={activeSavedViewId === view.id}
                      onClick={() => onSavedViewChange(view)}
                      className="pr-8"
                    >
                      <BookmarkSimpleIcon
                        className="h-4 w-4"
                        weight={
                          activeSavedViewId === view.id ? "fill" : "regular"
                        }
                      />
                      <span className="truncate">{view.name}</span>
                    </SidebarMenuButton>
                    <button
                      type="button"
                      className="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/50 opacity-0 transition-all group-hover/item:opacity-100 group-data-[collapsible=icon]:hidden hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onSavedViewDelete(view.id)}
                      aria-label={`حذف ${view.name}`}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <p className="px-2 py-1.5 text-xs leading-relaxed text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                احفظ عرضاً مفلترًا ليبقى متاحاً هنا بنقرة واحدة.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="group-data-[collapsible=icon]:m-1"
              render={<Link to="/admin" />}
              tooltip="إدارة قاعدة البيانات"
            >
              <GearSixIcon className="h-4 w-4" />
              <span>إدارة قاعدة البيانات</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  )
}

function CardSizeControl({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/60 text-xs"
          >
            <GridFourIcon className="h-3.5 w-3.5 text-muted-foreground" />
            الحجم
          </Button>
        }
      />
      <PopoverContent align="start" className="w-64 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">حجم بطاقات المعرض</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {value}px
          </span>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            aria-label="بطاقات أصغر"
            onClick={() => onChange(Math.max(110, value - 10))}
          >
            <MinusIcon className="h-3.5 w-3.5" />
          </Button>

          <Slider
            value={[value]}
            min={110}
            max={220}
            step={2}
            className="flex-1 cursor-grab active:cursor-grabbing"
            onValueChange={(nextValue) =>
              onChange(
                typeof nextValue === "number"
                  ? nextValue
                  : (nextValue[0] ?? value)
              )
            }
          />

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            aria-label="بطاقات أكبر"
            onClick={() => onChange(Math.min(220, value + 10))}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          يُحفظ محلياً ويُطبّق على هذا المعرض.
        </p>
      </PopoverContent>
    </Popover>
  )
}

function ViewSettings({
  layout,
  gallery,
  onGalleryChange,
  cardSize,
  onCardSizeChange,
  tableColumns,
  onTableColumnsChange,
  timelineNewestFirst,
  onTimelineOrderChange,
}: {
  layout: Layout
  gallery: GalleryOptions
  onGalleryChange: (options: GalleryOptions) => void
  cardSize: number
  onCardSizeChange: (size: number) => void
  tableColumns: string[]
  onTableColumnsChange: (columns: string[]) => void
  timelineNewestFirst: boolean
  onTimelineOrderChange: (value: boolean) => void
}) {
  const toggleColumn = (column: string) =>
    onTableColumnsChange(
      tableColumns.includes(column)
        ? tableColumns.filter((item) => item !== column)
        : [...tableColumns, column]
    )
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="إعدادات العرض" />
        }
      >
        <FadersHorizontalIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <div className="border-b bg-muted/30 px-4 py-3">
          <strong className="block text-sm font-semibold capitalize">
            إعدادات {layoutItems.find((item) => item.id === layout)?.label}
          </strong>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            تُحفظ مع العروض المخصصة
          </span>
        </div>
        <div className="space-y-5 p-4">
          {layout === "gallery" ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium">محتوى البطاقة</label>
                <div className="grid grid-cols-3 rounded-lg bg-muted p-1">
                  {(["cover", "title", "full"] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition",
                        gallery.mode === mode &&
                          "bg-background font-medium text-foreground shadow-sm"
                      )}
                      onClick={() => onGalleryChange({ ...gallery, mode })}
                    >
                      {mode === "cover"
                        ? "الغلاف فقط"
                        : mode === "title"
                          ? "الغلاف والعنوان"
                          : "كامل"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">الصورة</label>
                <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs text-muted-foreground transition",
                      gallery.imageType === "poster" &&
                        "bg-background font-medium text-foreground shadow-sm"
                    )}
                    onClick={() =>
                      onGalleryChange({ ...gallery, imageType: "poster" })
                    }
                  >
                    الملصق
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs text-muted-foreground transition",
                      gallery.imageType === "logo" &&
                        "bg-background font-medium text-foreground shadow-sm"
                    )}
                    onClick={() =>
                      onGalleryChange({ ...gallery, imageType: "logo" })
                    }
                  >
                    الشعار
                  </button>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">شارة النوع</span>
                <Switch
                  checked={gallery.showType}
                  onCheckedChange={(showType) =>
                    onGalleryChange({ ...gallery, showType })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">شارة التقييم</span>
                <Switch
                  checked={gallery.showRating}
                  onCheckedChange={(showRating) =>
                    onGalleryChange({ ...gallery, showRating })
                  }
                />
              </label>
              <div className="space-y-3 border-t pt-4">
                <label className="flex items-center justify-between text-xs font-medium">
                  حجم البطاقة{" "}
                  <em className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground not-italic">
                    {cardSize}px
                  </em>
                </label>
                <Slider
                  value={cardSize}
                  min={110}
                  max={220}
                  step={2}
                  onValueChange={(value) =>
                    onCardSizeChange(
                      typeof value === "number" ? value : (value[0] ?? cardSize)
                    )
                  }
                />
              </div>
            </>
          ) : null}
          {layout === "table" ? (
            <div className="space-y-3">
              <label className="text-xs font-medium">الأعمدة الظاهرة</label>
              <div className="grid grid-cols-2 gap-1.5">
                {["type", "year", "status", "genres", "progress", "rating"].map(
                  (column) => (
                    <button
                      type="button"
                      key={column}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs text-muted-foreground capitalize transition hover:bg-accent/40",
                        tableColumns.includes(column) &&
                          "border-primary/30 bg-primary/5 font-medium text-foreground"
                      )}
                      onClick={() => toggleColumn(column)}
                    >
                      <i className="flex size-4 items-center justify-center rounded border bg-background">
                        {tableColumns.includes(column) ? <CheckIcon /> : null}
                      </i>
                      <span>{columnLabels[column]}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          ) : null}
          {layout === "timeline" ? (
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">السنوات الأحدث أولاً</span>
              <Switch
                checked={timelineNewestFirst}
                onCheckedChange={onTimelineOrderChange}
              />
            </label>
          ) : null}
          {layout === "statistics" ? (
            <p className="text-xs leading-5 text-muted-foreground">
              تعكس الإحصاءات البحث والفلاتر الحالية تلقائياً.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SavedViewsControl({
  views,
  onSave,
  onApply,
  onDelete,
}: {
  views: SavedUserView[]
  onSave: (name: string) => void
  onApply: (view: SavedUserView) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState("")

  const save = () => {
    if (name.trim()) {
      onSave(name)
      setName("")
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/60 text-xs"
          >
            <FloppyDiskIcon className="h-3.5 w-3.5 text-muted-foreground" />
            العروض
            {views.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 px-1 font-mono text-[10px]"
              >
                {views.length}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80 overflow-hidden p-0">
        <div className="border-b border-border/40 bg-muted/30 p-3">
          <strong className="mb-0.5 block text-sm font-medium">
            العروض المحفوظة
          </strong>
          <span className="block text-xs text-muted-foreground">
            احفظ البحث والفلاتر والتخطيط كاملاً
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-border/40 p-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save()
            }}
            placeholder="اسم العرض…"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={save}
            disabled={!name.trim()}
          >
            حفظ
          </Button>
        </div>

        {views.length > 0 ? (
          <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto p-1.5">
            {views.map((view) => (
              <div
                key={view.id}
                className="group flex items-center justify-between rounded-md p-1.5 transition-colors hover:bg-muted/60"
              >
                <button
                  type="button"
                  onClick={() => onApply(view)}
                  className="flex flex-1 flex-col items-start px-1 text-left"
                >
                  <span className="text-sm font-medium text-foreground">
                    {view.name}
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    {layoutItems.find((item) => item.id === view.layout)?.label}{" "}
                    ·{" "}
                    {view.kinds.length +
                      (view.excludedKinds?.length ?? 0) +
                      view.statuses.length +
                      (view.excludedStatuses?.length ?? 0) +
                      countFacetFilters(
                        normalizeFacetFilters(view.facets)
                      )}{" "}
                    فلاتر
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(view.id)}
                  aria-label={`حذف ${view.name}`}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              لا توجد عروض مخصصة بعد. اضبط هذا العرض ثم احفظه هنا.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* Replaced by the shared filter-sheet module.
function AdvancedFilter({
  kinds,
  onKindsChange,
  statuses,
  onStatusesChange,
  minRating,
  onMinRatingChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  yearFrom,
  yearTo,
  onYearRangeChange,
  facets,
  facetOptions,
  onFacetsChange,
  matchingCount,
}: {
  kinds: WorkKind[]
  onKindsChange: (kinds: WorkKind[]) => void
  statuses: Work["status"][]
  onStatusesChange: (statuses: Work["status"][]) => void
  minRating: number
  onMinRatingChange: (rating: number) => void
  favoriteOnly: boolean
  onFavoriteOnlyChange: (value: boolean) => void
  yearFrom: number | null
  yearTo: number | null
  onYearRangeChange: (from: number | null, to: number | null) => void
  facets: FacetFilters
  facetOptions: FacetOptions
  onFacetsChange: (facets: FacetFilters) => void
  matchingCount: number
}) {
  const [facetSearch, setFacetSearch] = useState("")
  const toggleKind = (kind: WorkKind) =>
    onKindsChange(
      kinds.includes(kind)
        ? kinds.filter((item) => item !== kind)
        : [...kinds, kind]
    )
  const toggleStatus = (status: Work["status"]) =>
    onStatusesChange(
      statuses.includes(status)
        ? statuses.filter((item) => item !== status)
        : [...statuses, status]
    )
  const toggleFacet = (key: keyof FacetFilters, value: string) => {
    const selected = facets[key]
    onFacetsChange({
      ...facets,
      [key]: selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    })
  }
  const facetCount = Object.values(facets).reduce(
    (total, values) => total + values.length,
    0
  )
  const activeCount =
    kinds.length +
    statuses.length +
    facetCount +
    Number(minRating > 0) +
    Number(favoriteOnly) +
    Number(yearFrom !== null || yearTo !== null)
  const clear = () => {
    onKindsChange([])
    onStatusesChange([])
    onMinRatingChange(0)
    onFavoriteOnlyChange(false)
    onYearRangeChange(null, null)
    onFacetsChange(emptyFacetFilters)
  }
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant={activeCount ? "secondary" : "outline"} />}
      >
        <FunnelSimpleIcon /> Filter{" "}
        {activeCount ? (
          <span className="filter-count">{activeCount}</span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right" className="filter-sheet">
        <SheetHeader className="filter-sheet-header">
          <SheetTitle>Filter this view</SheetTitle>
          <SheetDescription>
            Match every active category; values inside a category match any.
          </SheetDescription>
        </SheetHeader>
        <div className="filter-sheet-scroll">
          <label className="facet-search">
            <MagnifyingGlassIcon />
            <Input
              value={facetSearch}
              onChange={(event) => setFacetSearch(event.target.value)}
              placeholder="Find a genre, tag, studio, country…"
              aria-label="Search filter values"
            />
          </label>
          <div className="filter-group-title">
            <span>Type</span>
            <em>is any of</em>
          </div>
          <div className="kind-options">
            {workKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                className={cn(kinds.includes(kind) && "checked")}
              >
                <i>{kinds.includes(kind) ? <CheckIcon /> : null}</i>
                {kindLabels[kind]}
              </button>
            ))}
          </div>
          <Separator />
          <div className="filter-group-title">
            <span>Status</span>
            <em>is any of</em>
          </div>
          <div className="status-options">
            {(
              [
                "planned",
                "in-progress",
                "completed",
                "paused",
                "dropped",
              ] as const
            ).map((status) => (
              <button
                type="button"
                key={status}
                onClick={() => toggleStatus(status)}
                className={cn(statuses.includes(status) && "checked")}
              >
                <i>{statuses.includes(status) ? <CheckIcon /> : null}</i>
                {status.replace("-", " ")}
              </button>
            ))}
          </div>
          <Separator />
          <div className="filter-number-row">
            <label>
              <span>Minimum rating</span>
              <select
                value={minRating}
                onChange={(event) =>
                  onMinRatingChange(Number(event.target.value))
                }
              >
                <option value="0">Any rating</option>
                <option value="7">7+</option>
                <option value="8">8+</option>
                <option value="9">9+</option>
              </select>
            </label>
            <label>
              <span>Release from</span>
              <Input
                type="number"
                placeholder="Any"
                value={yearFrom ?? ""}
                onChange={(event) =>
                  onYearRangeChange(
                    event.target.value ? Number(event.target.value) : null,
                    yearTo
                  )
                }
              />
            </label>
            <label>
              <span>Release to</span>
              <Input
                type="number"
                placeholder="Any"
                value={yearTo ?? ""}
                onChange={(event) =>
                  onYearRangeChange(
                    yearFrom,
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              />
            </label>
          </div>
          <label className="filter-switch-row">
            <span>
              <strong>Favorites only</strong>
              <small>Only show works marked as favorite</small>
            </span>
            <Switch
              checked={favoriteOnly}
              onCheckedChange={onFavoriteOnlyChange}
            />
          </label>
          <div className="facet-groups">
            <FacetSection
              label="Genres"
              options={facetOptions.genres}
              selected={facets.genres}
              search={facetSearch}
              onToggle={(value) => toggleFacet("genres", value)}
              defaultOpen
            />
            <FacetSection
              label="Tags & themes"
              options={facetOptions.tags}
              selected={facets.tags}
              search={facetSearch}
              onToggle={(value) => toggleFacet("tags", value)}
            />
            <FacetSection
              label="Tone"
              options={facetOptions.tones}
              selected={facets.tones}
              search={facetSearch}
              onToggle={(value) => toggleFacet("tones", value)}
            />
            <FacetSection
              label="Studios"
              options={facetOptions.studios}
              selected={facets.studios}
              search={facetSearch}
              onToggle={(value) => toggleFacet("studios", value)}
            />
            <FacetSection
              label="Contributors"
              options={facetOptions.contributors}
              selected={facets.contributors}
              search={facetSearch}
              onToggle={(value) => toggleFacet("contributors", value)}
            />
            <FacetSection
              label="Publishers"
              options={facetOptions.publishers}
              selected={facets.publishers}
              search={facetSearch}
              onToggle={(value) => toggleFacet("publishers", value)}
            />
            <FacetSection
              label="Publication format"
              options={facetOptions.publicationFormats}
              selected={facets.publicationFormats}
              search={facetSearch}
              onToggle={(value) => toggleFacet("publicationFormats", value)}
            />
            <FacetSection
              label="Release status"
              options={facetOptions.releaseStatuses}
              selected={facets.releaseStatuses}
              search={facetSearch}
              onToggle={(value) => toggleFacet("releaseStatuses", value)}
            />
            <FacetSection
              label="Countries"
              options={facetOptions.countries}
              selected={facets.countries}
              search={facetSearch}
              onToggle={(value) => toggleFacet("countries", value)}
            />
            <FacetSection
              label="Audience"
              options={facetOptions.audiences}
              selected={facets.audiences}
              search={facetSearch}
              onToggle={(value) => toggleFacet("audiences", value)}
            />
            <FacetSection
              label="Shared with"
              options={facetOptions.sharedWith}
              selected={facets.sharedWith}
              search={facetSearch}
              onToggle={(value) => toggleFacet("sharedWith", value)}
            />
            <FacetSection
              label="Source material"
              options={facetOptions.sourceTypes}
              selected={facets.sourceTypes}
              search={facetSearch}
              onToggle={(value) => toggleFacet("sourceTypes", value)}
            />
            <FacetSection
              label="Sexual-content guidance"
              options={facetOptions.sexualityRisks}
              selected={facets.sexualityRisks}
              search={facetSearch}
              onToggle={(value) => toggleFacet("sexualityRisks", value)}
            />
            <FacetSection
              label="Violence & distress"
              options={facetOptions.behavioralRisks}
              selected={facets.behavioralRisks}
              search={facetSearch}
              onToggle={(value) => toggleFacet("behavioralRisks", value)}
            />
            <FacetSection
              label="Religious / occult themes"
              options={facetOptions.theologyRisks}
              selected={facets.theologyRisks}
              search={facetSearch}
              onToggle={(value) => toggleFacet("theologyRisks", value)}
            />
          </div>
          <p className="filter-hint">
            Every condition is serializable and included when you save this
            view.
          </p>
        </div>
        <SheetFooter className="filter-sheet-footer">
          <div>
            <strong>{matchingCount}</strong>
            <span> matching works</span>
          </div>
          <div>
            <Button variant="ghost" onClick={clear} disabled={!activeCount}>
              Clear all
            </Button>
            <SheetClose render={<Button />}>Done</SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function FacetSection({
  label,
  options,
  selected,
  search,
  onToggle,
  defaultOpen = false,
}: {
  label: string
  options: FacetOption[]
  selected: string[]
  search: string
  onToggle: (value: string) => void
  defaultOpen?: boolean
}) {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visible = options.filter(
    (option) =>
      !normalizedSearch ||
      option.value.toLocaleLowerCase().includes(normalizedSearch)
  )
  if (!visible.length && !selected.length) return null
  return (
    <details
      className="facet-section"
      open={defaultOpen || Boolean(normalizedSearch)}
    >
      <summary>
        <span>{label}</span>
        <em>
          {selected.length
            ? `${selected.length} selected`
            : `${options.length} values`}
        </em>
      </summary>
      <div className="facet-options">
        {visible.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(selected.includes(option.value) && "selected")}
            onClick={() => onToggle(option.value)}
          >
            <i>{selected.includes(option.value) ? <CheckIcon /> : null}</i>
            <span>{option.value}</span>
            <em>{option.count}</em>
          </button>
        ))}
      </div>
    </details>
  )
}

The legacy gallery, inspector, table, timeline, and statistics implementations
also lived here and depended on the removed global CSS. Their active replacements
are colocated in ./components and use Tailwind plus shared shadcn primitives.

function Gallery({
  works,
  selectedId,
  onSelect,
  onOpen,
  cardSize,
  options,
}: {
  works: Work[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  cardSize: number
  options: GalleryOptions
}) {
  return (
    <div
      className="gallery-grid"
      style={{ "--card-min": `${cardSize}px` } as CSSProperties}
    >
      {works.map((work) => (
        <article
          className={cn(
            "work-card",
            `card-mode-${options.mode}`,
            options.imageType === "logo" && "square-card",
            selectedId === work.id && "selected"
          )}
          key={work.id}
          onMouseEnter={() => onSelect(work.id)}
          onClick={() => onOpen(work.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onOpen(work.id)
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${work.title}`}
        >
          <Poster
            work={work}
            image={options.imageType === "logo" ? "logo" : "poster"}
            showType={options.showType}
            showRating={options.showRating}
          />
          {options.mode !== "cover" ? (
            <div className="card-copy">
              <div className="card-title-row">
                <h2>{work.title}</h2>
                {work.favorite ? <StarIcon weight="fill" /> : null}
              </div>
              {options.mode === "full" ? (
                <p>
                  {work.year ?? "—"} · {kindLabels[work.kind]}
                </p>
              ) : null}
              {options.mode === "full" ? (
                <div className="tag-row genre-row">
                  {work.genres.slice(0, 3).map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function Poster({
  work,
  image = "poster",
  compact = false,
  showType = true,
  showRating = true,
}: {
  work: Work
  image?: "poster" | "logo"
  compact?: boolean
  showType?: boolean
  showRating?: boolean
}) {
  return (
    <div
      className={cn("poster", `poster-${work.palette}`, compact && "compact")}
    >
      {image === "poster" ? (
        work.imagePath ? (
          <img src={work.imagePath} alt="" />
        ) : (
          <PosterArt palette={work.palette} />
        )
      ) : image === "logo" ? (
        work.logoPath ? (
          <img src={work.logoPath} className="object-contain!" alt="" />
        ) : (
          <PosterArt palette={work.palette} />
        )
      ) : (
        <PosterArt palette={work.palette} />
      )}

      {image === "poster" ||
        (image === "logo" && !work.logoPath && (
          <div className="poster-shade" />
        ))}
      {showType ? (
        <span className="kind-pill">{kindLabels[work.kind]}</span>
      ) : null}
      {showRating && work.calculatedRating ? (
        <span className="rating-pill">
          <StarIcon weight="fill" /> {work.calculatedRating.toFixed(1)}
        </span>
      ) : null}
      {(image === "poster" && !work.imagePath) ||
      (image === "logo" && !work.logoPath) ? (
        <div className="poster-title">
          <small>{work.creator}</small>
          <strong>{work.title}</strong>
        </div>
      ) : null}
    </div>
  )
}

function PosterArt({ palette }: { palette: string }) {
  return (
    <div className="poster-art" aria-hidden="true">
      <span className="shape-one" />
      <span className="shape-two" />
      <span className="shape-three" />
      {palette === "signal" ? <span className="signal-lines" /> : null}
    </div>
  )
}

function Inspector({
  work,
  close,
  open,
}: {
  work: Work
  close: () => void
  open: () => void
}) {
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <span>Details</span>
        <div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={open}
                  aria-label="Open work details"
                />
              }
            >
              <ArrowsOutIcon />
            </TooltipTrigger>
            <TooltipContent>Open details</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={close}
            aria-label="Close inspector"
          >
            <XIcon />
          </Button>
        </div>
      </div>
      <div className="inspector-scroll">
        <Poster work={work} compact />
        <div className="inspector-title">
          <div>
            <span>{kindLabels[work.kind]}</span>
            <span>{work.year ?? "Unreleased"}</span>
          </div>
          <h2>{work.title}</h2>
          <p>{work.arabicTitle}</p>
        </div>
        <div className="inspector-rating">
          <span>
            <StarIcon weight="fill" />
            {work.calculatedRating?.toFixed(1) ?? "—"}
            <small>/ 10</small>
          </span>
          <Button variant="outline" size="sm" onClick={open}>
            Open record <ArrowsOutIcon />
          </Button>
        </div>
        <Separator />
        <div className="property-list">
          <div>
            <span>Status</span>
            <strong className={cn("status-value", `status-${work.status}`)}>
              <i />
              {work.status.replace("-", " ")}
            </strong>
          </div>
          {usesProgress(work) ? (
            <div>
              <span>Progress</span>
              <strong>{progressText(work)}</strong>
            </div>
          ) : null}
          <div>
            <span>Creator</span>
            <strong>{work.creator}</strong>
          </div>
          <div>
            <span>Released</span>
            <strong>{work.year ?? "Unknown"}</strong>
          </div>
          <div>
            <span>Format</span>
            <strong>{kindLabels[work.kind]}</strong>
          </div>
        </div>
        <Separator />
        <section className="inspector-section">
          <h3>Summary</h3>
          <p>{work.summary}</p>
        </section>
        <section className="inspector-section">
          <h3>Tags</h3>
          <div className="inspector-tags">
            {work.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}

function WorkTable({
  works,
  selectedId,
  onOpen,
  columns,
}: {
  works: Work[]
  selectedId: string | null
  onOpen: (id: string) => void
  columns: string[]
}) {
  return (
    <div className="table-wrap">
      <table className="works-table">
        <thead>
          <tr>
            <th>Title</th>
            {columns.includes("type") ? <th>Type</th> : null}
            {columns.includes("year") ? <th>Year</th> : null}
            {columns.includes("status") ? <th>Status</th> : null}
            {columns.includes("genres") ? <th>Genres</th> : null}
            {columns.includes("progress") ? <th>Progress</th> : null}
            {columns.includes("rating") ? <th>Rating</th> : null}
          </tr>
        </thead>
        <tbody>
          {works.map((work) => (
            <tr
              key={work.id}
              className={cn(selectedId === work.id && "selected")}
              onClick={() => onOpen(work.id)}
            >
              <td>
                {work.imagePath ? (
                  <img className="mini-cover" src={work.imagePath} alt="" />
                ) : (
                  <div className={cn("mini-cover", `poster-${work.palette}`)} />
                )}{" "}
                <span>
                  <strong>{work.title}</strong>
                  <small>{work.creator}</small>
                </span>
              </td>
              {columns.includes("type") ? (
                <td>
                  <span className="table-kind">{kindLabels[work.kind]}</span>
                </td>
              ) : null}
              {columns.includes("year") ? <td>{work.year ?? "—"}</td> : null}
              {columns.includes("status") ? (
                <td>
                  <span className={cn("status-value", `status-${work.status}`)}>
                    <i />
                    {work.status.replace("-", " ")}
                  </span>
                </td>
              ) : null}
              {columns.includes("genres") ? (
                <td>
                  <div className="table-genres">
                    {work.genres.slice(0, 3).map((genre) => (
                      <span key={genre}>{genre}</span>
                    ))}
                  </div>
                </td>
              ) : null}
              {columns.includes("progress") ? (
                <td>{usesProgress(work) ? progressText(work) : "—"}</td>
              ) : null}
              {columns.includes("rating") ? (
                <td>
                  {work.calculatedRating ? (
                    <span className="table-rating">
                      <StarIcon weight="fill" />
                      {work.calculatedRating.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Timeline({
  works,
  onOpen,
  newestFirst,
}: {
  works: Work[]
  onOpen: (id: string) => void
  newestFirst: boolean
}) {
  const groups = works.reduce<Map<number, Work[]>>((map, work) => {
    const year = work.year ?? 0
    map.set(year, [...(map.get(year) ?? []), work])
    return map
  }, new Map())
  return (
    <div className="timeline">
      {[...groups.entries()]
        .sort(([a], [b]) => (newestFirst ? b - a : a - b))
        .map(([year, items]) => (
          <section key={year}>
            <div className="timeline-year">
              <strong>{year || "TBD"}</strong>
              <span>{items.length} works</span>
            </div>
            <div className="timeline-line">
              {items.map((work) => (
                <button
                  type="button"
                  key={work.id}
                  onClick={() => onOpen(work.id)}
                >
                  <i />
                  <div
                    className={cn("timeline-cover", `poster-${work.palette}`)}
                  >
                    {work.imagePath ? (
                      <img src={work.imagePath} alt="" />
                    ) : (
                      <PosterArt palette={work.palette} />
                    )}
                  </div>
                  <span>
                    <strong>{work.title}</strong>
                    <small>
                      {kindLabels[work.kind]} · {work.creator}
                    </small>
                    <em className="timeline-genres">
                      {work.genres.slice(0, 3).join(" · ") || "Uncategorized"}
                    </em>
                  </span>
                  <span className="timeline-status">
                    {work.calculatedRating ? (
                      <strong>
                        <StarIcon weight="fill" />{" "}
                        {work.calculatedRating.toFixed(1)}
                      </strong>
                    ) : null}
                    <small>{work.status.replace("-", " ")}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

function Statistics({ works }: { works: Work[] }) {
  const completed = works.filter((work) => work.status === "completed").length
  const rated = works.filter((work) => work.calculatedRating !== null)
  const average =
    rated.reduce((sum, work) => sum + (work.calculatedRating ?? 0), 0) /
    Math.max(1, rated.length)
  const byKind = workKinds
    .map((kind) => ({
      kind,
      count: works.filter((work) => work.kind === kind).length,
    }))
    .filter((item) => item.count)
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span>Completion</span>
        <strong>
          {Math.round((completed / Math.max(1, works.length)) * 100)}%
        </strong>
        <p>
          {completed} of {works.length} works
        </p>
        <div className="big-progress">
          <i
            style={{
              width: `${(completed / Math.max(1, works.length)) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="stat-card">
        <span>Average rating</span>
        <strong>{average.toFixed(1)}</strong>
        <p>Across {rated.length} rated works</p>
        <div className="rating-dots">
          {[2, 4, 6, 8, 10].map((value) => (
            <i key={value} className={average >= value ? "filled" : ""} />
          ))}
        </div>
      </div>
      <div className="stat-card wide">
        <span>Library composition</span>
        <div className="bar-chart">
          {byKind.map((item) => (
            <div key={item.kind}>
              <label>{kindLabels[item.kind]}</label>
              <i>
                <b
                  style={{
                    width: `${(item.count / Math.max(...byKind.map((entry) => entry.count))) * 100}%`,
                  }}
                />
              </i>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="stat-card wide">
        <span>Release timeline</span>
        <div className="year-chart">
          {works
            .slice()
            .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
            .map((work) => (
              <i
                key={work.id}
                style={{
                  height: `${30 + (work.calculatedRating ?? 4) * 6}%`,
                }}
                title={`${work.title} (${work.year})`}
              />
            ))}
        </div>
        <div className="year-axis">
          <span>2018</span>
          <span>2025</span>
        </div>
      </div>
    </div>
  )
}

*/

function WorkDetailDialog({
  work,
  open,
  onOpenChange,
  toggleFavorite,
  favoritePending,
  openRelated,
}: {
  work: Work | null
  open: boolean
  onOpenChange: (open: boolean) => void
  toggleFavorite: (work: Work) => void
  favoritePending: boolean
  openRelated: (id: string) => void
}) {
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => {
    if (!open) setFullScreen(false)
  }, [open])

  if (!work) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn("work-detail-dialog rtl", fullScreen && "full-screen")}
        dir="rtl"
      >
        <div className="work-detail-toolbar">
          <span>
            سجل محلي · {work.id}
            {work.curation ? ` · ${work.curation.status}` : ""}
          </span>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setFullScreen((value) => !value)}
              aria-label={
                fullScreen ? "الخروج من الشاشة الكاملة" : "ملء الشاشة"
              }
            >
              <ArrowsOutIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="إغلاق التفاصيل"
            >
              <XIcon />
            </Button>
          </div>
        </div>

        <div className="work-detail-scroll">
          {/* Hero Section */}
          <section className="work-detail-hero">
            {work.bannerPath && (
              <div className="detail-banner" aria-hidden="true">
                <img src={work.bannerPath} alt="" />
              </div>
            )}
            <div className="detail-poster-wrap">
              <WorkArtwork work={work} />
            </div>
            <div className="detail-hero-copy">
              <div className="detail-kickers">
                <span>{kindLabels[work.kind]}</span>
                <span>{work.year ?? "غير معروض"}</span>
                <span className={cn(`status-${work.status}`)}>
                  <i />
                  {work.status.replace("-", " ")}
                </span>
              </div>

              {work.logoPath && (
                <img
                  className="detail-title-logo"
                  src={work.logoPath}
                  alt={work.title}
                />
              )}
              <h1 className={cn(work.logoPath && "sr-only")}>{work.title}</h1>
              <p className="detail-subtitle">{work.arabicTitle}</p>
              <p className="detail-summary">{work.summary}</p>

              <div className="detail-primary-meta">
                <div>
                  <span>المنشئ</span>
                  <strong>{work.creator}</strong>
                </div>
                <div>
                  <span>التقييم</span>
                  <strong>
                    <StarIcon weight="fill" />
                    {work.calculatedRating?.toFixed(1) ?? "غير مقيّم"}
                  </strong>
                </div>
                {usesProgress(work) && (
                  <div>
                    <span>التقدم</span>
                    <strong>{progressText(work)}</strong>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant={work.favorite ? "secondary" : "outline"}
                onClick={() => toggleFavorite(work)}
                disabled={favoritePending}
                className="detail-favorite"
              >
                <HeartIcon weight={work.favorite ? "fill" : "regular"} />
                {work.favorite ? "في المفضلة" : "إضافة إلى المفضلة"}
              </Button>
            </div>
          </section>

          {/* Detail Grid */}
          <section className="detail-grid">
            {/* Metadata Panel */}
            <div className="detail-panel">
              <h2>البيانات الوصفية</h2>
              <dl>
                <div>
                  <dt>العنوان الأصلي</dt>
                  <dd>{work.title}</dd>
                </div>
                <div>
                  <dt>نوع الوسائط</dt>
                  <dd>{kindLabels[work.kind]}</dd>
                </div>
                <div>
                  <dt>سنة الإصدار</dt>
                  <dd>{work.year ?? "غير معروف"}</dd>
                </div>
                <div>
                  <dt>حالة الإصدار</dt>
                  <dd className="capitalize">{work.releaseStatus}</dd>
                </div>
                <div>
                  <dt>المنشئ الرئيسي</dt>
                  <dd>{work.creator}</dd>
                </div>
                {!!work.studios.length &&
                  work.kind !== "manga" &&
                  work.kind !== "novel" && (
                    <div>
                      <dt>استوديوهات الإنتاج</dt>
                      <dd>{work.studios.join(" · ")}</dd>
                    </div>
                  )}
                {!!work.aliases.length && (
                  <div>
                    <dt>العناوين البديلة</dt>
                    <dd>{work.aliases.join(" · ")}</dd>
                  </div>
                )}
                {!!work.country.length && (
                  <div>
                    <dt>الدولة</dt>
                    <dd>{work.country.join("، ")}</dd>
                  </div>
                )}
                {work.releaseStart && (
                  <div>
                    <dt>فترة العرض الأصلية</dt>
                    <dd>
                      {work.releaseStart} ← {work.releaseEnd ?? "حتى الآن"}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>الحالة الشخصية</dt>
                  <dd className="capitalize">
                    {work.status.replace("-", " ")}
                  </dd>
                </div>
                <div>
                  <dt>تاريخ الإضافة محلياً</dt>
                  <dd>
                    {new Date(work.addedAt * 1000).toLocaleDateString("ar-EG")}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Personal Record Panel */}
            <div className="detail-panel">
              <h2>السجل الشخصي</h2>
              <dl>
                <div>
                  <dt>التقييم</dt>
                  <dd>
                    {work.calculatedRating
                      ? `${work.calculatedRating.toFixed(1)} / 10`
                      : "غير مقيّم"}
                  </dd>
                </div>
                <div>
                  <dt>المفضلة</dt>
                  <dd>{work.favorite ? "نعم" : "لا"}</dd>
                </div>
                {usesProgress(work) && (
                  <div>
                    <dt>التقدم</dt>
                    <dd>{progressText(work)}</dd>
                  </div>
                )}
                {usesProgress(work) && !!work.progressTotal && (
                  <div>
                    <dt>نسبة الإكمال</dt>
                    <dd>{progressPercent(work)}%</dd>
                  </div>
                )}
                {work.watchDates?.firstWatchedAt && (
                  <div>
                    <dt>أول مشاهدة</dt>
                    <dd>{work.watchDates.firstWatchedAt}</dd>
                  </div>
                )}
                {work.watchDates?.completedAt && (
                  <div>
                    <dt>تاريخ الإكمال</dt>
                    <dd>{work.watchDates.completedAt}</dd>
                  </div>
                )}
                {!!work.sharedWith.length && (
                  <div>
                    <dt>مشارك مع</dt>
                    <dd>{work.sharedWith.join(" · ")}</dd>
                  </div>
                )}
              </dl>
              {usesProgress(work) && !!work.progressTotal && (
                <div className="detail-progress">
                  <i style={{ width: `${progressPercent(work)}%` }} />
                </div>
              )}
            </div>

            {/* Genres and Tags */}
            <div className="detail-panel detail-tags-panel">
              <h2>الأنواع، الطابع والتصنيفات</h2>
              <div className="detail-tags genres">
                {work.genres.map((genre) => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>
              <div className="detail-tags">
                {[...work.tone, ...work.tags].map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Contributors */}
            {!!work.credits.length && (
              <div className="detail-panel detail-credits-panel">
                <h2>فريق العمل والمساهمون</h2>
                <dl>
                  {work.credits.map((credit) => (
                    <div key={`${credit.entityId}:${credit.role}`}>
                      <dt>{credit.role.replaceAll("-", " ")}</dt>
                      <dd>{credit.name}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Summary */}
            <div className="detail-panel detail-summary-panel">
              <h2>القصة والملخص</h2>
              <p dir="auto">{work.summary}</p>
            </div>

            {/* Score Breakdown */}
            {!!Object.keys(work.scoreComponents).length && (
              <div className="detail-panel detail-score-panel">
                <h2>تفاصيل التقييم</h2>
                <div className="score-breakdown">
                  {Object.entries(work.scoreComponents).map(
                    ([label, score]) => (
                      <div key={label}>
                        <span>
                          {scoreLabel(label as ScoreCriterion, work.kind).ar}
                        </span>
                        <i>
                          <b style={{ width: `${score * 10}%` }} />
                        </i>
                        <strong>{score}</strong>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Content Guidance / Risk Profile */}
            {work.riskProfile && (
              <div className="detail-panel detail-risk-panel">
                <h2>إرشادات المحتوى</h2>
                <div className="risk-grid">
                  <div>
                    <span>المحتوى الجنسي</span>
                    <strong data-risk={work.riskProfile.sexuality}>
                      {work.riskProfile.sexuality}
                    </strong>
                  </div>
                  <div>
                    <span>العنف والمشاهد المزعجة</span>
                    <strong data-risk={work.riskProfile.behavioral}>
                      {work.riskProfile.behavioral}
                    </strong>
                  </div>
                  <div>
                    <span>المواضيع العقدية</span>
                    <strong data-risk={work.riskProfile.theology}>
                      {work.riskProfile.theology}
                    </strong>
                  </div>
                </div>
                {work.analysisNotes && (
                  <div className="guidance-note">
                    <span>تحليل عقدي</span>
                    <p dir="auto">{work.analysisNotes}</p>
                  </div>
                )}
                {work.curation?.notes && (
                  <div className="guidance-note neutral">
                    <span>حالة التدقيق</span>
                    <p>{work.curation.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Content Warnings */}
            {work.contentWarnings && (
              <div className="detail-panel detail-analysis-panel">
                <h2>تحذيرات المحتوى</h2>
                <p dir="auto">{work.contentWarnings}</p>
              </div>
            )}

            {/* Source Material */}
            {work.sourceMaterial && (
              <div className="detail-panel detail-source-panel">
                <h2>المصدر الأصلي</h2>
                <dl>
                  <div>
                    <dt>النوع</dt>
                    <dd>{work.sourceMaterial.type}</dd>
                  </div>
                  <div>
                    <dt>جهة النشر</dt>
                    <dd>{work.sourceMaterial.publication ?? "غير معروف"}</dd>
                  </div>
                  {!!work.sourceMaterial.serialization.length && (
                    <div>
                      <dt>تسلسل النشر</dt>
                      <dd>{work.sourceMaterial.serialization.join("، ")}</dd>
                    </div>
                  )}
                  <div>
                    <dt>فترة العرض الأصلي</dt>
                    <dd>
                      {work.sourceMaterial.started ?? "؟"} ←{" "}
                      {work.sourceMaterial.finished ?? "حتى الآن"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Publication */}
            {work.publication && (
              <div className="detail-panel detail-source-panel">
                <h2>تفاصيل النشر</h2>
                <dl>
                  <div>
                    <dt>الصيغة</dt>
                    <dd>{work.publication.format ?? "غير معروف"}</dd>
                  </div>
                  <div>
                    <dt>الناشر</dt>
                    <dd>{work.publication.publisher ?? "غير معروف"}</dd>
                  </div>
                  {!!work.publication.serialization.length && (
                    <div>
                      <dt>مجلة النشر / التسلسل</dt>
                      <dd>{work.publication.serialization.join("، ")}</dd>
                    </div>
                  )}
                  {!!work.publication.contents.length && (
                    <div>
                      <dt>المحتويات</dt>
                      <dd>{work.publication.contents.join(" · ")}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Relations */}
            {!!work.relations.length && (
              <div className="detail-panel detail-relations-panel">
                <h2>أعمال ذات صلة</h2>
                <div className="related-work-list">
                  {work.relations.map((relation) => (
                    <button
                      key={relation.id}
                      type="button"
                      onClick={() => openRelated(relation.workId)}
                    >
                      <span>{relationLabel(relation)}</span>
                      <strong>{relation.work.title}</strong>
                      <small>{kindLabels[relation.work.kind]}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* External Links */}
            {!!work.externalLinks.length && (
              <div className="detail-panel detail-links-panel">
                <h2>روابط خارجية</h2>
                <div className="external-links">
                  {work.externalLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{link.label}</span>
                      <strong>↖</strong>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Kept temporarily as a reference while the extracted detail component settles.
void WorkDetailDialog

/* Replaced by ./components/add-work-dialog.tsx.
function AddWorkDialog({ onCreated }: { onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: addWork,
    onSuccess: async () => {
      await onCreated()
      setOpen(false)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      data: {
        title: String(data.get("title") ?? ""),
        kind: String(data.get("kind") ?? "movie") as WorkKind,
        year: data.get("year") ? Number(data.get("year")) : null,
        status: "planned",
        summary: String(data.get("summary") ?? ""),
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="add-work-button" />}>
        <PlusIcon weight="bold" /> Add work
      </DialogTrigger>
      <DialogContent className="add-dialog">
        <DialogHeader>
          <DialogTitle>Add to your library</DialogTitle>
          <DialogDescription>
            Create a local entry now. Every property can be expanded later.
          </DialogDescription>
        </DialogHeader>
        <form id="add-work-form" onSubmit={submit} className="add-form">
          <label>
            <span>Title</span>
            <Input name="title" placeholder="Work title" required autoFocus />
          </label>
          <div className="form-row">
            <label>
              <span>Type</span>
              <select name="kind" defaultValue="movie">
                {workKinds.map((kind) => (
                  <option value={kind} key={kind}>
                    {kindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Year</span>
              <Input
                name="year"
                type="number"
                min="1000"
                max="2200"
                placeholder="2026"
              />
            </label>
          </div>
          <label>
            <span>Summary</span>
            <textarea
              name="summary"
              placeholder="A short, searchable description…"
            />
          </label>
        </form>
        {mutation.error ? (
          <p className="form-error">{mutation.error.message}</p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-work-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Adding…" : "Add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
*/

/* Replaced by ./components/empty-state.tsx.
function EmptyState({ clear }: { clear: () => void }) {
  return (
    <div className="empty-state">
      <div>
        <MagnifyingGlassIcon />
      </div>
      <h2>No works found</h2>
      <p>Try a different search or clear the current view filters.</p>
      <Button variant="outline" onClick={clear}>
        Clear filters
      </Button>
    </div>
  )
}
*/
