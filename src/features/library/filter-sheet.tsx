import { useState } from "react"
import {
  CheckIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
} from "@phosphor-icons/react"
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
import { workKinds, type Work, type WorkKind } from "./model"
import {
  countActiveFilters,
  createEmptyFacetFilters,
  cycleCategoricalValue,
  cycleSelection,
  facetDefinitions,
  kindLabels,
  personalStatuses,
  type FacetFilters,
  type FacetOption,
  type FacetOptions,
  type FacetSelection,
  type WorkFilterState,
} from "./filtering"

export function AdvancedFilter({
  filters,
  facetOptions,
  onChange,
  matchingCount,
  title = "Filter this view",
  triggerLabel = "Filter",
}: {
  filters: WorkFilterState
  facetOptions: FacetOptions
  onChange: (filters: WorkFilterState) => void
  matchingCount: number
  title?: string
  triggerLabel?: string
}) {
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
        render={<Button variant={activeCount ? "secondary" : "outline"} />}
      >
        <FunnelSimpleIcon /> {triggerLabel}{" "}
        {activeCount ? (
          <span className="filter-count">{activeCount}</span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right" className="filter-sheet">
        <SheetHeader className="filter-sheet-header">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Click once to include, twice to exclude, and a third time to clear.
            Categories combine with AND; included values within one category use
            OR.
          </SheetDescription>
        </SheetHeader>
        <div className="filter-sheet-scroll">
          <div className="filter-legend" aria-label="Filter state legend">
            <span>
              <i className="include">
                <CheckIcon />
              </i>{" "}
              Include
            </span>
            <span>
              <i className="exclude">
                <MinusIcon />
              </i>{" "}
              Exclude
            </span>
            <span>
              <i /> Neutral
            </span>
          </div>
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
            <em>include or exclude</em>
          </div>
          <div className="kind-options">
            {workKinds.map((kind) => (
              <TriStateButton
                key={kind}
                label={kindLabels[kind]}
                state={getState(filters.kinds, filters.excludedKinds, kind)}
                onClick={() => toggleKind(kind)}
              />
            ))}
          </div>
          <Separator />
          <div className="filter-group-title">
            <span>Status</span>
            <em>include or exclude</em>
          </div>
          <div className="status-options">
            {personalStatuses.map((status) => (
              <TriStateButton
                key={status}
                label={status.replace("-", " ")}
                state={getState(
                  filters.statuses,
                  filters.excludedStatuses,
                  status
                )}
                onClick={() => toggleStatus(status)}
              />
            ))}
          </div>
          <Separator />
          <div className="filter-number-row">
            <label>
              <span>Minimum rating</span>
              <select
                value={filters.minRating}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    minRating: Number(event.target.value),
                  })
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
            </label>
            <label>
              <span>Release to</span>
              <Input
                type="number"
                placeholder="Any"
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
            </label>
          </div>
          <label className="filter-switch-row">
            <span>
              <strong>Favorites only</strong>
              <small>Only show works marked as favorite</small>
            </span>
            <Switch
              checked={filters.favoriteOnly}
              onCheckedChange={(favoriteOnly) =>
                onChange({ ...filters, favoriteOnly })
              }
            />
          </label>
          <div className="facet-groups">
            {facetDefinitions.map((definition) => (
              <FacetSection
                key={definition.key}
                label={definition.label}
                options={facetOptions[definition.key]}
                selection={filters.facets[definition.key]}
                search={facetSearch}
                onToggle={(value) => toggleFacet(definition.key, value)}
                defaultOpen={definition.defaultOpen}
              />
            ))}
          </div>
          <p className="filter-hint">
            Exclusions are saved with the view and use the same behavior in the
            library and admin workspace.
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
        state === "include" && "checked",
        state === "exclude" && "excluded"
      )}
      aria-label={`${label}: ${state}`}
    >
      <i>
        {state === "include" ? (
          <CheckIcon />
        ) : state === "exclude" ? (
          <MinusIcon />
        ) : null}
      </i>
      {label}
    </button>
  )
}

function FacetSection({
  label,
  options,
  selection,
  search,
  onToggle,
  defaultOpen = false,
}: {
  label: string
  options: FacetOption[]
  selection: FacetSelection
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
  const selectedCount = selection.include.length + selection.exclude.length
  if (!visible.length && !selectedCount) return null
  return (
    <details
      className="facet-section"
      open={defaultOpen || Boolean(normalizedSearch)}
    >
      <summary>
        <span>{label}</span>
        <em>
          {selectedCount
            ? `${selectedCount} active`
            : `${options.length} values`}
        </em>
      </summary>
      <div className="facet-options">
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
                state === "include" && "selected",
                state === "exclude" && "excluded"
              )}
              onClick={() => onToggle(option.value)}
              aria-label={`${option.value}: ${state}`}
            >
              <i>
                {state === "include" ? (
                  <CheckIcon />
                ) : state === "exclude" ? (
                  <MinusIcon />
                ) : null}
              </i>
              <span>{option.value}</span>
              <em>{option.count}</em>
            </button>
          )
        })}
      </div>
    </details>
  )
}
