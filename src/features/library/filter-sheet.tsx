import {
  CaretDownIcon,
  CheckIcon,
  FunnelSimpleIcon,
  HeartIcon,
  LockKeyIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  FacetFilters,
  FacetOption,
  FacetOptions,
  FacetSelection,
  WorkFilterState,
} from "./filtering";
import {
  countActiveFilters,
  createDefaultFilters,
  cycleCategoricalValue,
  cycleSelection,
  facetDefinitions,
  kindLabels,
  personalStatuses,
} from "./filtering";
import type { Work, WorkKind } from "./model";
import { workKinds } from "./model";
import type { ScoreComponents, ScoreCriterion } from "./scoring";
import { scoreCriteria, scoreCriterionLabels } from "./scoring";
import { facetLabelsAr, statusLabelsAr, useArabicTranslations } from "./translations";

type FilterTab = "basics" | "ratings" | "facets";

export function AdvancedFilter({
  filters,
  facetOptions,
  onChange,
  matchingCount,
  title = "فلترة العرض",
  triggerLabel = "الفلاتر",
}: {
  filters: WorkFilterState;
  facetOptions: FacetOptions;
  onChange: (filters: WorkFilterState) => void;
  matchingCount: number;
  title?: string;
  triggerLabel?: string;
}) {
  const { facetValueLabel } = useArabicTranslations();
  const [facetSearch, setFacetSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("basics");

  const activeCount = countActiveFilters(filters);

  // Active items counts per tab
  const activeRatingCount = Object.keys(filters.minScores).length + Number(filters.minRating > 0);

  const activeFacetCount = Object.values(filters.facets).reduce(
    (sum, selection) => sum + selection.include.length + selection.exclude.length,
    0,
  );

  const toggleKind = (kind: WorkKind) => {
    const next = cycleCategoricalValue(filters.kinds, filters.excludedKinds, kind);
    onChange({
      ...filters,
      kinds: next.include,
      excludedKinds: next.exclude,
    });
  };

  const toggleStatus = (status: Work["status"]) => {
    const next = cycleCategoricalValue(filters.statuses, filters.excludedStatuses, status);
    onChange({
      ...filters,
      statuses: next.include,
      excludedStatuses: next.exclude,
    });
  };

  const toggleFacet = (key: keyof FacetFilters, value: string) => {
    onChange({
      ...filters,
      facets: {
        ...filters.facets,
        [key]: cycleSelection(filters.facets[key], value),
      },
    });
  };

  const setMinScore = (criterion: ScoreCriterion, value: number) => {
    onChange({
      ...filters,
      minScores: updateMinimumScore(filters.minScores, criterion, value),
    });
  };

  const clearAll = () => {
    onChange(createDefaultFilters());
    setFacetSearch("");
  };

  const chips = buildActiveChips({
    filters,
    onChange,
    toggleKind,
    toggleStatus,
    toggleFacet,
    setMinScore,
    facetValueLabel,
  });

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant={activeCount ? "secondary" : "outline"}
            size="sm"
            className="relative h-9 gap-2 border-border/70 px-3 font-medium transition-all hover:bg-muted"
            aria-label={triggerLabel}
          >
            <FunnelSimpleIcon className="size-4 text-muted-foreground" />
            <span>{triggerLabel}</span>
            {activeCount > 0 && (
              <Badge
                variant="default"
                className="h-5 min-w-5 justify-center px-1 font-mono text-[11px]"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />

      <DialogContent className="flex max-h-[90vh] w-full max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/50 px-5 py-4 text-start">
          <div className="space-y-0.5">
            <DialogTitle className="text-base font-bold tracking-tight">{title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تخصيص نتائج البحث بدقة والتنقل بسهولة بين الخيارات.
            </DialogDescription>
          </div>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashIcon className="size-3.5" />
              <span>إعادة ضبط</span>
            </Button>
          )}
        </DialogHeader>

        {/* Active Chips Strip (Scrollable horizontally) */}
        {chips.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/40 bg-muted/30 px-5 py-2.5 scrollbar-none">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              النشطة ({chips.length}):
            </span>
            <div className="flex items-center gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
                    chip.tone === "include" &&
                      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
                    chip.tone === "exclude" &&
                      "border-rose-500/30 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300",
                    chip.tone === "neutral" &&
                      "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                >
                  <span>{chip.label}</span>
                  <XIcon className="size-3 opacity-70 hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Tabs Navigation */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as FilterTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b border-border/40 px-5 pt-3">
            <TabsList className="grid w-full grid-cols-3 bg-muted/60 p-1">
              <TabsTrigger value="basics" className="text-xs font-semibold">
                الأساسيات
              </TabsTrigger>
              <TabsTrigger value="ratings" className="gap-1.5 text-xs font-semibold">
                <span>التقييمات</span>
                {activeRatingCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px]">
                    {activeRatingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="facets" className="gap-1.5 text-xs font-semibold">
                <span>التصنيفات</span>
                {activeFacetCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px]">
                    {activeFacetCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* TAB 1: BASICS */}
            <TabsContent value="basics" className="mt-0 flex flex-col gap-6">
              {/* Media Type Section */}
              <FilterSectionCard title="نوع العمل" description="تصفية حسب نوع وسائط المحتوى">
                <div className="flex flex-wrap gap-2">
                  {workKinds.map((kind) => (
                    <TriStateButton
                      key={kind}
                      label={kindLabels[kind]}
                      state={getState(filters.kinds, filters.excludedKinds, kind)}
                      onClick={() => toggleKind(kind)}
                    />
                  ))}
                </div>
              </FilterSectionCard>

              {/* Status Section */}
              <FilterSectionCard
                title="الحالة الشخصية"
                description="تصفية المحتوى بناءً على حالة المتابعة"
              >
                <div className="flex flex-wrap gap-2">
                  {personalStatuses.map((status) => (
                    <TriStateButton
                      key={status}
                      label={statusLabelsAr[status]}
                      state={getState(filters.statuses, filters.excludedStatuses, status)}
                      onClick={() => toggleStatus(status)}
                    />
                  ))}
                </div>
              </FilterSectionCard>

              {/* Release Year Section */}
              <FilterSectionCard
                title="تاريخ الإصدار"
                description="حدد النطاق الزمني لسنوات الإصدار"
              >
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="filter-year-from"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        من سنة
                      </label>
                      <Input
                        id="filter-year-from"
                        type="number"
                        placeholder="مثال: 2015"
                        className="h-9 text-xs"
                        value={filters.yearFrom ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...filters,
                            yearFrom: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="filter-year-to"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        إلى سنة
                      </label>
                      <Input
                        id="filter-year-to"
                        type="number"
                        placeholder="مثال: 2024"
                        className="h-9 text-xs"
                        value={filters.yearTo ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...filters,
                            yearTo: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Year Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">اختصارات:</span>
                    {[
                      { label: "2020+", from: 2020, to: null },
                      { label: "2010s", from: 2010, to: 2019 },
                      { label: "2000s", from: 2000, to: 2009 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filters,
                            yearFrom: preset.from,
                            yearTo: preset.to,
                          })
                        }
                        className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </FilterSectionCard>

              <FilterSectionCard
                title="خيارات العرض"
                description="اعرض المفضلة أو السجلات الخاصة فقط. الأعمال المحفوظة والقادمة وأفلام التكملة ظاهرة افتراضياً."
              >
                <div className="space-y-3">
                  {/* Favorite Toggle */}
                  <Button
                    variant={"outline"}
                    onClick={() => onChange({ ...filters, favoriteOnly: !filters.favoriteOnly })}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-lg! border p-3 transition-colors w-full max-h-none! h-auto",
                      filters.favoriteOnly
                        ? "border-rose-500/30 bg-rose-500/10"
                        : "border-border/50 bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <HeartIcon
                        weight={filters.favoriteOnly ? "fill" : "regular"}
                        className={cn(
                          "size-5 shrink-0",
                          filters.favoriteOnly ? "text-rose-500" : "text-muted-foreground",
                        )}
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">المفضلة فقط</p>
                        <p className="text-[11px] text-muted-foreground">
                          حصر النتائج في القائمة المفضلة
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={filters.favoriteOnly}
                      onCheckedChange={(favoriteOnly) => onChange({ ...filters, favoriteOnly })}
                    />
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onChange({ ...filters, privateOnly: !filters.privateOnly })}
                    className={cn(
                      "flex h-auto max-h-none w-full cursor-pointer items-center justify-between rounded-lg! border p-3 transition-colors",
                      filters.privateOnly
                        ? "border-primary/30 bg-primary/10"
                        : "border-border/50 bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <LockKeyIcon
                        weight={filters.privateOnly ? "fill" : "regular"}
                        className={cn(
                          "size-5 shrink-0",
                          filters.privateOnly ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">الخاصة فقط</p>
                        <p className="text-[11px] text-muted-foreground">
                          إظهار السجلات المخفية عن المنصة
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={filters.privateOnly}
                      onCheckedChange={(privateOnly) => onChange({ ...filters, privateOnly })}
                    />
                  </Button>
                </div>
              </FilterSectionCard>
            </TabsContent>

            {/* TAB 2: RATINGS */}
            <TabsContent value="ratings" className="mt-0 space-y-5">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="mb-4 space-y-1">
                  <h4 className="flex items-center gap-2 text-sm font-bold">
                    <StarIcon weight="fill" className="size-4 text-amber-500" />
                    <span>الحد الأدنى للتقييم الإجمالي</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    تصفية الأعمال التي تحقق هذا التقييم الكلي أو أعلى
                  </p>
                </div>

                <ScoreThreshold
                  label="التقييم الكلي"
                  value={filters.minRating}
                  onChange={(minRating) => onChange({ ...filters, minRating })}
                />
              </div>

              <FilterSectionCard
                title="تفاصيل معايير التقييم"
                description="تحديد حد أدنى لكل معيار على حدة"
              >
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  {scoreCriteria.map((criterion) => (
                    <ScoreThreshold
                      key={criterion}
                      label={scoreCriterionLabels[criterion].ar}
                      value={filters.minScores[criterion] ?? 0}
                      onChange={(value) => setMinScore(criterion, value)}
                    />
                  ))}
                </div>
              </FilterSectionCard>
            </TabsContent>

            {/* TAB 3: FACETS */}
            <TabsContent value="facets" className="mt-0 space-y-4">
              {/* Tab-Scoped Search Input */}
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={facetSearch}
                  onChange={(e) => setFacetSearch(e.target.value)}
                  placeholder="ابحث في التصنيفات، الوسوم، الاستوديوهات..."
                  className="h-10 pr-9 pl-9 text-xs"
                />
                {facetSearch && (
                  <button
                    type="button"
                    onClick={() => setFacetSearch("")}
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Facet Accordion Sections */}
              <div className="space-y-3">
                {facetDefinitions.map((definition) => (
                  <FacetSectionCard
                    key={definition.key}
                    label={facetLabelsAr[definition.key]}
                    options={facetOptions[definition.key]}
                    selection={filters.facets[definition.key]}
                    search={facetSearch}
                    onToggle={(value) => toggleFacet(definition.key, value)}
                    valueLabel={(value) => facetValueLabel(definition.key, value)}
                    defaultOpen={definition.defaultOpen}
                  />
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="flex flex-row items-center justify-between border-t border-border/50 bg-background px-5 py-3.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-base font-bold text-foreground">{matchingCount}</span>
            <span>نتيجة مطابقة</span>
          </div>
          <DialogClose
            render={
              <Button size="sm" className="h-8 min-w-20 text-xs font-semibold">
                تم
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helper UI Components & Cards                                             */
/* -------------------------------------------------------------------------- */

function FilterSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4 shadow-xs">
      <div className="mb-3 space-y-0.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h4>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

type TriState = "include" | "exclude" | "neutral";

function getState<T extends string>(include: T[], exclude: T[], value: T): TriState {
  if (include.includes(value)) return "include";
  if (exclude.includes(value)) return "exclude";
  return "neutral";
}

/**
 * Enhanced Segmented Tri-State Control Button
 */
function TriStateButton({
  label,
  state,
  onClick,
}: {
  label: string;
  state: TriState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-1 focus:ring-ring active:scale-95",
        state === "include" &&
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 font-semibold shadow-2xs dark:text-emerald-300",
        state === "exclude" &&
          "border-rose-500/40 bg-rose-500/15 text-rose-700 font-semibold shadow-2xs dark:text-rose-300",
        state === "neutral" &&
          "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-label={`${label}: ${state === "include" ? "مضمن" : state === "exclude" ? "مستبعد" : "غير محدد"}`}
    >
      {state === "include" && (
        <CheckIcon className="size-3.5 stroke-3 text-emerald-600 dark:text-emerald-400" />
      )}
      {state === "exclude" && (
        <MinusIcon className="size-3.5 stroke-3 text-rose-600 dark:text-rose-400" />
      )}
      <span>{label}</span>
    </button>
  );
}

function ScoreThreshold({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const sliderId = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={sliderId} className="font-medium text-foreground">
          {label}
        </label>
        <Badge
          variant={value > 0 ? "default" : "outline"}
          className="min-w-10 justify-center font-mono text-[11px] tabular-nums"
        >
          {value > 0 ? `${value}+` : "الكل"}
        </Badge>
      </div>
      <Slider
        id={sliderId}
        value={[value]}
        min={0}
        max={10}
        step={1}
        aria-label={`الحد الأدنى لـ ${label}`}
        onValueChange={(next) => onChange(typeof next === "number" ? next : (next[0] ?? value))}
      />
    </div>
  );
}

function FacetSectionCard({
  label,
  options,
  selection,
  search,
  onToggle,
  valueLabel,
  defaultOpen = false,
}: {
  label: string;
  options: FacetOption[];
  selection: FacetSelection;
  search: string;
  onToggle: (value: string) => void;
  valueLabel: (value: string) => string;
  defaultOpen?: boolean;
}) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visible = options.filter(
    (option) =>
      !normalizedSearch ||
      option.value.toLocaleLowerCase().includes(normalizedSearch) ||
      valueLabel(option.value).toLocaleLowerCase().includes(normalizedSearch),
  );

  const selectedCount = selection.include.length + selection.exclude.length;
  if (!visible.length && !selectedCount) return null;

  return (
    <details
      className="group overflow-hidden rounded-xl border border-border/60 bg-background transition-all [[open]]:shadow-xs"
      open={defaultOpen || Boolean(normalizedSearch)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between bg-muted/20 px-4 py-3 text-xs font-semibold select-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-foreground">
          <CaretDownIcon className="size-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          {label}
        </span>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <Badge variant="default" className="h-5 px-1.5 font-mono text-[10px]">
              {selectedCount} نشط
            </Badge>
          ) : (
            <span className="font-mono text-[11px] text-muted-foreground">
              {options.length} عنصر
            </span>
          )}
        </div>
      </summary>

      {visible.length === 0 ? (
        <p className="border-t border-border/40 p-3 text-center text-[11px] text-muted-foreground">
          لا توجد نتائج مطابقة
        </p>
      ) : (
        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto border-t border-border/40 p-3">
          {visible.map((option) => {
            const state = getState(selection.include, selection.exclude, option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-all active:scale-95",
                  state === "include" &&
                    "border-emerald-500/30 bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300",
                  state === "exclude" &&
                    "border-rose-500/30 bg-rose-500/15 font-medium text-rose-700 dark:text-rose-300",
                  state === "neutral" &&
                    "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {state === "include" && <CheckIcon className="size-3 stroke-3 text-emerald-600" />}
                {state === "exclude" && <MinusIcon className="size-3 stroke-3 text-rose-600" />}
                <span>{valueLabel(option.value)}</span>
                <span className="font-mono text-[10px] opacity-60">({option.count})</span>
              </button>
            );
          })}
        </div>
      )}
    </details>
  );
}

/* -------------------------------------------------------------------------- */
/*  Utilities                                                                 */
/* -------------------------------------------------------------------------- */

type ChipTone = "include" | "exclude" | "neutral";
type Chip = { key: string; label: string; tone: ChipTone; onRemove: () => void };

function buildActiveChips({
  filters,
  onChange,
  toggleKind,
  toggleStatus,
  toggleFacet,
  setMinScore,
  facetValueLabel,
}: {
  filters: WorkFilterState;
  onChange: (filters: WorkFilterState) => void;
  toggleKind: (kind: WorkKind) => void;
  toggleStatus: (status: Work["status"]) => void;
  toggleFacet: (key: keyof FacetFilters, value: string) => void;
  setMinScore: (criterion: ScoreCriterion, value: number) => void;
  facetValueLabel: (key: keyof FacetFilters, value: string) => string;
}): Chip[] {
  const chips: Chip[] = [];

  filters.kinds.map((kind) =>
    chips.push({
      key: `kind-in-${kind}`,
      label: kindLabels[kind],
      tone: "include",
      onRemove: () => toggleKind(kind),
    }),
  );
  filters.excludedKinds.map((kind) =>
    chips.push({
      key: `kind-out-${kind}`,
      label: `استبعاد: ${kindLabels[kind]}`,
      tone: "exclude",
      onRemove: () => toggleKind(kind),
    }),
  );
  filters.statuses.map((status) =>
    chips.push({
      key: `status-in-${status}`,
      label: statusLabelsAr[status],
      tone: "include",
      onRemove: () => toggleStatus(status),
    }),
  );
  filters.excludedStatuses.map((status) =>
    chips.push({
      key: `status-out-${status}`,
      label: `استبعاد: ${statusLabelsAr[status]}`,
      tone: "exclude",
      onRemove: () => toggleStatus(status),
    }),
  );
  if (filters.minRating > 0) {
    chips.push({
      key: "rating",
      label: `التقييم ${filters.minRating}+`,
      tone: "neutral",
      onRemove: () => onChange({ ...filters, minRating: 0 }),
    });
  }
  scoreCriteria.forEach((criterion) => {
    const value = filters.minScores[criterion];
    if (value) {
      chips.push({
        key: `score-${criterion}`,
        label: `${scoreCriterionLabels[criterion].ar} ${value}+`,
        tone: "neutral",
        onRemove: () => setMinScore(criterion, 0),
      });
    }
  });
  if (filters.favoriteOnly) {
    chips.push({
      key: "favorite",
      label: "المفضلة فقط",
      tone: "neutral",
      onRemove: () => onChange({ ...filters, favoriteOnly: false }),
    });
  }
  if (filters.privateOnly) {
    chips.push({
      key: "private",
      label: "الخاصة فقط",
      tone: "neutral",
      onRemove: () => onChange({ ...filters, privateOnly: false }),
    });
  }
  if (filters.yearFrom) {
    chips.push({
      key: "year-from",
      label: `بعد ${filters.yearFrom}`,
      tone: "neutral",
      onRemove: () => onChange({ ...filters, yearFrom: null }),
    });
  }
  if (filters.yearTo) {
    chips.push({
      key: "year-to",
      label: `قبل ${filters.yearTo}`,
      tone: "neutral",
      onRemove: () => onChange({ ...filters, yearTo: null }),
    });
  }
  facetDefinitions.forEach((definition) => {
    const selection = filters.facets[definition.key];
    selection.include.map((value) =>
      chips.push({
        key: `${definition.key}-in-${value}`,
        label: facetValueLabel(definition.key, value),
        tone: "include",
        onRemove: () => toggleFacet(definition.key, value),
      }),
    );
    selection.exclude.map((value) =>
      chips.push({
        key: `${definition.key}-out-${value}`,
        label: `استبعاد: ${facetValueLabel(definition.key, value)}`,
        tone: "exclude",
        onRemove: () => toggleFacet(definition.key, value),
      }),
    );
  });

  return chips;
}

function updateMinimumScore(scores: ScoreComponents, criterion: ScoreCriterion, value: number) {
  if (value === 0) {
    const next = { ...scores };
    delete next[criterion];
    return next;
  }
  return { ...scores, [criterion]: value };
}
