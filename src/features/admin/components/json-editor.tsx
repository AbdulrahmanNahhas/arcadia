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
type DiffKind = "added" | "removed" | "changed"
type FieldDiff = {
  kind: DiffKind
  path: string
  oldValue?: unknown
  newValue?: unknown
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPrimitive(value: unknown) {
  return value === null || (typeof value !== "object" && value !== undefined)
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function objectPath(path: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`
}

function collectValueDiffs(
  value: unknown,
  path: string,
  kind: "added" | "removed"
): FieldDiff[] {
  if (Array.isArray(value)) {
    if (!value.length) {
      return [
        kind === "added"
          ? { kind, path, newValue: value }
          : { kind, path, oldValue: value },
      ]
    }
    return value.flatMap((item, index) =>
      collectValueDiffs(item, `${path}[${index}]`, kind)
    )
  }
  if (isObject(value)) {
    const entries = Object.entries(value).filter(
      ([, child]) => child !== undefined
    )
    if (!entries.length) {
      return [
        kind === "added"
          ? { kind, path, newValue: value }
          : { kind, path, oldValue: value },
      ]
    }
    return entries.flatMap(([key, child]) =>
      collectValueDiffs(child, objectPath(path, key), kind)
    )
  }
  return [
    kind === "added"
      ? { kind, path, newValue: value }
      : { kind, path, oldValue: value },
  ]
}

function findArrayIdentityKey(left: unknown[], right: unknown[]) {
  if (
    !left.length ||
    !right.length ||
    !left.every(isObject) ||
    !right.every(isObject)
  ) {
    return null
  }

  const keys = Object.keys(left[0]).filter((key) =>
    [...left, ...right].every((item) => key in item && isPrimitive(item[key]))
  )

  return (
    keys
      .map((key) => {
        const leftValues = left.map((item) => JSON.stringify(item[key]))
        const rightValues = right.map((item) => JSON.stringify(item[key]))
        const rightSet = new Set(rightValues)
        return {
          key,
          overlap: leftValues.filter((value) => rightSet.has(value)).length,
          unique:
            new Set(leftValues).size === leftValues.length &&
            new Set(rightValues).size === rightValues.length,
        }
      })
      .filter(({ overlap, unique }) => overlap > 0 && unique)
      .sort((a, b) => b.overlap - a.overlap || a.key.localeCompare(b.key))[0]
      ?.key ?? null
  )
}

function diffArrays(
  left: unknown[],
  right: unknown[],
  path: string
): FieldDiff[] {
  const identityKey = findArrayIdentityKey(left, right)
  if (identityKey) {
    const identity = (item: JsonObject) => JSON.stringify(item[identityKey])
    const leftByIdentity = new Map(
      left.map((item, index) => [identity(item as JsonObject), { item, index }])
    )
    const rightByIdentity = new Map(
      right.map((item, index) => [
        identity(item as JsonObject),
        { item, index },
      ])
    )
    const commonLeft = left
      .map((item) => identity(item as JsonObject))
      .filter((value) => rightByIdentity.has(value))
    const commonRight = right
      .map((item) => identity(item as JsonObject))
      .filter((value) => leftByIdentity.has(value))
    const leftPosition = new Map(
      commonLeft.map((value, index) => [value, index])
    )
    const rightPosition = new Map(
      commonRight.map((value, index) => [value, index])
    )
    const diffs: FieldDiff[] = []

    for (const [value, previous] of leftByIdentity) {
      const next = rightByIdentity.get(value)
      if (!next) {
        diffs.push(
          ...collectValueDiffs(
            previous.item,
            `${path}[${previous.index}]`,
            "removed"
          )
        )
        continue
      }
      const selector = `${path}[${identityKey}=${value}]`
      diffs.push(...diffValues(previous.item, next.item, selector))
      if (leftPosition.get(value) !== rightPosition.get(value)) {
        diffs.push({
          kind: "changed",
          path: `${selector}.[array position]`,
          oldValue: previous.index,
          newValue: next.index,
        })
      }
    }
    for (const [value, next] of rightByIdentity) {
      if (!leftByIdentity.has(value)) {
        diffs.push(
          ...collectValueDiffs(next.item, `${path}[${next.index}]`, "added")
        )
      }
    }
    return diffs
  }

  if (left.length === right.length) {
    return left.flatMap((value, index) =>
      diffValues(value, right[index], `${path}[${index}]`)
    )
  }

  const matches = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0)
  )
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex--) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex--) {
      matches[leftIndex][rightIndex] = valuesEqual(
        left[leftIndex],
        right[rightIndex]
      )
        ? matches[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(
            matches[leftIndex + 1][rightIndex],
            matches[leftIndex][rightIndex + 1]
          )
    }
  }

  const diffs: FieldDiff[] = []
  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length || rightIndex < right.length) {
    if (
      leftIndex < left.length &&
      rightIndex < right.length &&
      valuesEqual(left[leftIndex], right[rightIndex])
    ) {
      leftIndex++
      rightIndex++
    } else if (
      rightIndex < right.length &&
      (leftIndex === left.length ||
        matches[leftIndex][rightIndex + 1] >=
          matches[leftIndex + 1][rightIndex])
    ) {
      diffs.push(
        ...collectValueDiffs(
          right[rightIndex],
          `${path}[${rightIndex}]`,
          "added"
        )
      )
      rightIndex++
    } else {
      diffs.push(
        ...collectValueDiffs(
          left[leftIndex],
          `${path}[${leftIndex}]`,
          "removed"
        )
      )
      leftIndex++
    }
  }
  return diffs
}

function diffValues(left: unknown, right: unknown, path: string): FieldDiff[] {
  if (valuesEqual(left, right)) return []

  if (Array.isArray(left) && Array.isArray(right)) {
    return diffArrays(left, right, path)
  }
  if (isObject(left) && isObject(right)) {
    const keys = new Set([
      ...Object.keys(left).filter((key) => left[key] !== undefined),
      ...Object.keys(right).filter((key) => right[key] !== undefined),
    ])
    return [...keys].flatMap((key) => {
      const hasLeft = key in left && left[key] !== undefined
      const hasRight = key in right && right[key] !== undefined
      const childPath = objectPath(path, key)
      if (!hasLeft) return collectValueDiffs(right[key], childPath, "added")
      if (!hasRight) return collectValueDiffs(left[key], childPath, "removed")
      return diffValues(left[key], right[key], childPath)
    })
  }
  if (
    isObject(left) ||
    Array.isArray(left) ||
    isObject(right) ||
    Array.isArray(right)
  ) {
    return [
      ...collectValueDiffs(left, path, "removed"),
      ...collectValueDiffs(right, path, "added"),
    ]
  }
  return [{ kind: "changed", path, oldValue: left, newValue: right }]
}

function formatDiffValue(value: unknown, present: boolean) {
  if (!present) return "Not present"
  if (value === undefined) return "undefined"
  return JSON.stringify(value, null, 2)
}

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
      const fieldDiffs = [
        ...(workChanged ? diffValues(original.work, record.work, "work") : []),
        ...(structureChanged
          ? diffValues(original.structure, record.structure, "structure")
          : []),
      ]
      return workChanged || structureChanged
        ? [{ record, workChanged, structureChanged, fieldDiffs }]
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
            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
              <div>
                <strong className="block text-sm">
                  {changes.length} records changed
                </strong>
                <span className="text-xs text-muted-foreground">
                  {changes.reduce(
                    (total, change) => total + change.fieldDiffs.length,
                    0
                  )}{" "}
                  field changes are ready to save.
                </span>
              </div>
              <Badge>{changes.length} pending</Badge>
            </div>
            {changes.length ? (
              <div className="flex flex-col gap-4">
                {changes.map(
                  ({ record, workChanged, structureChanged, fieldDiffs }) => {
                    const headingId = `json-review-${record.work.id}`
                    return (
                      <section
                        key={record.work.id}
                        aria-labelledby={headingId}
                        className="overflow-hidden rounded-lg border bg-card"
                      >
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                          <div>
                            <h3
                              id={headingId}
                              className="text-sm font-semibold"
                            >
                              Work record
                            </h3>
                            <code className="mt-1 block text-[10px] text-muted-foreground">
                              {record.work.id}
                            </code>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Badge variant="outline">
                              {fieldDiffs.length} field
                              {fieldDiffs.length === 1 ? "" : "s"}
                            </Badge>
                            {workChanged && <Badge>Work & personal</Badge>}
                            {structureChanged && (
                              <Badge variant="secondary">Structure</Badge>
                            )}
                          </div>
                        </header>
                        <dl className="divide-y">
                          {fieldDiffs.map((diff, index) => {
                            const hasOldValue = diff.kind !== "added"
                            const hasNewValue = diff.kind !== "removed"
                            return (
                              <div
                                key={`${diff.kind}-${diff.path}-${index}`}
                                className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start"
                              >
                                <dt className="flex min-w-0 flex-col items-start gap-1.5">
                                  <Badge
                                    variant={
                                      diff.kind === "removed"
                                        ? "destructive"
                                        : diff.kind === "changed"
                                          ? "secondary"
                                          : "default"
                                    }
                                  >
                                    {diff.kind}
                                  </Badge>
                                  <code className="text-[11px] break-all text-muted-foreground">
                                    {diff.path}
                                  </code>
                                </dt>
                                <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                                  <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    Old value
                                  </span>
                                  <pre className="font-mono text-xs break-all whitespace-pre-wrap">
                                    {formatDiffValue(
                                      diff.oldValue,
                                      hasOldValue
                                    )}
                                  </pre>
                                </dd>
                                <span
                                  aria-hidden="true"
                                  className="hidden pt-7 text-muted-foreground lg:block"
                                >
                                  →
                                </span>
                                <span className="sr-only">changed to</span>
                                <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                                  <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    New value
                                  </span>
                                  <pre className="font-mono text-xs break-all whitespace-pre-wrap">
                                    {formatDiffValue(
                                      diff.newValue,
                                      hasNewValue
                                    )}
                                  </pre>
                                </dd>
                              </div>
                            )
                          })}
                        </dl>
                      </section>
                    )
                  }
                )}
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
