import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CheckIcon,
  FunnelSimpleIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  hiddenCount = 0,
  title = "فلترة هذا العرض",
  triggerLabel = "الفلاتر",
}: {
  filters: WorkFilterState;
  facetOptions: FacetOptions;
  onChange: (filters: WorkFilterState) => void;
  matchingCount: number;
  hiddenCount?: number;
  title?: string;
  triggerLabel?: string;
}) {
  const { facetValueLabel } = useArabicTranslations();
  const [facetSearch, setFacetSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("basics");
  const activeCount = countActiveFilters(filters);

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

  const clear = () => {
    onChange(createDefaultFilters());
    setFacetSearch("");
  };

  const onSearchChange = (value: string) => {
    setFacetSearch(value);
    if (value.trim()) setTab("facets");
  };

  const activeFacetCount = Object.values(filters.facets).reduce(
    (sum, selection) => sum + selection.include.length + selection.exclude.length,
    0,
  );
  const activeRatingCount = Object.keys(filters.minScores).length + Number(filters.minRating > 0);

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
            className="size-10 gap-1.5 border-border/60 px-0 text-xs sm:h-8 sm:w-auto sm:px-3"
            aria-label={triggerLabel}
          >
            <FunnelSimpleIcon data-icon="inline-start" className="text-muted-foreground" />
            <span className="hidden sm:inline">{triggerLabel}</span>
            {activeCount > 0 && (
              <Badge
                variant="default"
                className="ml-0.5 h-4 px-1 font-mono text-[10px] leading-none"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />

      <DialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* Fixed Header */}
        <DialogHeader className="gap-1 border-b border-border/40 p-5 pb-4 text-start">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs leading-normal">
            اضغط مرة للتضمين، ومرتين للاستبعاد، وثلاث مرات لإلغاء الاختيار.
          </DialogDescription>
        </DialogHeader>

        {/* Search + active filter summary — always visible, above the tabs */}
        <div className="flex flex-col gap-3 border-b border-border/40 p-5 pb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={facetSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="ابحث عن تصنيف أو وسم أو استوديو أو دولة…"
              className="h-9 pl-9 text-xs"
              aria-label="البحث في قيم الفلاتر"
            />
            {facetSearch && (
              <button
                type="button"
                onClick={() => setFacetSearch("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="مسح البحث"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    chip.tone === "include" &&
                      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                    chip.tone === "exclude" &&
                      "border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300",
                    chip.tone === "neutral" &&
                      "border-primary/25 bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                >
                  {chip.label}
                  <XIcon className="size-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={clear}
                className="mr-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowCounterClockwiseIcon className="size-3" />
                مسح الكل
              </button>
            </div>
          )}
        </div>

        {/* Tabs replace one long scroll with three focused groups */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as FilterTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-5 mt-4 grid grid-cols-3">
            <TabsTrigger value="basics" className="text-xs">
              الأساسيات
            </TabsTrigger>
            <TabsTrigger value="ratings" className="gap-1 text-xs">
              التقييمات
              {activeRatingCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px] leading-none">
                  {activeRatingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="facets" className="gap-1 text-xs">
              التصنيفات
              {activeFacetCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px] leading-none">
                  {activeFacetCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-5">
            <TabsContent value="basics" className="mt-0 flex flex-col gap-5">
              <FieldSet>
                <FieldLegend>مخفية افتراضيًا</FieldLegend>
                <FieldDescription>
                  {hiddenCount > 0
                    ? `${hiddenCount} عمل مخفي بهذه القواعد. يمكنك إظهاره هنا.`
                    : "الأعمال المحفوظة والقادمة وأفلام الأجزاء التالية تبقى خارج الاكتشاف."}
                </FieldDescription>
                <FieldGroup>
                  {[
                    ["showSaved", "المحفوظة", "أظهر الأعمال المحفوظة للعودة إليها لاحقًا"],
                    ["showAnnounced", "القادمة", "أظهر الأعمال المعلنة التي لم يبدأ إصدارها"],
                    [
                      "showSequelMovies",
                      "أفلام الأجزاء التالية",
                      "أظهر الأفلام التي تتابع عملاً سابقًا",
                    ],
                  ].map(([key, label, description]) => (
                    <Field key={key} orientation="horizontal">
                      <div className="flex flex-1 flex-col gap-0.5">
                        <FieldLabel htmlFor={`visibility-${key}`}>{label}</FieldLabel>
                        <FieldDescription>{description}</FieldDescription>
                      </div>
                      <Switch
                        id={`visibility-${key}`}
                        aria-label={label}
                        checked={
                          filters[
                            key as keyof Pick<
                              WorkFilterState,
                              "showSaved" | "showAnnounced" | "showSequelMovies"
                            >
                          ]
                        }
                        onCheckedChange={(checked) => onChange({ ...filters, [key]: checked })}
                      />
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>

              <Separator className="bg-border/40" />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  النوع
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {workKinds.map((kind) => (
                    <TriStateButton
                      key={kind}
                      label={kindLabels[kind]}
                      state={getState(filters.kinds, filters.excludedKinds, kind)}
                      onClick={() => toggleKind(kind)}
                    />
                  ))}
                </div>
              </div>

              <Separator className="bg-border/40" />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  الحالة
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {personalStatuses.map((status) => (
                    <TriStateButton
                      key={status}
                      label={statusLabelsAr[status]}
                      state={getState(filters.statuses, filters.excludedStatuses, status)}
                      onClick={() => toggleStatus(status)}
                    />
                  ))}
                </div>
              </div>

              <Separator className="bg-border/40" />

              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="filter-year-from">صدر بعد</FieldLabel>
                  <Input
                    id="filter-year-from"
                    type="number"
                    placeholder="أي سنة"
                    className="h-9 text-xs"
                    value={filters.yearFrom ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...filters,
                        yearFrom: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="filter-year-to">صدر قبل</FieldLabel>
                  <Input
                    id="filter-year-to"
                    type="number"
                    placeholder="أي سنة"
                    className="h-9 text-xs"
                    value={filters.yearTo ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...filters,
                        yearTo: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </Field>
              </FieldGroup>

              <button
                type="button"
                onClick={() => onChange({ ...filters, favoriteOnly: !filters.favoriteOnly })}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-start transition-colors",
                  filters.favoriteOnly
                    ? "border-rose-500/25 bg-rose-500/10"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <HeartIcon
                    weight={filters.favoriteOnly ? "fill" : "regular"}
                    className={cn(
                      "size-4",
                      filters.favoriteOnly
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">المفضلة فقط</span>
                    <span className="text-[11px] text-muted-foreground">
                      عرض الأعمال المضافة إلى المفضلة فقط
                    </span>
                  </div>
                </div>
                <Switch
                  checked={filters.favoriteOnly}
                  onCheckedChange={(favoriteOnly) => onChange({ ...filters, favoriteOnly })}
                />
              </button>
            </TabsContent>

            <TabsContent value="ratings" className="mt-0">
              <FieldSet className="gap-4 rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <FieldLegend className="mb-1 flex items-center gap-1.5 text-sm">
                      <StarIcon weight="fill" className="size-3.5 text-amber-500" />
                      حدود التقييم
                    </FieldLegend>
                    <FieldDescription className="text-xs">
                      اعرض الأعمال التي تبلغ هذه الدرجات أو تتجاوزها.
                    </FieldDescription>
                  </div>
                  {activeRatingCount > 0 && (
                    <Badge variant="secondary" className="shrink-0 font-mono">
                      {activeRatingCount} نشط
                    </Badge>
                  )}
                </div>

                <ScoreThreshold
                  label="التقييم الكلي"
                  value={filters.minRating}
                  onChange={(minRating) => onChange({ ...filters, minRating })}
                />

                <Separator className="bg-border/40" />

                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {scoreCriteria.map((criterion) => (
                    <ScoreThreshold
                      key={criterion}
                      label={scoreCriterionLabels[criterion].ar}
                      value={filters.minScores[criterion] ?? 0}
                      onChange={(value) => setMinScore(criterion, value)}
                    />
                  ))}
                </div>
              </FieldSet>
            </TabsContent>

            <TabsContent value="facets" className="mt-0 flex flex-col gap-3">
              {facetDefinitions.map((definition) => (
                <FacetSection
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
            </TabsContent>
          </div>
        </Tabs>

        {/* Fixed Footer */}
        <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t border-border/40 bg-background/95 p-4 backdrop-blur sm:justify-between">
          <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">
              {matchingCount}
            </span>
            <span>عمل مطابق</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={clear}
              disabled={!activeCount}
            >
              مسح الكل
            </Button>
            <DialogClose
              render={
                <Button size="sm" className="h-8 text-xs">
                  تم
                </Button>
              }
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Active-filter chip summary                                                */
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
      label: kindLabels[kind],
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
      label: statusLabelsAr[status],
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
        label: facetValueLabel(definition.key, value),
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

function ScoreThreshold({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <Badge
          variant={value > 0 ? "default" : "outline"}
          className="min-w-11 justify-center font-mono tabular-nums"
        >
          {value > 0 ? `${value}+` : "الكل"}
        </Badge>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={10}
        step={1}
        aria-label={`الحد الأدنى لـ ${label}`}
        onValueChange={(next) => onChange(typeof next === "number" ? next : (next[0] ?? value))}
      />
    </Field>
  );
}

type TriState = "include" | "exclude" | "neutral";

function getState<T extends string>(include: T[], exclude: T[], value: T): TriState {
  if (include.includes(value)) return "include";
  if (exclude.includes(value)) return "exclude";
  return "neutral";
}

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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-all duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:scale-95",
        state === "include" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-xs hover:bg-emerald-500/20 dark:text-emerald-300",
        state === "exclude" &&
          "border-rose-500/30 bg-rose-500/10 text-rose-700 shadow-xs hover:bg-rose-500/20 dark:text-rose-300",
        state === "neutral" &&
          "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-label={`${label}: ${state}`}
    >
      {state === "include" && (
        <CheckIcon className="size-3 shrink-0 stroke-3 text-emerald-600 dark:text-emerald-400" />
      )}
      {state === "exclude" && (
        <MinusIcon className="size-3 shrink-0 stroke-3 text-rose-600 dark:text-rose-400" />
      )}
      <span>{label}</span>
    </button>
  );
}

function FacetSection({
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
      className="group overflow-hidden rounded-lg border border-border/50 bg-background transition-all [[open]]:shadow-xs"
      open={defaultOpen || Boolean(normalizedSearch)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between bg-muted/20 p-3 text-xs font-medium transition-colors select-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <CaretDownIcon className="size-3 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          {label}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {selectedCount ? (
            <span className="font-semibold text-primary">{selectedCount} نشط</span>
          ) : (
            `${options.length} قيمة`
          )}
        </span>
      </summary>

      {visible.length === 0 ? (
        <p className="border-t border-border/40 p-3 text-center text-[11px] text-muted-foreground">
          لا توجد نتائج مطابقة للبحث
        </p>
      ) : (
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto border-t border-border/40 p-3">
          {visible.map((option) => {
            const state = getState(selection.include, selection.exclude, option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:scale-95",
                  state === "include" &&
                    "border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300",
                  state === "exclude" &&
                    "border-rose-500/30 bg-rose-500/10 font-medium text-rose-700 dark:text-rose-300",
                  state === "neutral" &&
                    "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => onToggle(option.value)}
                aria-label={`${valueLabel(option.value)}: ${state}`}
              >
                {state === "include" && (
                  <CheckIcon className="size-3 shrink-0 stroke-3 text-emerald-600 dark:text-emerald-400" />
                )}
                {state === "exclude" && (
                  <MinusIcon className="size-3 shrink-0 stroke-3 text-rose-600 dark:text-rose-400" />
                )}
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
