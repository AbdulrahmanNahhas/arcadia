import {
  DatabaseIcon,
  ImageIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  PanoramaIcon,
  SidebarSimpleIcon,
  TableIcon,
  XIcon,
} from "@phosphor-icons/react";
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
  return [...works].sort((left, right) => {
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
      1: "grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10", // Micro
      2: "grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6", // Compact
      3: "grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5", // Balanced
      4: "grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", // Large
      5: "grid-cols-1 gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3", // Extra Large
    } satisfies Record<CatalogDensity, string>;
    return bannerMap[density] ?? bannerMap[3];
  }

  // Grid / Poster View
  const gridMap = {
    1: "grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12", // Micro Posters
    2: "grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8", // Compact
    3: "grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7", // Balanced
    4: "grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6", // Large
    5: "grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5", // Extra Large
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

export function DatabasePage() {
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
  const [query, setQuery] = useState("");
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
    <PlatformShell immersive={false}>
      {/* <section className="relative isolate overflow-hidden border-b border-white/8">
        <div className="archive-grid absolute inset-0 -z-10 opacity-30" />
        <div className="absolute inset-x-0 top-0 -z-20 h-72 bg-linear-to-b from-primary/12 to-transparent" />
        <div className="mx-auto max-w-400 px-5 pb-10 pt-28 sm:px-8 sm:pt-36">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-primary">أرشيف نحّاسينما</p>
              <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
                قاعدة البيانات
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-foreground/70 sm:text-lg">
                افتح الأرشيف من أي زاوية: النوع، المخاطر، السنة، أو حتى عمق المواسم.
              </p>
            </div>
            <div className="flex items-baseline gap-2 rounded-3xl border bg-background/40 px-5 py-3 backdrop-blur">
              <strong className="font-mono text-2xl">{visibleWorks.length}</strong>
              <span className="text-xs text-muted-foreground">نتيجة الآن</span>
            </div>
          </div>
        </div>
      </section>*/}

      <section className="mx-auto max-w-400 px-5 pb-12 pt-7 sm:px-8">
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border bg-card/35 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row">
            <InputGroup className="min-w-0 flex-1">
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="عنوان، موسم، اسم بديل، استوديو أو صانع…"
                aria-label="البحث في قاعدة البيانات"
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setQuery("")}
                    aria-label="مسح البحث"
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <div className="flex gap-2">
              <CatalogFilterSheet {...filterProps} className="flex-1" />
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="hidden lg:inline-flex"
                disabled={!interactive}
                aria-pressed={showFilters}
                onClick={() => setShowFilters((current) => !current)}
              >
                <SidebarSimpleIcon data-icon="inline-start" />
                {showFilters ? "إخفاء المرشحات" : "إظهار المرشحات"}
              </Button>
              <Select
                value={sort}
                onValueChange={(value) => value && setSort(value as CatalogSort)}
              >
                <SelectTrigger className="min-w-40 flex-1 md:flex-none">
                  <SelectValue>
                    {sortOptions.find((option) => option.value === sort)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={groupBy}
                onValueChange={(value) => value && setGroupBy(value as CatalogGroupBy)}
              >
                <SelectTrigger className="min-w-32 flex-1 md:flex-none">
                  <SelectValue>
                    {catalogGroupByOptions.find((option) => option.value === groupBy)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {catalogGroupByOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                value={[mode]}
                multiple={false}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="مستوى عرض الكتالوج"
                onValueChange={(values) => values[0] && switchMode(values[0] as CatalogMode)}
              >
                <ToggleGroupItem value="titles">العناوين</ToggleGroupItem>
                <ToggleGroupItem value="installments">المواسم والإصدارات</ToggleGroupItem>
              </ToggleGroup>
              <Badge variant="outline">{visibleWorks.length} نتيجة الآن</Badge>
              {isAdmin ? <Badge variant="outline">وضع المدير</Badge> : null}
              {activeFilterCount ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <XIcon data-icon="inline-start" />
                  مسح {activeFilterCount} مرشح
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {view !== "table" ? (
                <div className="flex items-center gap-2.5 min-w-40 max-w-50">
                  <span className="text-xs text-muted-foreground select-none">كبير</span>
                  <Slider
                    value={[density]}
                    min={1}
                    max={5}
                    step={1}
                    disabled={!interactive}
                    aria-label="حجم بطاقات الشبكة"
                    onValueChange={(value) => {
                      const next = Array.isArray(value) ? value[0] : value;
                      // SAFETY: `min={1}`/`max={5}`/`step={1}` constrain the slider to the five
                      // integer values `CatalogDensity` allows.
                      setDensity(next as CatalogDensity);
                    }}
                    className="
                      ltr!
                      w-full
                      **:data-[slot=slider-track]:bg-muted
                      **:data-[slot=slider-range]:bg-foreground
                      **:data-[slot=slider-thumb]:border-border
                      **:data-[slot=slider-thumb]:bg-foreground
                    "
                  />
                  <span className="text-xs text-muted-foreground select-none">صغير</span>
                </div>
              ) : (
                <WorkTableColumnPicker visible={tableColumns} onChange={setTableColumns} />
              )}
              <ToggleGroup
                value={[view]}
                multiple={false}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="طريقة عرض الأعمال"
                disabled={!interactive}
                onValueChange={(values) => values[0] && setView(values[0] as CatalogView)}
              >
                <ToggleGroupItem value="poster" aria-label="ملصقات">
                  <ImageIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="banner" aria-label="لافتات">
                  <PanoramaIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="logo" aria-label="شعارات">
                  <ImageSquareIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="جدول">
                  <TableIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "grid items-start gap-7",
            showFilters && "lg:grid-cols-[19rem_minmax(0,1fr)]",
          )}
        >
          {showFilters ? <CatalogFilterSidebar {...filterProps} /> : null}
          <div className="min-w-0">
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
