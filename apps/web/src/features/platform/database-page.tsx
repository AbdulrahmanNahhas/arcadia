import {
  DatabaseIcon,
  ImageIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  PanoramaIcon,
  TableIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  ArrowsDownUpIcon,
  FilmStripIcon,
  FunnelSimpleIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SquaresFourIcon,
  StackIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCurrentAccount } from "@/features/accounts/api";
import {
  buildCatalogFacetOptions,
  countCatalogFilters,
  createCatalogFilters,
  workMatchesCatalogFilters,
} from "@/features/catalog/catalog-filtering";
import { CatalogFilterSheet, CatalogFilterSidebar } from "@/features/catalog/catalog-filters";
import {
  type CatalogGroupBy,
  catalogGroupByOptions,
  groupWorks,
} from "@/features/catalog/catalog-grouping";
import type { Work } from "@/features/library/model";
import { scoreCriterionLabels } from "@/features/library/scoring";
import { usePersistedState } from "@/lib/use-persisted-state";
import { cn } from "@/lib/utils";
import {
  getAdminPlatformCatalogInstallments,
  getAdminPlatformCatalogWorks,
  getPlanets,
  getPlatformCatalogInstallments,
  getPlatformCatalogWorks,
} from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";
import { useWorkTableColumns, WorkTable, WorkTableColumnPicker } from "./components/work-table";

type CatalogGridView = "poster" | "banner" | "logo";
type CatalogView = CatalogGridView | "table";
type CatalogDensity = 1 | 2 | 3 | 4 | 5;
type CatalogMode = "titles" | "installments";
type CatalogSort =
  | "newest"
  | "oldest"
  | "title"
  | "ranked"
  | "story"
  | "characters"
  | "depth"
  | "worldBuilding"
  | "originality"
  | "craft";

const sortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "newest", label: "الأحدث إصداراً" },
  { value: "oldest", label: "الأقدم إصداراً" },
  { value: "title", label: "العنوان" },
  { value: "ranked", label: "التقييم العام" },
  ...Object.entries(scoreCriterionLabels).map(([value, label]) => ({
    value: value as CatalogSort,
    label: `درجة ${label.ar}`,
  })),
];

function releaseTimestamp(work: Work) {
  const exact = work.releaseStart ? Date.parse(`${work.releaseStart}T00:00:00Z`) : Number.NaN;
  if (Number.isFinite(exact)) return exact;
  return work.year === null ? null : Date.UTC(work.year, 0, 1);
}

function titleOrder(left: Work, right: Work) {
  return (
    (left.arabicTitle || left.title).localeCompare(right.arabicTitle || right.title, "ar") ||
    left.title.localeCompare(right.title, "en") ||
    left.id.localeCompare(right.id)
  );
}

function compareOptionalNumber(left: number | null | undefined, right: number | null | undefined) {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  return right - left;
}

function sortWorks(works: Work[], sort: CatalogSort) {
  return works.toSorted((left, right) => {
    if (sort === "title") return titleOrder(left, right);
    if (sort === "ranked") {
      return (
        compareOptionalNumber(left.calculatedRating, right.calculatedRating) ||
        titleOrder(left, right)
      );
    }
    if (["story", "characters", "depth", "worldBuilding", "originality", "craft"].includes(sort)) {
      const criterion = sort as keyof Work["scoreComponents"];
      return (
        compareOptionalNumber(left.scoreComponents[criterion], right.scoreComponents[criterion]) ||
        titleOrder(left, right)
      );
    }
    const leftRelease = releaseTimestamp(left);
    const rightRelease = releaseTimestamp(right);
    if (leftRelease === rightRelease) return titleOrder(left, right);
    if (leftRelease === null) return 1;
    if (rightRelease === null) return -1;
    return sort === "newest" ? rightRelease - leftRelease : leftRelease - rightRelease;
  });
}
function gridClassName(view: CatalogGridView, density: CatalogDensity): string {
  if (view === "banner") {
    const bannerMap = {
      1: "grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8", // Micro
      2: "grid-cols-1 gap-4 gap-y-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6", // Compact
      3: "grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5", // Balanced
      4: "grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", // Large
      5: "grid-cols-1 gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3", // Extra Large
    } satisfies Record<CatalogDensity, string>;
    return bannerMap[density] ?? bannerMap[3];
  }

  // Grid / Poster View
  const gridMap = {
    1: "grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-12", // Micro Posters
    2: "grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-8", // Compact
    3: "grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-7", // Balanced
    4: "grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6", // Large
    5: "grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5", // Extra Large
  } satisfies Record<CatalogDensity, string>;
  return gridMap[density] ?? gridMap[3];
}

function matchesQuery(work: Work, query: string) {
  if (!query) return true;
  return [
    work.title,
    work.arabicTitle,
    work.installmentTitle,
    work.summary,
    work.creator,
    ...work.aliases,
    ...work.studios,
    ...work.contributors.map(({ name }) => name),
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

export function DatabasePage({ initialQuery = "" }: { initialQuery?: string }) {
  const { data: publicWorks } = useSuspenseQuery({
    queryKey: ["platform-catalog", "titles"],
    queryFn: () => getPlatformCatalogWorks(),
  });
  const { data: publicInstallments } = useSuspenseQuery({
    queryKey: ["platform-catalog", "installments"],
    queryFn: () => getPlatformCatalogInstallments(),
  });
  const { data: accountData } = useCurrentAccount();
  const isAdmin = accountData?.account.role === "owner" || accountData?.account.role === "editor";
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(true);
  }, []);
  const { data: adminWorks } = useQuery({
    queryKey: ["platform-catalog", "admin", "titles"],
    queryFn: getAdminPlatformCatalogWorks,
    enabled: isAdmin,
  });
  const { data: adminInstallments } = useQuery({
    queryKey: ["platform-catalog", "admin", "installments"],
    queryFn: getAdminPlatformCatalogInstallments,
    enabled: isAdmin,
  });
  const { data: planets } = useSuspenseQuery({
    queryKey: ["planets"],
    queryFn: () => getPlanets(),
  });
  const planetsById = useMemo(
    () => new Map(planets.map((planet) => [planet.id, planet])),
    [planets],
  );
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<CatalogMode>("titles");
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [view, setView] = usePersistedState<CatalogView>("arcadia:browse:view", "poster");
  const [density, setDensity] = usePersistedState<CatalogDensity>("arcadia:browse:density", 3);
  const [groupBy, setGroupBy] = usePersistedState<CatalogGroupBy>(
    "arcadia:browse:group-by",
    "none",
  );
  const [tableColumns, setTableColumns] = useWorkTableColumns();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(createCatalogFilters);

  const catalogWorks = useMemo(() => {
    const titleSource = isAdmin && adminWorks ? adminWorks : publicWorks;
    const installmentSource = isAdmin && adminInstallments ? adminInstallments : publicInstallments;
    return mode === "titles" ? titleSource : installmentSource;
  }, [adminInstallments, adminWorks, isAdmin, mode, publicInstallments, publicWorks]);
  const filterOptions = useMemo(() => buildCatalogFacetOptions(catalogWorks), [catalogWorks]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleWorks = useMemo(
    () =>
      sortWorks(
        catalogWorks.filter(
          (work) => workMatchesCatalogFilters(work, filters) && matchesQuery(work, normalizedQuery),
        ),
        sort,
      ),
    [catalogWorks, filters, normalizedQuery, sort],
  );
  const groups = useMemo(
    () => groupWorks(visibleWorks, groupBy, sort !== "oldest", planetsById),
    [visibleWorks, groupBy, sort, planetsById],
  );
  const activeFilterCount = countCatalogFilters(filters);
  const resetFilters = () => setFilters(createCatalogFilters());
  const resetAll = () => {
    setQuery("");
    resetFilters();
  };

  const filterProps = {
    filters,
    onChange: setFilters,
    options: filterOptions,
    matchingCount: visibleWorks.length,
    onClear: resetFilters,
    allowPrivacy: isAdmin,
    disabled: !interactive,
  };
  const switchMode = (nextMode: CatalogMode) => {
    setMode(nextMode);
    setFilters((current) => ({
      ...current,
      facets: {
        ...current.facets,
        structureStates: { include: [], exclude: [] },
      },
    }));
  };

  return (
    <PlatformShell immersive sticky>
      <section className="mx-auto max-w-400 px-5 pb-12 pt-0 sm:px-8">
        <div
          className={cn(
            "grid items-start gap-7",
            showFilters && "lg:grid-cols-[19rem_minmax(0,1fr)]",
          )}
        >
          {showFilters ? <CatalogFilterSidebar {...filterProps} /> : null}
          <div className="min-w-0 pb-4">
            <div className="w-full space-y-2 pt-2 pb-4">
              {/* ═══════════════════════════════════════════════
                PRIMARY CONTROL BAR: SEARCH & SCOPE
                ═══════════════════════════════════════════════ */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <InputGroup
                  className={cn(
                    "h-10 min-w-60 flex-1 rounded-lg border-border bg-muted/50 shadow-none transition-colors",
                    "focus-within:border-ring focus-within:bg-background",
                  )}
                >
                  <InputGroupAddon className="text-muted-foreground">
                    <MagnifyingGlassIcon className="size-4" />
                  </InputGroupAddon>

                  <InputGroupInput
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="عنوان، موسم، اسم بديل، استوديو أو صانع…"
                    aria-label="البحث في قاعدة البيانات"
                    className="h-10 text-sm"
                  />

                  {query ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => setQuery("")}
                        aria-label="مسح البحث"
                        className="rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>

                {/* Catalog Scope Mode (Desktop) */}
                <ToggleGroup
                  value={[mode]}
                  multiple={false}
                  variant="outline"
                  size="sm"
                  spacing={0}
                  aria-label="مستوى عرض الكتالوج"
                  disabled={!interactive}
                  onValueChange={(values) => {
                    if (values[0]) switchMode(values[0] as CatalogMode);
                  }}
                  className="hidden shrink-0 rounded-lg bg-background p-0.5 sm:flex"
                >
                  <ToggleGroupItem value="titles" className="h-9 gap-1.5 rounded-md px-3 text-xs">
                    <FilmStripIcon className="size-4" />
                    <span>العناوين</span>
                  </ToggleGroupItem>

                  <ToggleGroupItem
                    value="installments"
                    className="h-9 gap-1.5 rounded-md px-3 text-xs"
                  >
                    <StackIcon className="size-4" />
                    <span>المواسم والإصدارات</span>
                  </ToggleGroupItem>
                </ToggleGroup>

                {/* Filter Buttons */}
                <CatalogFilterSheet {...filterProps} className="shrink-0 lg:hidden" />

                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "hidden h-10 shrink-0 gap-2 rounded-lg px-3.5 lg:inline-flex",
                    "border-border",
                  )}
                  disabled={!interactive}
                  aria-pressed={showFilters}
                  onClick={() => setShowFilters((current) => !current)}
                >
                  <FunnelSimpleIcon className="size-4" />
                  <span>{showFilters ? "إخفاء المرشحات" : "المرشحات"}</span>
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="default"
                      className="ms-1 size-5 justify-center rounded-full p-0 text-[10px]"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>

                {/* Result Count Badge */}
                <Badge
                  variant="secondary"
                  className="hidden h-10 shrink-0 rounded-lg border border-border px-3 font-normal tabular-nums text-muted-foreground xl:flex"
                >
                  <span className="me-1 font-semibold text-foreground">{visibleWorks.length}</span>
                  عمل
                </Badge>
              </div>

              {/* ═══════════════════════════════════════════════
                SECONDARY CONTROL BAR: DISPLAY, SORTING & LAYOUT
                ═══════════════════════════════════════════════ */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/20 p-1.5 border border-border/40">
                {/* Sort Dropdown */}
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    if (value) setSort(value as CatalogSort);
                  }}
                >
                  <SelectTrigger className="h-9 w-full min-w-37.5 rounded-lg border-border bg-background text-xs sm:w-auto">
                    <div className="flex items-center gap-2 truncate">
                      <ArrowsDownUpIcon className="size-3.5 text-muted-foreground shrink-0" />
                      <SelectValue>
                        {sortOptions.find((option) => option.value === sort)?.label}
                      </SelectValue>
                    </div>
                  </SelectTrigger>

                  <SelectContent>
                    <SelectGroup>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {/* Group Dropdown */}
                <Select
                  value={groupBy}
                  onValueChange={(value) => {
                    if (value) setGroupBy(value as CatalogGroupBy);
                  }}
                >
                  <SelectTrigger className="h-9 w-full min-w-35 rounded-lg border-border bg-background text-xs sm:w-auto">
                    <div className="flex items-center gap-2 truncate">
                      <SquaresFourIcon className="size-3.5 text-muted-foreground shrink-0" />
                      <SelectValue>
                        {catalogGroupByOptions.find((option) => option.value === groupBy)?.label}
                      </SelectValue>
                    </div>
                  </SelectTrigger>

                  <SelectContent>
                    <SelectGroup>
                      {catalogGroupByOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {/* View Mode Toggle Group */}
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="h-4 w-px bg-border/60" />
                  <ToggleGroup
                    value={[view]}
                    multiple={false}
                    variant="outline"
                    size="sm"
                    spacing={0}
                    aria-label="طريقة عرض الأعمال"
                    disabled={!interactive}
                    onValueChange={(values) => {
                      if (values[0]) setView(values[0] as CatalogView);
                    }}
                    className="rounded-lg bg-background p-0.5"
                  >
                    <ToggleGroupItem
                      value="poster"
                      aria-label="ملصقات"
                      className="size-8 rounded-md p-0"
                    >
                      <ImageIcon className="size-4" />
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="banner"
                      aria-label="لافتات"
                      className="size-8 rounded-md p-0"
                    >
                      <PanoramaIcon className="size-4" />
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="logo"
                      aria-label="شعارات"
                      className="size-8 rounded-md p-0"
                    >
                      <ImageSquareIcon className="size-4" />
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="table"
                      aria-label="جدول"
                      className="size-8 rounded-md p-0"
                    >
                      <TableIcon className="size-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Density Slider or Table Column Picker */}
                {view !== "table" ? (
                  <div
                    className={cn(
                      "hidden h-9 w-36 shrink-0 items-center gap-2 rounded-lg border px-2.5 sm:flex",
                      "border-border bg-background",
                    )}
                    title="حجم البطاقات"
                  >
                    <SlidersHorizontalIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <Slider
                      value={[density]}
                      min={1}
                      max={5}
                      step={1}
                      disabled={!interactive}
                      aria-label="حجم بطاقات الشبكة"
                      onValueChange={(value) => {
                        const next = Array.isArray(value) ? value[0] : value;
                        setDensity(next as CatalogDensity);
                      }}
                      className="
                      ltr!
                      min-w-0 flex-1
                      **:data-[slot=slider-track]:bg-muted
                      **:data-[slot=slider-range]:bg-primary
                      **:data-[slot=slider-thumb]:size-3
                      **:data-[slot=slider-thumb]:border-background
                      **:data-[slot=slider-thumb]:bg-primary
                    "
                    />
                  </div>
                ) : (
                  <div className="hidden shrink-0 sm:block">
                    <WorkTableColumnPicker visible={tableColumns} onChange={setTableColumns} />
                  </div>
                )}

                {/* Mobile Mode Switch */}
                <ToggleGroup
                  value={[mode]}
                  multiple={false}
                  variant="outline"
                  size="sm"
                  spacing={0}
                  aria-label="مستوى عرض الكتالوج"
                  disabled={!interactive}
                  onValueChange={(values) => {
                    if (values[0]) switchMode(values[0] as CatalogMode);
                  }}
                  className="flex w-full sm:hidden"
                >
                  <ToggleGroupItem value="titles" className="h-9 flex-1 gap-1.5 rounded-lg text-xs">
                    <FilmStripIcon className="size-3.5" />
                    <span>العناوين</span>
                  </ToggleGroupItem>

                  <ToggleGroupItem
                    value="installments"
                    className="h-9 flex-1 gap-1.5 rounded-lg text-xs"
                  >
                    <StackIcon className="size-3.5" />
                    <span>المواسم</span>
                  </ToggleGroupItem>
                </ToggleGroup>

                {/* Active Filters Reset Button */}
                {activeFilterCount > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={resetFilters}
                  >
                    <XCircleIcon className="size-4" />
                    <span>مسح {activeFilterCount} مرشح</span>
                  </Button>
                ) : null}

                {/* Admin Badge */}
                {isAdmin ? (
                  <Badge
                    variant="outline"
                    className="h-7 gap-1 rounded-md border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <ShieldCheckIcon className="size-3.5" />
                    <span>وضع المدير</span>
                  </Badge>
                ) : null}

                {/* Mobile/Tablet Result Counter */}
                <div className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground xl:hidden">
                  <span className="font-semibold tabular-nums text-foreground">
                    {visibleWorks.length}
                  </span>
                  <span>نتيجة</span>
                </div>
              </div>
            </div>

            {groups.length ? (
              <div className="flex flex-col gap-9">
                {groups.map((group) => (
                  <section key={group.key}>
                    {group.label ? (
                      <div className="mb-4 flex items-center gap-2">
                        {group.color ? (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color }}
                            aria-hidden="true"
                          />
                        ) : null}
                        {group.slug ? (
                          <Link
                            to="/planets/$planetSlug"
                            params={{ planetSlug: group.slug }}
                            className="flex items-center gap-1.5 font-heading text-lg font-semibold hover:underline"
                          >
                            {group.icon ? <span aria-hidden="true">{group.icon}</span> : null}
                            {group.label}
                          </Link>
                        ) : (
                          <h2 className="font-heading text-lg font-semibold">{group.label}</h2>
                        )}
                        <Badge variant="outline">{group.works.length} نتيجة</Badge>
                      </div>
                    ) : null}
                    {view === "table" ? (
                      <WorkTable works={group.works} columns={tableColumns} />
                    ) : (
                      <div className={cn("grid", gridClassName(view, density))}>
                        {group.works.map((work) => (
                          <WorkCard
                            key={`${mode}:${work.installmentId ?? work.id}`}
                            work={work}
                            variant={view}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <Empty className="min-h-96 border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <DatabaseIcon />
                  </EmptyMedia>
                  <EmptyTitle>لا توجد أعمال بهذه المواصفات</EmptyTitle>
                  <EmptyDescription>
                    أزل أحد الشروط المستبعدة أو خفّض الحد الأدنى للدرجات.
                  </EmptyDescription>
                </EmptyHeader>
                {activeFilterCount > 0 || query ? (
                  <Button variant="outline" onClick={resetAll}>
                    إعادة فتح الأرشيف
                  </Button>
                ) : null}
              </Empty>
            )}
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}
