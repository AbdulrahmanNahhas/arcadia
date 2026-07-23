"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { z } from "zod"
import {
  BracketsCurlyIcon,
  CheckIcon,
  FloppyDiskIcon,
} from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  editableWorkStructureSchema,
} from "@/features/library/model"
import type { AdminWorkUpdate, Work } from "@/features/library/model"
import {
  getAdminRecordBundles,
  saveWork,
  saveWorkStructure,
} from "@/server/library.functions"
import { cn } from "@/lib/utils"

type JsonScope = "all" | "visible" | "selected"

const completeRecordSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z.object({
      work: adminWorkUpdateSchema,
      structure: editableWorkStructureSchema,
      tracking: z.object({
        existing: z.array(z.unknown()),
      }),
    })
  ),
})

type CompleteRecordDocument = z.infer<typeof completeRecordSchema>
type CompleteRecord = CompleteRecordDocument["records"][number]

function toEditableWork(work: Work): AdminWorkUpdate {
  const {
    addedAt: _addedAt,
    catalogUpdatedAt: _catalogUpdatedAt,
    personalUpdatedAt: _personalUpdatedAt,
    palette: _palette,
    relations,
    ...editable
  } = work
  return adminWorkUpdateSchema.parse({
    ...editable,
    relations: relations.map(({ workId, relationType, direction, notes }) => ({
      workId,
      relationType,
      direction,
      notes,
    })),
  })
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
  const [json, setJson] = useState("")
  const [reviewed, setReviewed] = useState<CompleteRecordDocument | null>(null)
  const [error, setError] = useState("")
  const sourceWorks =
    scope === "visible"
      ? visibleWorks
      : scope === "selected"
        ? works.filter(({ id }) => selectedIds.has(id))
        : works
  const sourceIds = sourceWorks.map(({ id }) => id)
  const bundlesQuery = useQuery({
    queryKey: ["admin-record-bundles", sourceIds],
    queryFn: () => getAdminRecordBundles({ data: { workIds: sourceIds } }),
    enabled: open && sourceIds.length > 0,
  })
  const sourceDocument = useMemo<CompleteRecordDocument | null>(() => {
    if (!bundlesQuery.data) return null
    return {
      schemaVersion: 1,
      records: bundlesQuery.data.map((bundle) => ({
        work: toEditableWork(bundle.work),
        structure: bundle.structure,
        tracking: {
          existing: bundle.tracking,
        },
      })),
    }
  }, [bundlesQuery.data])

  useEffect(() => {
    if (!open || !sourceDocument) return
    setJson(JSON.stringify(sourceDocument, null, 2))
    setReviewed(null)
    setError("")
  }, [open, scope, sourceDocument])

  const changes = useMemo(() => {
    if (!reviewed || !sourceDocument) return []
    const originals = new Map(
      sourceDocument.records.map((record) => [record.work.id, record])
    )
    return reviewed.records.flatMap((record) => {
      const original = originals.get(record.work.id)
      if (!original) return []
      const workChanged =
        JSON.stringify(original.work) !== JSON.stringify(record.work)
      const structureChanged =
        JSON.stringify(original.structure) !== JSON.stringify(record.structure)
      return workChanged || structureChanged
        ? [{ record, workChanged, structureChanged }]
        : []
    })
  }, [reviewed, sourceDocument])

  const review = () => {
    try {
      const raw: unknown = JSON.parse(json)
      const result = completeRecordSchema.safeParse(raw)
      if (!result.success) {
        const issue = result.error.issues[0]
        setError(
          `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`
        )
        return
      }
      if (!sourceDocument) {
        setError("The source records have not loaded yet.")
        return
      }
      const originalIds = sourceDocument.records
        .map(({ work }) => work.id)
        .sort()
      const nextIds = result.data.records.map(({ work }) => work.id).sort()
      if (
        new Set(nextIds).size !== nextIds.length ||
        JSON.stringify(originalIds) !== JSON.stringify(nextIds)
      ) {
        setError(
          "Keep exactly the same work IDs in this scope. Add and remove works through the dedicated admin actions."
        )
        return
      }
      for (const record of result.data.records) {
        if (record.structure.workId !== record.work.id) {
          setError(
            `${record.work.id}: structure.workId must match the work ID.`
          )
          return
        }
        const original = sourceDocument.records.find(
          ({ work }) => work.id === record.work.id
        )
        if (
          !original ||
          JSON.stringify(original.tracking.existing) !==
            JSON.stringify(record.tracking.existing)
        ) {
          setError(
            `${record.work.id}: tracking.existing is immutable. Add checkpoints through the tracking form.`
          )
          return
        }
      }
      setError("")
      setReviewed(result.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid JSON")
    }
  }

  const mutation = useMutation({
    mutationFn: async (
      updates: Array<{
        record: CompleteRecord
        workChanged: boolean
        structureChanged: boolean
      }>
    ) => {
      for (const update of updates) {
        if (update.workChanged) {
          await saveWork({ data: update.record.work })
        }
        if (update.structureChanged) {
          await saveWorkStructure({ data: update.record.structure })
        }
      }
    },
    onSuccess: async () => {
      await onSaved()
      onOpenChange(false)
    },
  })

  const selectScope = (nextScope: JsonScope) => {
    setScope(nextScope)
    setReviewed(null)
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="flex shrink-0 flex-col justify-between gap-4 border-b border-l-4 border-l-amber-500 p-5 text-left md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
              <BracketsCurlyIcon className="size-5" />
            </div>
            <div>
              <DialogTitle>Complete record JSON editor</DialogTitle>
              <DialogDescription>
                Edit catalog metadata and structure together. Tracking
                checkpoints are read-only here and use the dated tracking form.
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-1 font-mono text-[10px]">
            <Badge variant={reviewed ? "outline" : "default"}>1 · Edit</Badge>
            <Badge variant={reviewed ? "default" : "outline"}>2 · Review</Badge>
          </div>
        </DialogHeader>

        {reviewed ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <div>
                <strong className="block text-sm">
                  {changes.length} records changed
                </strong>
                <span className="text-xs text-muted-foreground">
                  Review each database domain before saving.
                </span>
              </div>
              <Badge>{changes.length} pending</Badge>
            </div>
            {changes.length ? (
              <div className="space-y-3">
                {changes.map(({ record, workChanged, structureChanged }) => (
                  <section
                    key={record.work.id}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <strong className="text-sm">{record.work.title}</strong>
                        <code className="mt-1 block text-[10px] text-muted-foreground">
                          {record.work.id}
                        </code>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {workChanged && <Badge>Work & personal</Badge>}
                        {structureChanged && (
                          <Badge variant="secondary">Structure</Badge>
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-lg border border-dashed p-12 text-center">
                <CheckIcon className="mb-3 size-8 text-emerald-500" />
                <strong>No changes found</strong>
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[250px_1fr]">
            <aside className="space-y-4 overflow-y-auto border-r bg-muted/20 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold">Records to show</p>
                <div className="space-y-1">
                  {(
                    [
                      ["all", "All works", works.length],
                      ["visible", "Current results", visibleWorks.length],
                      ["selected", "Selected works", selectedIds.size],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={value === "selected" && !selectedIds.size}
                      onClick={() => selectScope(value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs",
                        scope === value
                          ? "border-foreground bg-foreground text-background"
                          : "border-transparent bg-background hover:border-border",
                        value === "selected" &&
                          !selectedIds.size &&
                          "opacity-40"
                      )}
                    >
                      {label}
                      <span className="font-mono">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border bg-background p-3 text-[11px] leading-5 text-muted-foreground">
                <strong className="block text-foreground">
                  Document structure
                </strong>
                <code>work</code> — catalog fields and preferences.
                <br />
                <code>structure</code> — seasons and atomic units. Keep IDs
                referenced by tracking.
                <br />
                <code>tracking.existing</code> — read-only dated checkpoints.
              </div>
            </aside>
            <div className="flex min-h-0 flex-col">
              <div className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/20 px-4 font-mono text-[10px] text-muted-foreground">
                <span>{sourceWorks.length} complete records</span>
                <span>schemaVersion 1 · application/json</span>
              </div>
              {bundlesQuery.isPending ? (
                <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                  Loading normalized records…
                </div>
              ) : (
                <textarea
                  value={json}
                  onChange={(event) => setJson(event.target.value)}
                  spellCheck={false}
                  aria-label="Complete records JSON"
                  className="min-h-0 flex-1 resize-none border-0 bg-transparent p-4 font-mono text-xs leading-5 outline-none"
                />
              )}
            </div>
          </div>
        )}

        {(error || mutation.error || bundlesQuery.error) && (
          <div className="shrink-0 border-t bg-destructive/5 px-5 py-2">
            <Alert variant="destructive" className="border-0 bg-transparent">
              <AlertDescription>
                {error ||
                  mutation.error?.message ||
                  bundlesQuery.error?.message}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="flex-row justify-end border-t p-4">
          {reviewed ? (
            <>
              <Button
                variant="outline"
                onClick={() => setReviewed(null)}
                disabled={mutation.isPending}
              >
                Back to editor
              </Button>
              <Button
                onClick={() => mutation.mutate(changes)}
                disabled={!changes.length || mutation.isPending}
              >
                <FloppyDiskIcon />
                {mutation.isPending
                  ? "Saving…"
                  : `Save ${changes.length} records`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={review}
                disabled={!sourceDocument || bundlesQuery.isPending}
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
