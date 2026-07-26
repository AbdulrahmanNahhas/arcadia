import { useState } from "react"
import {
  CheckIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { workKinds } from "./model"
import type { Work, WorkKind } from "./model"
import {
  countActiveFilters,
  createEmptyFacetFilters,
  cycleCategoricalValue,
  cycleSelection,
  facetDefinitions,
  kindLabels,
  personalStatuses,
} from "./filtering"
import type {
  FacetFilters,
  FacetOption,
  FacetOptions,
  FacetSelection,
  WorkFilterState,
} from "./filtering"
import {
  facetLabelsAr,
  statusLabelsAr,
  useArabicTranslations,
} from "./translations"

export function AdvancedFilter({
  filters,
  facetOptions,
  onChange,
  matchingCount,
  title = "فلترة هذا العرض",
  triggerLabel = "الفلاتر",
}: {
  filters: WorkFilterState
  facetOptions: FacetOptions
  onChange: (filters: WorkFilterState) => void
  matchingCount: number
  title?: string
  triggerLabel?: string
}) {
  const { facetValueLabel } = useArabicTranslations()
  const [facetSearch, setFacetSearch] = useState("")
  const activeCount = countActiveFilters(filters)

  const toggleKind = (kind: WorkKind) => {
    const next = cycleCategoricalValue(
      filters.kinds,
      filters.excludedKinds,
      kind
    )
    onChange({
      ...filters,
      kinds: next.include,
      excludedKinds: next.exclude,
    })
  }

  const toggleStatus = (status: Work["status"]) => {
    const next = cycleCategoricalValue(
      filters.statuses,
      filters.excludedStatuses,
      status
    )
    onChange({
      ...filters,
      statuses: next.include,
      excludedStatuses: next.exclude,
    })
  }

  const toggleFacet = (key: keyof FacetFilters, value: string) => {
    onChange({
      ...filters,
      facets: {
        ...filters.facets,
        [key]: cycleSelection(filters.facets[key], value),
      },
    })
  }

  const clear = () =>
    onChange({
      kinds: [],
      excludedKinds: [],
      statuses: [],
      excludedStatuses: [],
      minRating: 0,
      favoriteOnly: false,
      yearFrom: null,
      yearTo: null,
      facets: createEmptyFacetFilters(),
    })

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant={activeCount ? "secondary" : "outline"}
            size="sm"
            className="h-8 gap-1.5 border-border/60 text-xs"
          >
            <FunnelSimpleIcon className="size-3.5 text-muted-foreground" />
            <span>{triggerLabel}</span>
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

      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {/* Fixed Header */}
        <SheetHeader className="space-y-1 border-b border-border/40 p-5 pb-4 text-left">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          <SheetDescription className="text-xs leading-normal">
            اضغط مرة للتضمين، ومرتين للاستبعاد، وثلاث مرات لإلغاء الاختيار.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Main Area */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Legend Pill */}
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="flex size-4 items-center justify-center rounded bg-emerald-500/15">
                <CheckIcon className="size-3 stroke-[3]" />
              </span>
              تضمين
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
              <span className="flex size-4 items-center justify-center rounded bg-rose-500/15">
                <MinusIcon className="size-3 stroke-[3]" />
              </span>
              استبعاد
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-4 rounded border border-dashed border-border" />
              محايد
            </span>
          </div>

          {/* Facet Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={facetSearch}
              onChange={(event) => setFacetSearch(event.target.value)}
              placeholder="ابحث عن تصنيف أو وسم أو استوديو أو دولة…"
              className="h-9 pl-9 text-xs"
              aria-label="البحث في قيم الفلاتر"
            />
          </div>

          {/* Filter Group: Type */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                النوع
              </span>
              <span className="text-[11px] text-muted-foreground/70 italic">
                تضمين أو استبعاد
              </span>
            </div>
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

          {/* Filter Group: Status */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                الحالة
              </span>
              <span className="text-[11px] text-muted-foreground/70 italic">
                تضمين أو استبعاد
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {personalStatuses.map((status) => (
                <TriStateButton
                  key={status}
                  label={statusLabelsAr[status]}
                  state={getState(
                    filters.statuses,
                    filters.excludedStatuses,
                    status
                  )}
                  onClick={() => toggleStatus(status)}
                />
              ))}
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Numeric Filters Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                أقل تقييم
              </label>
              <select
                value={filters.minRating}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    minRating: Number(event.target.value),
                  })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="0">أي تقييم</option>
                <option value="7">7+</option>
                <option value="8">8+</option>
                <option value="9">9+</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                صدر بعد
              </label>
              <Input
                type="number"
                placeholder="أي سنة"
                className="h-9 text-xs"
                value={filters.yearFrom ?? ""}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    yearFrom: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">
                صدر قبل
              </label>
              <Input
                type="number"
                placeholder="أي سنة"
                className="h-9 text-xs"
                value={filters.yearTo ?? ""}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    yearTo: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </div>
          </div>

          {/* Favorites Switch */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                المفضلة فقط
              </span>
              <span className="text-[11px] text-muted-foreground">
                عرض الأعمال المضافة إلى المفضلة فقط
              </span>
            </div>
            <Switch
              checked={filters.favoriteOnly}
              onCheckedChange={(favoriteOnly) =>
                onChange({ ...filters, favoriteOnly })
              }
            />
          </div>

          {/* Facets Sections */}
          <div className="space-y-3 pt-2">
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
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground/80 italic">
            تُحفظ الاستبعادات مع العرض وتُطبّق في جميع أنحاء المكتبة.
          </p>
        </div>

        {/* Fixed Footer */}
        <SheetFooter className="flex flex-row items-center justify-between gap-2 border-t border-border/40 bg-background/95 p-4 backdrop-blur sm:justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-sm font-semibold text-foreground">
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
            <SheetClose
              render={
                <Button size="sm" className="h-8 text-xs">
                  تم
                </Button>
              }
            />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

type TriState = "include" | "exclude" | "neutral"

function getState<T extends string>(
  include: T[],
  exclude: T[],
  value: T
): TriState {
  if (include.includes(value)) return "include"
  if (exclude.includes(value)) return "exclude"
  return "neutral"
}

function TriStateButton({
  label,
  state,
  onClick,
}: {
  label: string
  state: TriState
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-all duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
        state === "include" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-xs hover:bg-emerald-500/20 dark:text-emerald-300",
        state === "exclude" &&
          "border-rose-500/30 bg-rose-500/10 text-rose-700 shadow-xs hover:bg-rose-500/20 dark:text-rose-300",
        state === "neutral" &&
          "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      aria-label={`${label}: ${state}`}
    >
      {state === "include" && (
        <CheckIcon className="size-3 shrink-0 stroke-[3] text-emerald-600 dark:text-emerald-400" />
      )}
      {state === "exclude" && (
        <MinusIcon className="size-3 shrink-0 stroke-[3] text-rose-600 dark:text-rose-400" />
      )}
      <span>{label}</span>
    </button>
  )
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
  label: string
  options: FacetOption[]
  selection: FacetSelection
  search: string
  onToggle: (value: string) => void
  valueLabel: (value: string) => string
  defaultOpen?: boolean
}) {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visible = options.filter(
    (option) =>
      !normalizedSearch ||
      option.value.toLocaleLowerCase().includes(normalizedSearch) ||
      valueLabel(option.value).toLocaleLowerCase().includes(normalizedSearch)
  )
  const selectedCount = selection.include.length + selection.exclude.length
  if (!visible.length && !selectedCount) return null

  return (
    <details
      className="group overflow-hidden rounded-lg border border-border/50 bg-background transition-all [&[open]]:shadow-xs"
      open={defaultOpen || Boolean(normalizedSearch)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between bg-muted/20 p-3 text-xs font-medium transition-colors select-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {selectedCount ? (
            <span className="font-semibold text-primary">
              {selectedCount} نشط
            </span>
          ) : (
            `${options.length} قيمة`
          )}
        </span>
      </summary>

      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto border-t border-border/40 p-3">
        {visible.map((option) => {
          const state = getState(
            selection.include,
            selection.exclude,
            option.value
          )
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                state === "include" &&
                  "border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300",
                state === "exclude" &&
                  "border-rose-500/30 bg-rose-500/10 font-medium text-rose-700 dark:text-rose-300",
                state === "neutral" &&
                  "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => onToggle(option.value)}
              aria-label={`${valueLabel(option.value)}: ${state}`}
            >
              {state === "include" && (
                <CheckIcon className="size-3 shrink-0 stroke-[3] text-emerald-600 dark:text-emerald-400" />
              )}
              {state === "exclude" && (
                <MinusIcon className="size-3 shrink-0 stroke-[3] text-rose-600 dark:text-rose-400" />
              )}
              <span>{valueLabel(option.value)}</span>
              <span className="font-mono text-[10px] opacity-60">
                ({option.count})
              </span>
            </button>
          )
        })}
      </div>
    </details>
  )
}
