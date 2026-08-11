import {
  DatabaseIcon,
  FunnelSimpleIcon,
  ImageIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  PanoramaIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { kindLabels } from "@/features/library/filtering";
import type { Work, WorkKind } from "@/features/library/model";
import { useArabicTranslations } from "@/features/library/translations";
import {
  getPlatformCatalogInstallments,
  getPlatformCatalogWorks,
} from "@/server/platform.functions";
import { PlatformShell } from "./components/platform-shell";
import { WorkCard } from "./components/work-card";

type CatalogView = "poster" | "banner" | "logo";
type CatalogSort = "newest" | "oldest" | "ranked";
type ReleaseStatus = Work["releaseStatus"];
type RiskLevel = NonNullable<Work["riskProfile"]>["sexuality"];
type RiskDimension = keyof NonNullable<Work["riskProfile"]>;
type FilterValues<T extends string = string> = { include: T[]; exclude: T[] };
type CatalogFilters = {
  kinds: FilterValues<WorkKind>;
  releaseStatuses: FilterValues<ReleaseStatus>;
  audiences: FilterValues<NonNullable<Work["audience"]>>;
  genres: FilterValues;
  tones: FilterValues;
  tags: FilterValues;
  countries: FilterValues;
  decades: FilterValues;
  ratingStates: FilterValues<"rated" | "unrated">;
  warningStates: FilterValues<"warnings" | "none">;
  risks: Record<RiskDimension, FilterValues<RiskLevel>>;
};

const emptyFilterValues = <T extends string>(): FilterValues<T> => ({ include: [], exclude: [] });

const emptyCatalogFilters = (): CatalogFilters => ({
  kinds: emptyFilterValues<WorkKind>(),
  releaseStatuses: emptyFilterValues<ReleaseStatus>(),
  audiences: emptyFilterValues<NonNullable<Work["audience"]>>(),
  genres: emptyFilterValues(),
  tones: emptyFilterValues(),
  tags: emptyFilterValues(),
  countries: emptyFilterValues(),
  decades: emptyFilterValues(),
  ratingStates: emptyFilterValues<"rated" | "unrated">(),
  warningStates: emptyFilterValues<"warnings" | "none">(),
  risks: {
    sexuality: emptyFilterValues<RiskLevel>(),
    behavioral: emptyFilterValues<RiskLevel>(),
    theology: emptyFilterValues<RiskLevel>(),
  },
});

const riskOptions: Array<{ value: RiskLevel; label: string }> = [
  { value: "none", label: "لا يوجد" },
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "مرتفع" },
  { value: "unknown", label: "غير معروف" },
];

const riskDimensions: Array<{ value: RiskDimension; title: string; description: string }> = [
  { value: "sexuality", title: "المحتوى الجنسي", description: "مستوى الإشارات الجنسية" },
  { value: "behavioral", title: "المحتوى السلوكي", description: "العنف والسلوكيات الحساسة" },
  { value: "theology", title: "المحتوى الديني", description: "الإشارات والمضامين الدينية" },
];

const catalogKinds: WorkKind[] = ["movie", "series", "anime"];
const releaseStatusOptions: Array<{ value: ReleaseStatus; label: string }> = [
  { value: "released", label: "صدر بالفعل" },
  { value: "releasing", label: "يعرض الآن" },
  { value: "announced", label: "معلن عنه" },
  { value: "ended", label: "منتهٍ" },
  { value: "unknown", label: "غير محدد" },
];
const audienceOptions = [
  { value: "General", label: "عام" },
  { value: "Teen", label: "مراهقون" },
  { value: "Young Adult", label: "شباب" },
  { value: "Adult", label: "بالغون" },
] as const;

function releaseTimestamp(work: Work) {
  const exact = work.releaseStart ? Date.parse(`${work.releaseStart}T00:00:00Z`) : Number.NaN;
  if (Number.isFinite(exact)) return exact;
  return work.year === null ? null : Date.UTC(work.year, 0, 1);
}

function stableTitleOrder(left: Work, right: Work) {
  return (
    (left.arabicTitle || left.title).localeCompare(right.arabicTitle || right.title, "ar") ||
    left.title.localeCompare(right.title, "en") ||
    left.id.localeCompare(right.id)
  );
}

function sortWorks(works: Work[], sort: CatalogSort) {
  return [...works].sort((left, right) => {
    if (sort === "ranked") {
      return (
        (right.calculatedRating ?? -1) - (left.calculatedRating ?? -1) ||
        compareReleaseDates(left, right, "newest") ||
        stableTitleOrder(left, right)
      );
    }
    return compareReleaseDates(left, right, sort) || stableTitleOrder(left, right);
  });
}

function compareReleaseDates(left: Work, right: Work, sort: "newest" | "oldest") {
  const leftRelease = releaseTimestamp(left);
  const rightRelease = releaseTimestamp(right);
  if (leftRelease === rightRelease) return 0;
  if (leftRelease === null) return 1;
  if (rightRelease === null) return -1;
  return sort === "newest" ? rightRelease - leftRelease : leftRelease - rightRelease;
}

function catalogCardKey(mode: "titles" | "installments", work: Work) {
  return [mode, work.installmentId ?? work.id].join(":");
}

function cycleFilterValue<T extends string>(filters: FilterValues<T>, value: T): FilterValues<T> {
  if (filters.include.includes(value)) {
    return {
      include: filters.include.filter((item) => item !== value),
      exclude: [...filters.exclude, value],
    };
  }
  if (filters.exclude.includes(value)) {
    return { include: filters.include, exclude: filters.exclude.filter((item) => item !== value) };
  }
  return { include: [...filters.include, value], exclude: filters.exclude };
}

function matchesFilter<T extends string>(values: readonly T[], filter: FilterValues<T>) {
  return (
    (!filter.include.length || filter.include.some((value) => values.includes(value))) &&
    !filter.exclude.some((value) => values.includes(value))
  );
}

function filterValueCount(filter: FilterValues) {
  return filter.include.length + filter.exclude.length;
}

function matchesCatalogQuery(work: Work, query: string) {
  if (!query) return true;
  return [
    work.title,
    work.arabicTitle,
    work.summary,
    work.creator,
    ...work.aliases,
    ...work.studios,
    ...work.animationStudios.map((studio) => studio.name),
    ...work.productionCompanies.map((company) => company.name),
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

export function DatabasePage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const { data: works } = useSuspenseQuery({
    queryKey: ["platform-catalog", "screen-only"],
    queryFn: () => getPlatformCatalogWorks(),
  });
  const { data: installments } = useSuspenseQuery({
    queryKey: ["platform-catalog", "installments"],
    queryFn: () => getPlatformCatalogInstallments(),
  });
  const [catalogState, setCatalogState] = useState<{
    mode: "titles" | "installments";
    sort: CatalogSort;
  }>({ mode: "titles", sort: "newest" });
  const { mode: catalogMode, sort } = catalogState;
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [minimumRating, setMinimumRating] = useState(0);
  const [view, setView] = useState<CatalogView>("poster");
  const [interactive, setInteractive] = useState(false);

  useEffect(() => setInteractive(true), []);

  const catalogWorks = useMemo(
    () =>
      (catalogMode === "titles" ? works : installments).filter((work) =>
        catalogKinds.includes(work.kind),
      ),
    [catalogMode, installments, works],
  );
  const filterOptions = useMemo(() => {
    const values = (select: (work: Work) => string[]) =>
      [...new Set(catalogWorks.flatMap(select))].sort((left, right) =>
        left.localeCompare(right, "ar"),
      );
    return {
      genres: values((work) => work.genres),
      tones: values((work) => work.tone),
      tags: values((work) => work.tags),
      countries: values((work) => work.country),
      decades: [
        ...new Set(
          catalogWorks.flatMap((work) =>
            work.year ? [String(Math.floor(work.year / 10) * 10)] : [],
          ),
        ),
      ].sort((left, right) => Number(right) - Number(left)),
    };
  }, [catalogWorks]);
  const visibleWorks = useMemo(
    () =>
      sortWorks(
        catalogWorks.filter((work) => {
          const decade = work.year ? String(Math.floor(work.year / 10) * 10) : null;
          return (
            matchesFilter([work.kind], filters.kinds) &&
            matchesFilter([work.releaseStatus], filters.releaseStatuses) &&
            matchesFilter(work.audience ? [work.audience] : [], filters.audiences) &&
            matchesFilter(work.genres, filters.genres) &&
            matchesFilter(work.tone, filters.tones) &&
            matchesFilter(work.tags, filters.tags) &&
            matchesFilter(work.country, filters.countries) &&
            matchesFilter(decade ? [decade] : [], filters.decades) &&
            matchesFilter(
              [work.calculatedRating === null ? "unrated" : "rated"],
              filters.ratingStates,
            ) &&
            matchesFilter([work.contentWarnings ? "warnings" : "none"], filters.warningStates) &&
            riskDimensions.every((dimension) =>
              matchesFilter(
                [work.riskProfile?.[dimension.value] ?? "unknown"],
                filters.risks[dimension.value],
              ),
            ) &&
            (work.calculatedRating ?? 0) >= minimumRating &&
            matchesCatalogQuery(work, normalizedQuery)
          );
        }),
        sort,
      ),
    [catalogWorks, filters, minimumRating, normalizedQuery, sort],
  );

  const clearFilters = () => {
    setQuery("");
    setFilters(emptyCatalogFilters());
    setMinimumRating(0);
  };
  const activeFilterCount =
    Number(Boolean(query)) +
    Object.values(filters).reduce(
      (count, filter) =>
        "include" in filter
          ? count + filterValueCount(filter)
          : count +
            Object.values(filter).reduce(
              (riskCount, riskFilter) => riskCount + filterValueCount(riskFilter),
              0,
            ),
      0,
    ) +
    Number(minimumRating > 0);

  return (
    <PlatformShell immersive>
      <section className="relative isolate overflow-hidden border-b border-white/8">
        <div
          className="archive-grid absolute inset-0 -z-10
 opacity-35"
        />
        <div className="absolute inset-x-0 top-0 -z-20 h-72 bg-linear-to-b from-primary/12 to-transparent" />
        <div className="mx-auto max-w-400 px-5 pb-12 pt-28 sm:px-8 sm:pt-36">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary">أرشيف نحّاسينما</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            قاعدة البيانات
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-foreground/75">
            أفلام ومسلسلات وأنمي، في مساحة واحدة قابلة للاستكشاف.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-400 px-5 pb-28 pt-8 sm:px-8">
        <div className="mb-7 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <InputGroup className="w-full sm:max-w-xl">
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث بالعربية أو الإنجليزية أو الاستوديو…"
                aria-label="البحث في قاعدة البيانات"
              />
              {query && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setQuery("")}
                    aria-label="مسح البحث"
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <p className="text-sm text-muted-foreground">
              {visibleWorks.length} من {catalogWorks.length} عمل
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <fieldset
              className="flex overflow-hidden rounded-3xl border bg-transparent"
              aria-label="مستوى عرض الكتالوج"
            >
              {(
                [
                  ["titles", "العناوين"],
                  ["installments", "المواسم والأفلام"],
                ] as const
              ).map(([mode, label]) => (
                <Button
                  key={mode}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!interactive}
                  aria-pressed={catalogMode === mode}
                  className="rounded-none border-0 px-3 shadow-none aria-pressed:bg-muted"
                  onClick={() => {
                    if (mode === catalogMode) return;
                    setCatalogState((current) => ({ ...current, mode }));
                    setFilters(emptyCatalogFilters());
                  }}
                >
                  {label}
                </Button>
              ))}
            </fieldset>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon data-icon="inline-start" />
                مسح المرشحات
              </Button>
            )}
            <CatalogFilterDialog
              filters={filters}
              onFiltersChange={setFilters}
              filterOptions={filterOptions}
              minimumRating={minimumRating}
              onMinimumRatingChange={setMinimumRating}
              activeFilterCount={activeFilterCount}
              onClear={clearFilters}
            />
            <FilterRow label="العرض">
              <ToggleGroup
                value={[view]}
                multiple={false}
                variant="outline"
                size="default"
                spacing={0}
                aria-label="طريقة عرض الأعمال"
                onValueChange={(values) => {
                  const next = values[0] as CatalogView | undefined;
                  if (next) setView(next);
                }}
              >
                <ToggleGroupItem value="poster" className={"w-0!"}>
                  <ImageIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="banner" className={"w-0!"}>
                  <PanoramaIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="logo" className={"w-0!"}>
                  <ImageSquareIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </FilterRow>
            <FilterRow label="الترتيب">
              <fieldset
                className="flex overflow-hidden rounded-3xl border bg-transparent"
                aria-label="ترتيب الأعمال"
              >
                {(
                  [
                    ["newest", "الأحدث"],
                    ["oldest", "الأقدم"],
                    ["ranked", "التقييم"],
                  ] as const
                ).map(([sortOption, label]) => (
                  <Button
                    key={sortOption}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!interactive}
                    aria-pressed={sort === sortOption}
                    className="rounded-none border-0 px-3 shadow-none aria-pressed:bg-muted"
                    onClick={() => setCatalogState((current) => ({ ...current, sort: sortOption }))}
                  >
                    {label}
                  </Button>
                ))}
              </fieldset>
            </FilterRow>
          </div>
        </div>

        {visibleWorks.length ? (
          <div
            className={
              view === "banner"
                ? "grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
            }
          >
            {visibleWorks.map((work) => (
              <WorkCard key={catalogCardKey(catalogMode, work)} work={work} variant={view} />
            ))}
          </div>
        ) : (
          <Empty className="min-h-80 border border-dashed border-white/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DatabaseIcon />
              </EmptyMedia>
              <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
              <EmptyDescription>جرّب توسيع البحث أو إزالة بعض المرشحات.</EmptyDescription>
            </EmptyHeader>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                مسح المرشحات
              </Button>
            )}
          </Empty>
        )}
      </section>
    </PlatformShell>
  );
}

function CatalogFilterDialog({
  filters,
  onFiltersChange,
  filterOptions,
  minimumRating,
  onMinimumRatingChange,
  activeFilterCount,
  onClear,
}: {
  filters: CatalogFilters;
  onFiltersChange: Dispatch<SetStateAction<CatalogFilters>>;
  filterOptions: {
    genres: string[];
    tones: string[];
    tags: string[];
    countries: string[];
    decades: string[];
  };
  minimumRating: number;
  onMinimumRatingChange: (value: number) => void;
  activeFilterCount: number;
  onClear: () => void;
}) {
  const { taxonomyLabel } = useArabicTranslations();
  const cycle = <K extends Exclude<keyof CatalogFilters, "risks">>(
    key: K,
    value: CatalogFilters[K]["include"][number],
  ) =>
    onFiltersChange((current) => ({
      ...current,
      [key]: cycleFilterValue(current[key], value),
    }));
  const cycleRisk = (dimension: RiskDimension, value: RiskLevel) =>
    onFiltersChange((current) => ({
      ...current,
      risks: {
        ...current.risks,
        [dimension]: cycleFilterValue(current.risks[dimension], value),
      },
    }));

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant={activeFilterCount ? "secondary" : "outline"} size="sm">
            <FunnelSimpleIcon data-icon="inline-start" />
            مرشحات{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
        }
      />
      <DialogContent
        className="max-h-[calc(100svh-2rem)] max-w-3xl gap-0 overflow-y-auto bg-background p-0 sm:max-w-3xl"
        dir="rtl"
      >
        <DialogHeader className="border-b border-white/8 px-6 py-5">
          <DialogTitle className="text-xl">استكشف المكتبة بدقة</DialogTitle>
          <DialogDescription>
            اضغط مرة للتضمين، مرة ثانية للاستبعاد، وثالثة لإزالة المرشح. تعمل شروط التضمين معاً،
            وتستبعد الخيارات المحددة دائماً.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-7 px-6 py-6">
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-s-2 border-primary/45 bg-primary/4 px-4 py-3 text-xs text-muted-foreground">
            <span>
              <b className="text-primary">مضمّن</b> يظهر فقط هذا الخيار
            </span>
            <span>
              <b className="text-destructive">مستبعَد</b> لا يظهر هذا الخيار
            </span>
            <span>تُطبّق الخيارات فوراً على النتائج.</span>
          </div>
          <FilterSection title="نوع العمل وحالته" description="حدد ما تريد رؤيته أو ما تريد إخفاءه">
            <TriStateChips
              values={filters.kinds}
              options={catalogKinds.map((value) => ({ value, label: kindLabels[value] }))}
              onCycle={(value) => cycle("kinds", value)}
            />
            <div className="mt-3">
              <TriStateChips
                values={filters.releaseStatuses}
                options={releaseStatusOptions}
                onCycle={(value) => cycle("releaseStatuses", value)}
              />
            </div>
          </FilterSection>
          <FilterSection title="الجمهور والإرشادات" description="الفئة العمرية والتحذيرات المسجلة">
            <TriStateChips
              values={filters.audiences}
              options={audienceOptions}
              onCycle={(value) => cycle("audiences", value)}
            />
            <div className="mt-3">
              <TriStateChips
                values={filters.warningStates}
                options={[
                  { value: "warnings", label: "به تحذيرات محتوى" },
                  { value: "none", label: "بلا تحذيرات مسجلة" },
                ]}
                onCycle={(value) => cycle("warningStates", value)}
              />
            </div>
          </FilterSection>
          <FilterSection
            title="مستويات المخاطر"
            description="اختر مستوى مستقلاً لكل نوع من أنواع الإرشاد"
          >
            <div className="grid gap-5 sm:grid-cols-3">
              {riskDimensions.map((dimension) => (
                <div key={dimension.value}>
                  <h4 className="text-sm font-semibold">{dimension.title}</h4>
                  <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
                    {dimension.description}
                  </p>
                  <TriStateChips
                    values={filters.risks[dimension.value]}
                    options={riskOptions}
                    onCycle={(value) => cycleRisk(dimension.value, value)}
                  />
                </div>
              ))}
            </div>
          </FilterSection>
          <FilterSection title="التصنيفات والأجواء" description="الأنواع الفنية والطابع والوسوم">
            <TriStateChips
              values={filters.genres}
              options={filterOptions.genres.map((value) => ({
                value,
                label: taxonomyLabel("genre", value),
              }))}
              onCycle={(value) => cycle("genres", value)}
            />
            {filterOptions.tones.length > 0 && (
              <div className="mt-3">
                <TriStateChips
                  values={filters.tones}
                  options={filterOptions.tones.map((value) => ({
                    value,
                    label: taxonomyLabel("tone", value),
                  }))}
                  onCycle={(value) => cycle("tones", value)}
                />
              </div>
            )}
            {filterOptions.tags.length > 0 && (
              <div className="mt-3 max-h-44 overflow-y-auto pe-2">
                <TriStateChips
                  values={filters.tags}
                  options={filterOptions.tags.map((value) => ({
                    value,
                    label: taxonomyLabel("tag", value),
                  }))}
                  onCycle={(value) => cycle("tags", value)}
                />
              </div>
            )}
          </FilterSection>
          <FilterSection title="الزمن والمنشأ" description="عقد الإصدار والبلد المنتج">
            <TriStateChips
              values={filters.decades}
              options={filterOptions.decades.map((value) => ({
                value,
                label: `${value}–${Number(value) + 9}`,
              }))}
              onCycle={(value) => cycle("decades", value)}
            />
            {filterOptions.countries.length > 0 && (
              <div className="mt-3">
                <TriStateChips
                  values={filters.countries}
                  options={filterOptions.countries.map((value) => ({
                    value,
                    label: taxonomyLabel("country", value),
                  }))}
                  onCycle={(value) => cycle("countries", value)}
                />
              </div>
            )}
          </FilterSection>
          <FilterSection
            title="التقييم"
            description="اختر الأعمال المقيمة أو غير المقيمة، ثم حدّد الحد الأدنى عند الحاجة"
          >
            <TriStateChips
              values={filters.ratingStates}
              options={[
                { value: "rated", label: "مقيّم" },
                { value: "unrated", label: "غير مقيّم" },
              ]}
              onCycle={(value) => cycle("ratingStates", value)}
            />
            <ToggleGroup
              value={[String(minimumRating)]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              className="mt-3"
              aria-label="التقييم الأدنى"
              onValueChange={(values) => {
                const next = Number(values[0]);
                if ([0, 6, 7, 8, 9].includes(next)) onMinimumRatingChange(next);
              }}
            >
              <ToggleGroupItem value="0">الكل</ToggleGroupItem>
              <ToggleGroupItem value="6">+6</ToggleGroupItem>
              <ToggleGroupItem value="7">+7</ToggleGroupItem>
              <ToggleGroupItem value="8">+8</ToggleGroupItem>
              <ToggleGroupItem value="9">+9</ToggleGroupItem>
            </ToggleGroup>
          </FilterSection>
        </div>
        <DialogFooter className="sticky bottom-0 border-t border-white/8 bg-background px-6 py-4">
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={onClear}>
              <XIcon data-icon="inline-start" />
              مسح الكل
            </Button>
          )}
          <DialogClose render={<Button />}>عرض النتائج</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TriStateChips<T extends string>({
  values,
  options,
  onCycle,
}: {
  values: FilterValues<T>;
  options: ReadonlyArray<{ value: T; label: string }>;
  onCycle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const mode = values.include.includes(option.value)
          ? "include"
          : values.exclude.includes(option.value)
            ? "exclude"
            : null;
        return (
          <Button
            key={option.value}
            type="button"
            variant={
              mode === "exclude" ? "destructive" : mode === "include" ? "secondary" : "outline"
            }
            size="sm"
            aria-pressed={Boolean(mode)}
            aria-label={`${option.label}: ${mode === "include" ? "مضمّن" : mode === "exclude" ? "مستبعَد" : "دون مرشح"}`}
            className="transition-colors"
            onClick={() => onCycle(option.value)}
          >
            {mode === "include" ? "+ " : mode === "exclude" ? "− " : ""}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function FilterSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-s-2 border-primary/45 ps-4">
      <h3 className="font-heading font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
