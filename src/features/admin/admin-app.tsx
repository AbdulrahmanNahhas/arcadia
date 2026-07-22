import { useMemo, useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BracketsCurlyIcon,
  CheckIcon,
  DatabaseIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  RowsPlusBottomIcon,
  SelectionAllIcon,
  SparkleIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AdvancedFilter } from "@/features/library/filter-sheet"
import {
  buildFacetOptions,
  createEmptyFacetFilters,
  kindLabels,
  personalStatuses,
  workMatchesFilters,
  type WorkFilterState,
} from "@/features/library/filtering"
import {
  workKinds,
  type Work,
  type WorkKind,
} from "@/features/library/model"
import {
  addWorksBulk,
  getWorks,
} from "@/server/library.functions"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {  WorkEditor } from "./components/editor-form"
import { JsonEditorDialog } from "./components/json-editor"
import { BulkEditDialog } from "./components/bulk-edit"

function createDefaultFilters(): WorkFilterState {
  return {
    kinds: [],
    excludedKinds: [],
    statuses: [],
    excludedStatuses: [],
    minRating: 0,
    favoriteOnly: false,
    yearFrom: null,
    yearTo: null,
    facets: createEmptyFacetFilters(),
  }
}

function matchesSearch(work: Work, search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (!query) return true
  return [
    work.title,
    work.subtitle,
    work.creator,
    ...work.aliases,
    ...work.genres,
    ...work.tags,
    ...work.studios,
    ...work.credits.flatMap(({ name, role }) => [name, role]),
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query)
}

export function AdminApp() {
  const queryClient = useQueryClient()
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  })

  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<WorkFilterState>(createDefaultFilters)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingWork, setEditingWork] = useState<Work | null>(null)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)

  const facetOptions = useMemo(() => buildFacetOptions(works), [works])
  const visibleWorks = useMemo(
    () =>
      works.filter(
        (work) =>
          matchesSearch(work, search) && workMatchesFilters(work, filters)
      ),
    [filters, search, works]
  )
  const visibleIds = visibleWorks.map((work) => work.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["works"] })
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  return (
  /* FIXED: Added 'h-screen overflow-y-auto' so the page always scrolls vertically */
  <div className="h-screen overflow-y-auto bg-background text-foreground antialiased pb-12">
    {/* Top Navigation Bar */}
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DatabaseIcon className="size-4" weight="duotone" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold leading-none tracking-tight">Arcadia Admin</span>
            <span className="text-[10px] text-muted-foreground leading-none mt-1">Local database workspace</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          render={
            <Link to="/">
              <ArrowLeftIcon className="size-3.5" />
              <span>Back to library</span>
            </Link>
          }
        />
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-0">
      {/* Page Heading Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-card border border-border/50 rounded-xl p-5 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <SparkleIcon className="size-3.5" />
            <span>Database Maintenance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Works</h1>
          <p className="text-xs text-muted-foreground">
            Edit metadata and personal state without changing the browsing experience.
          </p>
        </div>

        {/* Heading Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJsonEditorOpen(true)}
            className="h-9 text-xs gap-1.5 border-border/60"
          >
            <BracketsCurlyIcon className="size-3.5 text-muted-foreground" />
            <span>JSON Editor</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkAddOpen(true)}
            className="h-9 text-xs gap-1.5 border-border/60"
          >
            <RowsPlusBottomIcon className="size-3.5 text-muted-foreground" />
            <span>Bulk Add</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setBulkAddOpen(true)}
            className="h-9 text-xs gap-1.5 shadow-xs"
          >
            <PlusIcon className="size-3.5" />
            <span>Add Works</span>
          </Button>
        </div>
      </div>

      {/* Floating Bulk Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-14 z-20 w-[90%] mx-auto flex items-center justify-between gap-4 rounded-b-lg bg-primary text-primary-foreground px-4 py-2 shadow-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground">
              <CheckIcon className="size-3 stroke-[3]" />
            </span>
            <span><strong>{selectedIds.size}</strong> work{selectedIds.size > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-7 text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkEditOpen(true)}
              className="h-7 text-xs gap-1.5 shadow-2xs"
            >
              <NotePencilIcon className="size-3.5" />
              <span>Edit Selected</span>
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search Controls Toolbar */}
      <div className="flex flex-col my-2 sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/50 shadow-2xs">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles, aliases, genres, tags, contributors…"
            className="pl-9 pr-8 h-9 text-xs"
            aria-label="Search admin records"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm"
              aria-label="Clear search"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdvancedFilter
            filters={filters}
            facetOptions={facetOptions}
            onChange={setFilters}
            matchingCount={visibleWorks.length}
            title="Filter Admin Records"
            triggerLabel="Advanced Filters"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllVisible}
            disabled={!visibleWorks.length}
            className="h-9 text-xs gap-1.5 border-border/60"
          >
            <SelectionAllIcon className="size-3.5 text-muted-foreground" />
            <span>{allVisibleSelected ? "Deselect Visible" : "Select Visible"}</span>
          </Button>

          <Separator orientation="vertical" className="h-6 hidden sm:block bg-border/60" />

          <div className="text-xs text-muted-foreground font-mono px-1">
            <span className="font-semibold text-foreground">{visibleWorks.length}</span> / {works.length}
          </div>
        </div>
      </div>

      {/* Main Data Table Section */}
      {/* FIXED: Replaced 'overflow-hidden' with 'overflow-x-auto' */}
      <div className="rounded-xl border border-border/50 bg-card overflow-x-auto shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  aria-label="Select all visible works"
                />
              </TableHead>
              <TableHead className="min-w-[220px]">Work</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[90px]">Release</TableHead>
              <TableHead className="min-w-[180px]">Genres</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[90px]">Rating</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleWorks.map((work) => {
              const isSelected = selectedIds.has(work.id)
              return (
                <TableRow
                  key={work.id}
                  className={cn(
                    "transition-colors border-border/40",
                    isSelected && "bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  {/* Checkbox */}
                  <TableCell className="text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(work.id)}
                      aria-label={`Select ${work.title}`}
                    />
                  </TableCell>

                  {/* Work Info Cell */}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setEditingWork(work)}
                      className="flex items-center gap-3 text-left group focus-visible:outline-none"
                    >
                      {work.imagePath ? (
                        <img
                          src={work.imagePath}
                          alt=""
                          className="size-10 rounded-md object-cover bg-muted shrink-0 border border-border/40 group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="size-10 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0 border border-border/40 group-hover:bg-muted/80">
                          {work.title.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 max-w-[240px] truncate">
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {work.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {work.studios[0] ?? work.creator ?? "—"}
                        </span>
                      </div>
                    </button>
                  </TableCell>

                  {/* Type Badge */}
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-medium border-border/60 capitalize">
                      {kindLabels[work.kind] ?? work.kind}
                    </Badge>
                  </TableCell>

                  {/* Release Year */}
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {work.year ?? "—"}
                  </TableCell>

                  {/* Genres */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {work.genres.slice(0, 2).map((genre) => (
                        <Badge
                          key={genre}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-normal bg-muted/60 text-muted-foreground"
                        >
                          {genre}
                        </Badge>
                      ))}
                      {work.genres.length > 2 && (
                        <span className="text-[10px] text-muted-foreground/70 font-mono self-center">
                          +{work.genres.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Status Indicator Badge */}
                  <TableCell>
                    <StatusBadge status={work.status} />
                  </TableCell>

                  {/* Rating */}
                  <TableCell>
                    {work.rating !== null ? (
                      <div className="inline-flex items-center gap-1 text-xs font-mono font-medium text-amber-600 dark:text-amber-400">
                        <StarIcon className="size-3 fill-current" />
                        <span>{work.rating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">—</span>
                    )}
                  </TableCell>

                  {/* Row Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="size-7">
                          <DotsThreeVerticalIcon className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      }/>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => setEditingWork(work)}>
                          <NotePencilIcon className="size-3.5 mr-2" />
                          Edit details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* Empty Table State */}
        {!visibleWorks.length && (
          <div className="flex flex-col items-center justify-center p-12 text-center my-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 mb-3 text-muted-foreground">
              <DatabaseIcon className="size-6" weight="duotone" />
            </div>
            <p className="text-sm font-semibold text-foreground">No matching works</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Try clearing your search query or modifying the current filter definitions.
            </p>
            {(search || countFiltersActive(filters)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearch("")}
                className="mt-4 h-8 text-xs"
              >
                Clear search query
              </Button>
            )}
          </div>
        )}
      </div>
    </main>

      {/* Editor & Action Dialog Component Mounts */}
      <WorkEditor
        work={editingWork}
        works={works}
        onOpenChange={(open) => !open && setEditingWork(null)}
        onSaved={async () => {
          setEditingWork(null)
          await refresh()
        }}
      />
      <BulkAddDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        onCreated={refresh}
      />
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        workIds={[...selectedIds]}
        onUpdated={async () => {
          setSelectedIds(new Set())
          await refresh()
        }}
      />
      {jsonEditorOpen && (
        <JsonEditorDialog
          open={jsonEditorOpen}
          onOpenChange={setJsonEditorOpen}
          works={works}
          visibleWorks={visibleWorks}
          selectedIds={selectedIds}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const formattedStatus = status.replace("-", " ")

  return (
    <div className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground font-medium">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "completed" && "bg-emerald-500",
          status === "in-progress" && "bg-sky-500",
          status === "planned" && "bg-amber-500",
          status === "dropped" && "bg-rose-500",
          status === "on-hold" && "bg-purple-500"
        )}
      />
      <span>{formattedStatus}</span>
    </div>
  )
}

function countFiltersActive(filters: WorkFilterState): boolean {
  return Boolean(
    filters.kinds.length ||
      filters.excludedKinds.length ||
      filters.statuses.length ||
      filters.excludedStatuses.length ||
      filters.favoriteOnly ||
      filters.minRating > 0
  )
}

export function parseList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ]
}

const bulkExample = `Frieren: Beyond Journey's End | anime | 2023 | planned | Adventure, Fantasy | Madhouse
Pluto | anime | 2023 | completed | Mystery, Sci-Fi | Studio M2`

function BulkAddDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const [rows, setRows] = useState(bulkExample)
  const [parseError, setParseError] = useState("")
  const mutation = useMutation({
    mutationFn: addWorksBulk,
    onSuccess: async () => {
      onOpenChange(false)
      await onCreated()
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed: Array<{
      title: string
      kind: WorkKind
      year: number | null
      status: Work["status"]
      summary: string
      genres: string[]
      tags: string[]
      studios: string[]
    }> = []
    const errors: string[] = []
    rows.split("\n").forEach((line, index) => {
      if (!line.trim()) return
      const [
        title,
        rawKind = "anime",
        rawYear = "",
        rawStatus = "planned",
        rawGenres = "",
        rawStudios = "",
      ] = line.split("|").map((value) => value.trim())
      if (!title) errors.push(`Line ${index + 1}: title is required`)
      if (!workKinds.includes(rawKind as WorkKind))
        errors.push(`Line ${index + 1}: unknown type “${rawKind}”`)
      if (!personalStatuses.includes(rawStatus as Work["status"]))
        errors.push(`Line ${index + 1}: unknown status “${rawStatus}”`)
      if (
        title &&
        workKinds.includes(rawKind as WorkKind) &&
        personalStatuses.includes(rawStatus as Work["status"])
      ) {
        parsed.push({
          title,
          kind: rawKind as WorkKind,
          year: rawYear ? Number(rawYear) : null,
          status: rawStatus as Work["status"],
          summary: "",
          genres: parseList(rawGenres),
          tags: [],
          studios: parseList(rawStudios),
        })
      }
    })
    if (errors.length || !parsed.length) {
      setParseError(errors.join(" · ") || "Add at least one row.")
      return
    }
    setParseError("")
    mutation.mutate({ data: { works: parsed } })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-bulk-dialog">
        <DialogHeader>
          <DialogTitle>Bulk add works</DialogTitle>
          <DialogDescription>
            Paste one work per line. Nothing is imported from the cloud.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="bulk-format">
            <code>Title | type | year | status | genres | studios</code>
            <span>Genres and studios accept comma-separated values.</span>
          </div>
          <textarea
            rows={12}
            value={rows}
            onChange={(e) => setRows(e.target.value)}
          />
          {parseError || mutation.error ? (
            <p className="admin-form-error">
              {parseError || mutation.error?.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <PlusIcon /> {mutation.isPending ? "Adding…" : "Add rows"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
