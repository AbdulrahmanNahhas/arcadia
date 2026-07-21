import { useMemo, useState, type FormEvent, type ReactNode } from "react"
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
  FloppyDiskIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PlusIcon,
  RowsPlusBottomIcon,
  SelectionAllIcon,
  SparkleIcon,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  adminWorkUpdateSchema,
  workKinds,
  type AdminWorkUpdate,
  type Work,
  type WorkCredit,
  type WorkKind,
  type WorkRelation,
} from "@/features/library/model"
import {
  addWorksBulk,
  editWorksBulk,
  getWorks,
  saveWork,
} from "@/server/library.functions"
import { cn } from "@/lib/utils"

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
    <main className="admin-page">
      <header className="admin-topbar">
        <div className="admin-brand">
          <span>
            <DatabaseIcon weight="duotone" />
          </span>
          <div>
            <strong>Arcadia admin</strong>
            <small>Local database workspace</small>
          </div>
        </div>
        <Button variant="ghost" render={<Link to="/" />}>
          <ArrowLeftIcon /> Back to library
        </Button>
      </header>

      <section className="admin-heading">
        <div>
          <p>
            <SparkleIcon /> database maintenance
          </p>
          <h1>Manage works</h1>
          <span>
            Edit metadata and personal state without changing the browsing
            experience.
          </span>
        </div>
        <div className="admin-heading-actions">
          <Button variant="outline" onClick={() => setJsonEditorOpen(true)}>
            <BracketsCurlyIcon /> JSON editor
          </Button>
          <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
            <RowsPlusBottomIcon /> Bulk add
          </Button>
          <Button onClick={() => setBulkAddOpen(true)}>
            <PlusIcon /> Add works
          </Button>
        </div>
      </section>

      <section className="admin-toolbar">
        <label className="admin-search">
          <MagnifyingGlassIcon />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles, aliases, genres, tags, contributors…"
            aria-label="Search admin records"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <XIcon />
            </button>
          ) : null}
        </label>
        <AdvancedFilter
          filters={filters}
          facetOptions={facetOptions}
          onChange={setFilters}
          matchingCount={visibleWorks.length}
          title="Filter admin records"
          triggerLabel="Advanced filters"
        />
        <Button
          variant="outline"
          onClick={toggleAllVisible}
          disabled={!visibleWorks.length}
        >
          <SelectionAllIcon />{" "}
          {allVisibleSelected ? "Deselect visible" : "Select visible"}
        </Button>
        <span className="admin-result-count">
          {visibleWorks.length} of {works.length}
        </span>
      </section>

      {selectedIds.size ? (
        <section className="admin-selection-bar">
          <div>
            <CheckIcon /> <strong>{selectedIds.size}</strong> selected
          </div>
          <div>
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button onClick={() => setBulkEditOpen(true)}>
              <NotePencilIcon /> Edit selected
            </Button>
          </div>
        </section>
      ) : null}

      <section className="admin-table-frame">
        <table className="admin-table">
          <thead>
            <tr>
              <th aria-label="Select">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                />
              </th>
              <th>Work</th>
              <th>Type</th>
              <th>Release</th>
              <th>Genres</th>
              <th>Status</th>
              <th>Rating</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleWorks.map((work) => (
              <tr
                key={work.id}
                className={cn(selectedIds.has(work.id) && "selected")}
              >
                <td>
                  <Checkbox
                    checked={selectedIds.has(work.id)}
                    onCheckedChange={() => toggleSelected(work.id)}
                    aria-label={`Select ${work.title}`}
                  />
                </td>
                <td>
                  <button
                    className="admin-work-cell"
                    type="button"
                    onClick={() => setEditingWork(work)}
                  >
                    {work.imagePath ? (
                      <img src={work.imagePath} alt="" />
                    ) : (
                      <span className="admin-poster-fallback">
                        {work.title.slice(0, 1)}
                      </span>
                    )}
                    <span>
                      <strong>{work.title}</strong>
                      <small>{work.studios[0] ?? work.creator}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="admin-kind">{kindLabels[work.kind]}</span>
                </td>
                <td>{work.year ?? "—"}</td>
                <td>
                  <div className="admin-tags">
                    {work.genres.slice(0, 3).map((genre) => (
                      <span key={genre}>{genre}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`status-dot status-${work.status}`} />{" "}
                  {work.status.replace("-", " ")}
                </td>
                <td>{work.rating === null ? "—" : work.rating.toFixed(1)}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingWork(work)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleWorks.length ? (
          <div className="admin-empty">
            <DatabaseIcon />
            <strong>No matching works</strong>
            <span>Clear the search or change the filter rules.</span>
          </div>
        ) : null}
      </section>

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
      {jsonEditorOpen ? (
        <JsonEditorDialog
          open={jsonEditorOpen}
          onOpenChange={setJsonEditorOpen}
          works={works}
          visibleWorks={visibleWorks}
          selectedIds={selectedIds}
          onSaved={refresh}
        />
      ) : null}
    </main>
  )
}

type JsonScope = "all" | "visible" | "selected"

function toEditableWork(work: Work): AdminWorkUpdate {
  const { addedAt: _addedAt, palette: _palette, relations, ...editable } = work
  return {
    ...editable,
    relations: relations.map(({ workId, relationType, direction, notes }) => ({
      workId,
      relationType,
      direction,
      notes,
    })),
  }
}

function displayJsonValue(value: unknown) {
  if (typeof value === "string") return value || "Empty string"
  return JSON.stringify(value, null, 2) ?? "undefined"
}

function JsonEditorDialog({
  open,
  onOpenChange,
  works,
  visibleWorks,
  selectedIds,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  works: Work[]
  visibleWorks: Work[]
  selectedIds: Set<string>
  onSaved: () => Promise<void>
}) {
  const [scope, setScope] = useState<JsonScope>("all")
  const [sourceWorks, setSourceWorks] = useState<Work[]>(works)
  const [json, setJson] = useState(() =>
    JSON.stringify(works.map(toEditableWork), null, 2)
  )
  const [parsedWorks, setParsedWorks] = useState<AdminWorkUpdate[] | null>(null)
  const [error, setError] = useState("")

  const resetEditor = (nextScope: JsonScope = scope) => {
    const nextWorks =
      nextScope === "visible"
        ? visibleWorks
        : nextScope === "selected"
          ? works.filter((work) => selectedIds.has(work.id))
          : works
    setSourceWorks(nextWorks)
    setJson(JSON.stringify(nextWorks.map(toEditableWork), null, 2))
    setParsedWorks(null)
    setError("")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetEditor()
    onOpenChange(nextOpen)
  }

  const selectScope = (nextScope: JsonScope) => {
    setScope(nextScope)
    resetEditor(nextScope)
  }

  const review = () => {
    try {
      const raw: unknown = JSON.parse(json)
      const result = adminWorkUpdateSchema.array().safeParse(raw)
      if (!result.success) {
        const issue = result.error.issues[0]
        setError(
          `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`
        )
        return
      }
      const originalIds = sourceWorks.map(({ id }) => id).sort()
      const nextIds = result.data.map(({ id }) => id).sort()
      if (
        new Set(nextIds).size !== nextIds.length ||
        JSON.stringify(originalIds) !== JSON.stringify(nextIds)
      ) {
        setError(
          "Keep exactly the same work IDs in this scope. Add, remove, and ID changes are blocked in the JSON editor."
        )
        return
      }
      setError("")
      setParsedWorks(result.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid JSON")
    }
  }

  const changes = useMemo(() => {
    if (!parsedWorks) return []
    const originals = new Map(
      sourceWorks.map((work) => [work.id, toEditableWork(work)])
    )
    return parsedWorks.flatMap((work) => {
      const original = originals.get(work.id)
      if (!original) return []
      const fields = Object.keys(work).filter(
        (field) =>
          JSON.stringify(original[field as keyof AdminWorkUpdate]) !==
          JSON.stringify(work[field as keyof AdminWorkUpdate])
      )
      return fields.length ? [{ work, original, fields }] : []
    })
  }, [parsedWorks, sourceWorks])

  const mutation = useMutation({
    mutationFn: async (updates: AdminWorkUpdate[]) => {
      for (const data of updates) await saveWork({ data })
    },
    onSuccess: async () => {
      await onSaved()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="admin-json-dialog" showCloseButton>
        <DialogHeader className="admin-json-header">
          <div className="admin-json-title">
            <span>
              <BracketsCurlyIcon />
            </span>
            <div>
              <DialogTitle>Works JSON editor</DialogTitle>
              <DialogDescription>
                {parsedWorks
                  ? "Review every field change before the database is updated."
                  : "Inspect and edit complete work records in a controlled scope."}
              </DialogDescription>
            </div>
          </div>
          <div className="admin-json-steps" aria-label="Editor progress">
            <span className={cn(!parsedWorks && "active")}>1 · Edit JSON</span>
            <span className={cn(parsedWorks && "active")}>
              2 · Review changes
            </span>
          </div>
        </DialogHeader>

        {parsedWorks ? (
          <div className="admin-json-review">
            <div className="admin-json-review-summary">
              <strong>
                {changes.length} {changes.length === 1 ? "work" : "works"}{" "}
                changed
              </strong>
              <span>
                {changes.reduce(
                  (total, change) => total + change.fields.length,
                  0
                )}{" "}
                field updates · unchanged records will not be saved
              </span>
            </div>
            {changes.length ? (
              <div className="admin-json-change-list">
                {changes.map(({ work, original, fields }) => (
                  <section key={work.id} className="admin-json-change-card">
                    <header>
                      <strong>{work.title}</strong>
                      <code>{work.id}</code>
                    </header>
                    <div>
                      {fields.map((field) => (
                        <article key={field}>
                          <h3>{field}</h3>
                          <div className="admin-json-diff before">
                            <span>Before</span>
                            <pre>
                              {displayJsonValue(
                                original[field as keyof AdminWorkUpdate]
                              )}
                            </pre>
                          </div>
                          <div className="admin-json-diff after">
                            <span>After</span>
                            <pre>
                              {displayJsonValue(
                                work[field as keyof AdminWorkUpdate]
                              )}
                            </pre>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="admin-json-no-changes">
                <CheckIcon />
                <strong>No changes found</strong>
                <span>
                  The edited JSON matches the current database values.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="admin-json-workspace">
            <aside>
              <strong>Records to show</strong>
              <button
                className={cn(scope === "all" && "active")}
                type="button"
                onClick={() => selectScope("all")}
              >
                <span>All works</span>
                <small>{works.length}</small>
              </button>
              <button
                className={cn(scope === "visible" && "active")}
                type="button"
                onClick={() => selectScope("visible")}
              >
                <span>Current results</span>
                <small>{visibleWorks.length}</small>
              </button>
              <button
                className={cn(scope === "selected" && "active")}
                type="button"
                onClick={() => selectScope("selected")}
                disabled={!selectedIds.size}
              >
                <span>Selected works</span>
                <small>{selectedIds.size}</small>
              </button>
              <p>
                Readonly database fields are omitted. Work IDs and the records
                in this scope cannot be changed.
              </p>
            </aside>
            <div className="admin-json-code">
              <div>
                <span>{sourceWorks.length} records</span>
                <code>application/json</code>
              </div>
              <textarea
                value={json}
                onChange={(event) => setJson(event.target.value)}
                spellCheck={false}
                aria-label="Works JSON"
              />
            </div>
          </div>
        )}

        {(error || mutation.error) && (
          <p className="admin-form-error admin-json-error">
            {error || mutation.error?.message}
          </p>
        )}
        <DialogFooter className="admin-json-footer">
          {parsedWorks ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setParsedWorks(null)}
                disabled={mutation.isPending}
              >
                Back to editor
              </Button>
              <Button
                type="button"
                onClick={() => mutation.mutate(changes.map(({ work }) => work))}
                disabled={!changes.length || mutation.isPending}
              >
                <FloppyDiskIcon />{" "}
                {mutation.isPending
                  ? "Saving…"
                  : `Save ${changes.length} changed ${changes.length === 1 ? "work" : "works"}`}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={review}
                disabled={!sourceWorks.length}
              >
                Review changes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WorkEditor({
  work,
  works,
  onOpenChange,
  onSaved,
}: {
  work: Work | null
  works: Work[]
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  return (
    <Sheet open={Boolean(work)} onOpenChange={onOpenChange}>
      {work ? (
        <WorkEditorForm
          key={work.id}
          work={work}
          works={works}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  )
}

function WorkEditorForm({
  work,
  works,
  onSaved,
}: {
  work: Work
  works: Work[]
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Work>(() => structuredClone(work))
  const [links, setLinks] = useState(() =>
    work.externalLinks
      .map((link) => `${link.provider} | ${link.label} | ${link.url}`)
      .join("\n")
  )
  const mutation = useMutation({
    mutationFn: saveWork,
    onSuccess: onSaved,
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const {
      addedAt: _addedAt,
      palette: _palette,
      relations,
      ...editable
    } = draft
    const externalLinks = links
      .split("\n")
      .map((line) => line.split("|").map((value) => value.trim()))
      .filter((parts) => parts.length >= 3 && parts[2])
      .map(([provider, label, ...url]) => ({
        provider,
        label,
        url: url.join("|"),
      }))
    mutation.mutate({
      data: {
        ...editable,
        externalLinks,
        relations: relations.map(
          ({ workId, relationType, direction, notes }) => ({
            workId,
            relationType,
            direction,
            notes,
          })
        ),
      } as AdminWorkUpdate,
    })
  }

  return (
    <SheetContent side="right" className="admin-editor-sheet">
      <SheetHeader className="admin-editor-header">
        <SheetTitle>Edit {work.title}</SheetTitle>
        <SheetDescription>
          Objective metadata, personal state, guidance, links, and local assets.
        </SheetDescription>
      </SheetHeader>
      <form className="admin-editor-form" onSubmit={submit}>
        <EditorSection
          title="Identity"
          description="Core fields used everywhere in Arcadia."
        >
          <Field label="Title">
            <Input
              value={draft.title}
              required
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="Subtitle">
            <Input
              value={draft.subtitle}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as WorkKind })
              }
            >
              {workKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabels[kind]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Release year">
            <Input
              type="number"
              value={draft.year ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  year: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>
          <Field label="Release status">
            <select
              value={draft.releaseStatus}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  releaseStatus: event.target.value as Work["releaseStatus"],
                })
              }
            >
              {["announced", "releasing", "released", "ended", "unknown"].map(
                (status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label="Creator">
            <Input
              value={draft.creator}
              onChange={(e) => setDraft({ ...draft, creator: e.target.value })}
            />
          </Field>
          <ArrayField
            label="Aliases"
            value={draft.aliases}
            onChange={(aliases) => setDraft({ ...draft, aliases })}
          />
          <Field label="Summary" wide>
            <textarea
              rows={6}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </Field>
        </EditorSection>

        <EditorSection
          title="Classification"
          description="Comma-separated values become searchable facets."
        >
          <ArrayField
            label="Genres"
            value={draft.genres}
            onChange={(genres) => setDraft({ ...draft, genres })}
          />
          <ArrayField
            label="Tags & themes"
            value={draft.tags}
            onChange={(tags) => setDraft({ ...draft, tags })}
          />
          <ArrayField
            label="Studios"
            value={draft.studios}
            onChange={(studios) => setDraft({ ...draft, studios })}
          />
          <ArrayField
            label="Tone"
            value={draft.tone}
            onChange={(tone) => setDraft({ ...draft, tone })}
          />
          <ArrayField
            label="Countries"
            value={draft.country}
            onChange={(country) => setDraft({ ...draft, country })}
          />
          <ArrayField
            label="Audience"
            value={draft.audience}
            onChange={(audience) => setDraft({ ...draft, audience })}
          />
          <ArrayField
            label="Shared with"
            value={draft.sharedWith}
            onChange={(sharedWith) => setDraft({ ...draft, sharedWith })}
          />
          <ArrayField
            label="Favorite characters"
            value={draft.favoriteCharacters}
            onChange={(favoriteCharacters) =>
              setDraft({ ...draft, favoriteCharacters })
            }
          />
          <CreditField
            value={draft.credits}
            onChange={(credits) => setDraft({ ...draft, credits })}
          />
        </EditorSection>

        <EditorSection
          title="Personal state"
          description="Your private relationship with this work."
        >
          <Field label="Status">
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value as Work["status"] })
              }
            >
              {personalStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace("-", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rating">
            <Input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={draft.rating ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  rating: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>
          {draft.kind !== "manga" && draft.kind !== "novel" ? (
            <>
              <Field label="Progress">
                <Input
                  type="number"
                  min="0"
                  value={draft.progress}
                  onChange={(e) =>
                    setDraft({ ...draft, progress: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Progress total">
                <Input
                  type="number"
                  min="0"
                  value={draft.progressTotal ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      progressTotal: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="Progress unit">
                <Input
                  value={draft.progressUnit}
                  onChange={(e) =>
                    setDraft({ ...draft, progressUnit: e.target.value })
                  }
                />
              </Field>
            </>
          ) : null}
          <Field label="Personal notes" wide>
            <textarea
              rows={4}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </Field>
          <label className="admin-check-field">
            <Checkbox
              checked={draft.favorite}
              onCheckedChange={(favorite) => setDraft({ ...draft, favorite })}
            />{" "}
            Favorite
          </label>
        </EditorSection>

        <EditorSection
          title="Guidance & analysis"
          description="Content guidance stays distinct from objective metadata."
        >
          <Field label="Sexuality risk">
            <RiskSelect
              value={draft.riskProfile?.sexuality ?? "unknown"}
              onChange={(sexuality) =>
                setDraft({
                  ...draft,
                  riskProfile: {
                    sexuality,
                    fanService: draft.riskProfile?.fanService ?? null,
                    behavioral: draft.riskProfile?.behavioral ?? "unknown",
                    theology: draft.riskProfile?.theology ?? "unknown",
                  },
                })
              }
            />
          </Field>
          <Field label="Behavioral risk">
            <RiskSelect
              value={draft.riskProfile?.behavioral ?? "unknown"}
              onChange={(behavioral) =>
                setDraft({
                  ...draft,
                  riskProfile: {
                    sexuality: draft.riskProfile?.sexuality ?? "unknown",
                    fanService: draft.riskProfile?.fanService ?? null,
                    behavioral,
                    theology: draft.riskProfile?.theology ?? "unknown",
                  },
                })
              }
            />
          </Field>
          <Field label="Theology risk">
            <RiskSelect
              value={draft.riskProfile?.theology ?? "unknown"}
              onChange={(theology) =>
                setDraft({
                  ...draft,
                  riskProfile: {
                    sexuality: draft.riskProfile?.sexuality ?? "unknown",
                    fanService: draft.riskProfile?.fanService ?? null,
                    behavioral: draft.riskProfile?.behavioral ?? "unknown",
                    theology,
                  },
                })
              }
            />
          </Field>
          <Field label="Fan-service level">
            <Input
              type="number"
              min="0"
              max="10"
              value={draft.riskProfile?.fanService ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  riskProfile: {
                    sexuality: draft.riskProfile?.sexuality ?? "unknown",
                    fanService: e.target.value ? Number(e.target.value) : null,
                    behavioral: draft.riskProfile?.behavioral ?? "unknown",
                    theology: draft.riskProfile?.theology ?? "unknown",
                  },
                })
              }
            />
          </Field>
          <Field label="Content warnings" wide>
            <textarea
              rows={3}
              value={draft.contentWarnings ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, contentWarnings: e.target.value || null })
              }
            />
          </Field>
          <Field label="Analysis notes" wide>
            <textarea
              rows={5}
              value={draft.analysisNotes ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, analysisNotes: e.target.value || null })
              }
            />
          </Field>
        </EditorSection>

        <EditorSection
          title="Dates, source & links"
          description="Publishing context and destinations outside Arcadia."
        >
          <Field label="Release start">
            <Input
              type="date"
              value={draft.releaseStart ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, releaseStart: e.target.value || null })
              }
            />
          </Field>
          <Field label="Release end">
            <Input
              type="date"
              value={draft.releaseEnd ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, releaseEnd: e.target.value || null })
              }
            />
          </Field>
          <Field label="Source type">
            <Input
              value={draft.sourceMaterial?.type ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sourceMaterial: {
                    type: e.target.value,
                    started: draft.sourceMaterial?.started ?? null,
                    finished: draft.sourceMaterial?.finished ?? null,
                    serialization: draft.sourceMaterial?.serialization ?? [],
                    publication: draft.sourceMaterial?.publication ?? null,
                  },
                })
              }
            />
          </Field>
          <Field label="Source publication">
            <Input
              value={draft.sourceMaterial?.publication ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sourceMaterial: {
                    type: draft.sourceMaterial?.type ?? "",
                    started: draft.sourceMaterial?.started ?? null,
                    finished: draft.sourceMaterial?.finished ?? null,
                    serialization: draft.sourceMaterial?.serialization ?? [],
                    publication: e.target.value || null,
                  },
                })
              }
            />
          </Field>
          <Field label="Publication format">
            <Input
              value={draft.publication?.format ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  publication: {
                    format: e.target.value || null,
                    publisher: draft.publication?.publisher ?? null,
                    imprint: draft.publication?.imprint ?? null,
                    serialization: draft.publication?.serialization ?? [],
                    demographic: draft.publication?.demographic ?? null,
                    contents: draft.publication?.contents ?? [],
                  },
                })
              }
            />
          </Field>
          <Field label="Publisher / imprint">
            <Input
              value={draft.publication?.publisher ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  publication: {
                    format: draft.publication?.format ?? null,
                    publisher: e.target.value || null,
                    imprint: draft.publication?.imprint ?? null,
                    serialization: draft.publication?.serialization ?? [],
                    demographic: draft.publication?.demographic ?? null,
                    contents: draft.publication?.contents ?? [],
                  },
                })
              }
            />
          </Field>
          <Field label="External links" wide>
            <textarea
              rows={6}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="AniList | AniList | https://…"
            />
            <small>One per line: provider | label | URL</small>
          </Field>
        </EditorSection>

        <EditorSection
          title="Related works"
          description="Link adaptations, sequels, and other media records."
        >
          <RelationshipEditor
            work={draft}
            works={works}
            onChange={(relations) => setDraft({ ...draft, relations })}
          />
        </EditorSection>

        <EditorSection
          title="Local artwork"
          description="Paths are served locally; clearing one removes its database asset reference."
        >
          <Field label="Poster path">
            <Input
              value={draft.imagePath ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, imagePath: e.target.value || null })
              }
            />
          </Field>
          <Field label="Banner path">
            <Input
              value={draft.bannerPath ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, bannerPath: e.target.value || null })
              }
            />
          </Field>
          <Field label="Logo path">
            <Input
              value={draft.logoPath ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, logoPath: e.target.value || null })
              }
            />
          </Field>
        </EditorSection>

        {mutation.error ? (
          <p className="admin-form-error">{mutation.error.message}</p>
        ) : null}
        <SheetFooter className="admin-editor-footer">
          <SheetClose render={<Button type="button" variant="ghost" />}>
            Cancel
          </SheetClose>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </form>
      <p>{JSON.stringify(work)}</p>
      {/*
       */}
    </SheetContent>
  )
}

function EditorSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="admin-editor-section">
      <header>
        <strong>{title}</strong>
        <span>{description}</span>
      </header>
      <div>{children}</div>
    </section>
  )
}

function Field({
  label,
  wide,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={cn("admin-field", wide && "wide")}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function parseList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ]
}

function ArrayField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <Field label={label}>
      <Input
        value={value.join(", ")}
        onChange={(e) => onChange(parseList(e.target.value))}
      />
    </Field>
  )
}

function CreditField({
  value,
  onChange,
}: {
  value: WorkCredit[]
  onChange: (value: WorkCredit[]) => void
}) {
  const text = value
    .map((credit) => `${credit.name} | ${credit.entityType} | ${credit.role}`)
    .join("\n")
  return (
    <Field label="Contributors" wide>
      <textarea
        rows={4}
        value={text}
        placeholder="Naoki Urasawa | person | writer"
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((line) => line.split("|").map((part) => part.trim()))
              .filter(([name, entityType, role]) => name && entityType && role)
              .map(([name, entityType, role]) => ({
                entityId: `${entityType}:${name}`,
                name,
                entityType,
                role,
              }))
          )
        }
      />
      <small>One per line: name | type | role</small>
    </Field>
  )
}

function RelationshipEditor({
  work,
  works,
  onChange,
}: {
  work: Work
  works: Work[]
  onChange: (relations: WorkRelation[]) => void
}) {
  const candidates = works.filter((candidate) => candidate.id !== work.id)
  const addRelation = () => {
    const candidate = candidates[0]
    if (!candidate) return
    onChange([
      ...work.relations,
      {
        id: crypto.randomUUID(),
        workId: candidate.id,
        relationType: "related",
        direction: "outgoing",
        notes: "",
        work: {
          id: candidate.id,
          title: candidate.title,
          kind: candidate.kind,
          year: candidate.year,
          releaseStatus: candidate.releaseStatus,
          imagePath: candidate.imagePath,
        },
      },
    ])
  }
  const update = (index: number, patch: Partial<WorkRelation>) => {
    onChange(
      work.relations.map((relation, current) => {
        if (current !== index) return relation
        const candidate = patch.workId
          ? works.find((item) => item.id === patch.workId)
          : undefined
        return {
          ...relation,
          ...patch,
          ...(candidate
            ? {
                work: {
                  id: candidate.id,
                  title: candidate.title,
                  kind: candidate.kind,
                  year: candidate.year,
                  releaseStatus: candidate.releaseStatus,
                  imagePath: candidate.imagePath,
                },
              }
            : {}),
        }
      })
    )
  }
  return (
    <div className="admin-relationship-editor">
      {work.relations.map((relation, index) => (
        <div key={relation.id} className="admin-relationship-row">
          <select
            value={relation.workId}
            onChange={(event) => update(index, { workId: event.target.value })}
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
          <select
            value={relation.relationType}
            onChange={(event) =>
              update(index, {
                relationType: event.target
                  .value as WorkRelation["relationType"],
              })
            }
          >
            {["adaptation", "sequel", "prequel", "spin-off", "related"].map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              )
            )}
          </select>
          <select
            value={relation.direction}
            onChange={(event) =>
              update(index, {
                direction: event.target.value as WorkRelation["direction"],
              })
            }
          >
            <option value="outgoing">This work → selected work</option>
            <option value="incoming">Selected work → this work</option>
          </select>
          <Input
            value={relation.notes}
            placeholder="Optional note"
            onChange={(event) => update(index, { notes: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange(work.relations.filter((_, current) => current !== index))
            }
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRelation}>
        <PlusIcon /> Add relationship
      </Button>
    </div>
  )
}

type RiskLevel = "none" | "low" | "medium" | "high" | "unknown"
function RiskSelect({
  value,
  onChange,
}: {
  value: RiskLevel
  onChange: (value: RiskLevel) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as RiskLevel)}
    >
      {["unknown", "none", "low", "medium", "high"].map((risk) => (
        <option key={risk}>{risk}</option>
      ))}
    </select>
  )
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

function BulkEditDialog({
  open,
  onOpenChange,
  workIds,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workIds: string[]
  onUpdated: () => Promise<void>
}) {
  const [kind, setKind] = useState("")
  const [status, setStatus] = useState("")
  const [rating, setRating] = useState("")
  const [favorite, setFavorite] = useState("")
  const [addGenres, setAddGenres] = useState("")
  const [removeGenres, setRemoveGenres] = useState("")
  const [addTags, setAddTags] = useState("")
  const [removeTags, setRemoveTags] = useState("")
  const mutation = useMutation({
    mutationFn: editWorksBulk,
    onSuccess: async () => {
      onOpenChange(false)
      await onUpdated()
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      data: {
        workIds,
        ...(kind ? { kind: kind as WorkKind } : {}),
        ...(status ? { status: status as Work["status"] } : {}),
        ...(rating ? { rating: Number(rating) } : {}),
        ...(favorite ? { favorite: favorite === "true" } : {}),
        addGenres: parseList(addGenres),
        removeGenres: parseList(removeGenres),
        addTags: parseList(addTags),
        removeTags: parseList(removeTags),
      },
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-bulk-dialog">
        <DialogHeader>
          <DialogTitle>Edit {workIds.length} selected works</DialogTitle>
          <DialogDescription>
            Only configured fields are changed. Add/remove operations preserve
            every other value.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="bulk-edit-grid">
          <Field label="Set type">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Keep unchanged</option>
              {workKinds.map((item) => (
                <option key={item} value={item}>
                  {kindLabels[item]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Set status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Keep unchanged</option>
              {personalStatuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Set rating">
            <Input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="Keep unchanged"
            />
          </Field>
          <Field label="Set favorite">
            <select
              value={favorite}
              onChange={(e) => setFavorite(e.target.value)}
            >
              <option value="">Keep unchanged</option>
              <option value="true">Favorite</option>
              <option value="false">Not favorite</option>
            </select>
          </Field>
          <Field label="Add genres">
            <Input
              value={addGenres}
              onChange={(e) => setAddGenres(e.target.value)}
              placeholder="Drama, Classic"
            />
          </Field>
          <Field label="Remove genres">
            <Input
              value={removeGenres}
              onChange={(e) => setRemoveGenres(e.target.value)}
              placeholder="Ecchi"
            />
          </Field>
          <Field label="Add tags">
            <Input
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
            />
          </Field>
          <Field label="Remove tags">
            <Input
              value={removeTags}
              onChange={(e) => setRemoveTags(e.target.value)}
            />
          </Field>
          {mutation.error ? (
            <p className="admin-form-error">{mutation.error.message}</p>
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
              <NotePencilIcon />{" "}
              {mutation.isPending ? "Updating…" : "Apply changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
