"use client"

import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  BracketsCurlyIcon,
  CheckIcon,
  FloppyDiskIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  adminWorkUpdateSchema,
  type AdminWorkUpdate,
  type Work,
} from "@/features/library/model"
import { saveWork } from "@/server/library.functions"
import { cn } from "@/lib/utils"

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

export function JsonEditorDialog({
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
      <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-background text-foreground overflow-hidden border-border/60">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border/60 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground">
              <BracketsCurlyIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Works JSON editor
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {parsedWorks
                  ? "Review every field change before the database is updated."
                  : "Inspect and edit complete work records in a controlled scope."}
              </DialogDescription>
            </div>
          </div>

          <div
            className="flex items-center gap-2 self-start md:self-auto"
            aria-label="Editor progress"
          >
            <span
              className={cn(
                "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                !parsedWorks
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/60"
              )}
            >
              1 · Edit JSON
            </span>
            <span
              className={cn(
                "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                parsedWorks
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/60"
              )}
            >
              2 · Review changes
            </span>
          </div>
        </DialogHeader>

        {/* Content Body */}
        {parsedWorks ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <strong className="text-sm font-semibold block text-foreground">
                  {changes.length} {changes.length === 1 ? "work" : "works"}{" "}
                  changed
                </strong>
                <span className="text-xs text-muted-foreground">
                  {changes.reduce(
                    (total, change) => total + change.fields.length,
                    0
                  )}{" "}
                  field updates · unchanged records will not be saved
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {changes.length} pending
              </Badge>
            </div>

            {changes.length ? (
              <div className="space-y-4">
                {changes.map(({ work, original, fields }) => (
                  <section
                    key={work.id}
                    className="rounded-lg border border-border/60 bg-card p-4 space-y-4"
                  >
                    <header className="flex items-center justify-between pb-3 border-b border-border/50">
                      <strong className="text-sm font-medium">
                        {work.title}
                      </strong>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                        {work.id}
                      </code>
                    </header>

                    <div className="space-y-4">
                      {fields.map((field) => (
                        <article key={field} className="space-y-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                            {field}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                            <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
                              <span className="text-[10px] font-semibold tracking-wider text-rose-500 uppercase block">
                                Before
                              </span>
                              <pre className="whitespace-pre-wrap break-all text-muted-foreground leading-relaxed">
                                {displayJsonValue(
                                  original[field as keyof AdminWorkUpdate]
                                )}
                              </pre>
                            </div>
                            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                              <span className="text-[10px] font-semibold tracking-wider text-emerald-500 uppercase block">
                                After
                              </span>
                              <pre className="whitespace-pre-wrap break-all text-foreground leading-relaxed">
                                {displayJsonValue(
                                  work[field as keyof AdminWorkUpdate]
                                )}
                              </pre>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border/80 rounded-lg bg-card/40 space-y-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckIcon className="size-6" />
                </div>
                <div className="space-y-1">
                  <strong className="text-base font-semibold block">
                    No changes found
                  </strong>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    The edited JSON matches the current database values.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr] overflow-hidden min-h-0">
            {/* Sidebar Scope Selector */}
            <aside className="p-4 border-r border-border/60 bg-muted/20 space-y-4 overflow-y-auto text-xs">
              <strong className="font-semibold text-foreground block">
                Records to show
              </strong>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => selectScope("all")}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors font-medium",
                    scope === "all"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>All works</span>
                  <Badge
                    variant={scope === "all" ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-5"
                  >
                    {works.length}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => selectScope("visible")}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors font-medium",
                    scope === "visible"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>Current results</span>
                  <Badge
                    variant={scope === "visible" ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-5"
                  >
                    {visibleWorks.length}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => selectScope("selected")}
                  disabled={!selectedIds.size}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors font-medium",
                    scope === "selected"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground",
                    !selectedIds.size &&
                      "opacity-50 cursor-not-allowed hover:bg-background/50"
                  )}
                >
                  <span>Selected works</span>
                  <Badge
                    variant={scope === "selected" ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-5"
                  >
                    {selectedIds.size}
                  </Badge>
                </button>
              </div>

              <p className="p-3 rounded-md bg-muted/50 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                Readonly database fields are omitted. Work IDs and the records
                in this scope cannot be changed.
              </p>
            </aside>

            {/* Code Textarea Area */}
            <div className="flex flex-col h-full min-h-0 bg-background">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 text-xs font-mono text-muted-foreground bg-muted/30 shrink-0">
                <span>{sourceWorks.length} records</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-muted border border-border/50">
                  application/json
                </span>
              </div>
              <textarea
                value={json}
                onChange={(event) => setJson(event.target.value)}
                spellCheck={false}
                aria-label="Works JSON"
                className="flex-1 w-full h-full p-4 font-mono text-xs bg-transparent border-0 focus:outline-none resize-none overflow-auto leading-relaxed text-foreground selection:bg-primary/20"
              />
            </div>
          </div>
        )}

        {/* Errors */}
        {(error || mutation.error) && (
          <div className="px-6 py-2 shrink-0 border-t border-border/60 bg-destructive/10">
            <Alert
              variant="destructive"
              className="py-2 border-0 bg-transparent text-xs font-medium"
            >
              <AlertDescription>
                {error || mutation.error?.message}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-background shrink-0 flex flex-row items-center justify-end gap-2">
          {parsedWorks ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setParsedWorks(null)}
                disabled={mutation.isPending}
              >
                Back to editor
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  mutation.mutate(changes.map(({ work }) => work))
                }
                disabled={!changes.length || mutation.isPending}
              >
                <FloppyDiskIcon className="size-4 mr-1.5" />
                {mutation.isPending
                  ? "Saving…"
                  : `Save ${changes.length} changed ${changes.length === 1 ? "work" : "works"}`}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
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
