"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { z } from "zod"
import {
  ArrowsClockwiseIcon,
  BracketsCurlyIcon,
  CheckIcon,
  ClipboardTextIcon,
  CodeIcon,
  FloppyDiskIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  adminWorkTransportSchema,
  editableWorkStructureSchema,
} from "@/features/library/model"
import type { AdminWorkUpdate, Work } from "@/features/library/model"
import {
  getAdminRecordBundles,
  saveAdminRecordChanges,
} from "@/server/library.functions"
import { cn } from "@/lib/utils"

type JsonScope = "all" | "visible" | "selected"
type ProjectionPreset = keyof typeof PROJECTION_PRESETS | "custom"

const PROJECTION_FIELDS = [
  { key: "work.title", label: "العنوان", group: "الهوية" },
  { key: "work.arabicTitle", label: "العنوان العربي", group: "الهوية" },
  { key: "work.aliases", label: "العناوين البديلة", group: "الهوية" },
  { key: "work.summary", label: "الملخص", group: "الهوية" },
  { key: "work.kind", label: "النوع", group: "الفهرس" },
  { key: "work.year", label: "سنة الإصدار", group: "الفهرس" },
  { key: "work.releaseStatus", label: "حالة الإصدار", group: "الفهرس" },
  { key: "work.runtimeMinutes", label: "مدة العرض", group: "الفهرس" },
  { key: "work.playtimeMinutes", label: "مدة اللعب", group: "الفهرس" },
  { key: "work.pageCount", label: "عدد الصفحات", group: "الفهرس" },
  { key: "work.episodeCount", label: "عدد الحلقات", group: "الفهرس" },
  { key: "work.chapterCount", label: "عدد الفصول", group: "الفهرس" },
  { key: "work.volumeCount", label: "عدد المجلدات", group: "الفهرس" },
  { key: "work.routeCount", label: "عدد المسارات", group: "الفهرس" },
  { key: "work.genres", label: "التصنيفات", group: "التصنيف" },
  { key: "work.tags", label: "الوسوم", group: "التصنيف" },
  { key: "work.tone", label: "الطابع", group: "التصنيف" },
  { key: "work.audience", label: "الجمهور", group: "التصنيف" },
  { key: "work.country", label: "الدول", group: "التصنيف" },
  { key: "work.sharedWith", label: "مشاركة مع", group: "التصنيف" },
  { key: "work.favorite", label: "المفضلة", group: "التقييم والشخصي" },
  {
    key: "work.scoreComponents",
    label: "مكونات التقييم",
    group: "التقييم والشخصي",
  },
  { key: "work.riskProfile", label: "ملف المخاطر", group: "الإرشادات" },
  { key: "work.contentWarnings", label: "تحذيرات المحتوى", group: "الإرشادات" },
  { key: "work.analysisNotes", label: "التحليل", group: "الإرشادات" },
  { key: "work.releaseStart", label: "بداية الإصدار", group: "النشر" },
  { key: "work.releaseEnd", label: "نهاية الإصدار", group: "النشر" },
  { key: "work.watchDates", label: "تواريخ المشاهدة", group: "النشر" },
  {
    key: "work.sourceMaterial",
    label: "المادة الأصلية",
    group: "النشر",
  },
  { key: "work.publication", label: "النشر", group: "النشر" },
  { key: "work.curation", label: "المراجعة", group: "النشر" },
  {
    key: "work.externalLinks",
    label: "الروابط الخارجية",
    group: "العلاقات والوسائط",
  },
  { key: "work.credits", label: "صنّاع العمل", group: "العلاقات والوسائط" },
  { key: "work.relations", label: "العلاقات", group: "العلاقات والوسائط" },
  { key: "work.imagePath", label: "الملصق", group: "العلاقات والوسائط" },
  { key: "work.bannerPath", label: "الغلاف", group: "العلاقات والوسائط" },
  { key: "work.logoPath", label: "الشعار", group: "العلاقات والوسائط" },
  { key: "structure", label: "المواسم والوحدات", group: "البنية" },
] as const

type ProjectionKey = (typeof PROJECTION_FIELDS)[number]["key"]

const PROJECTION_PRESETS = {
  "titles-summary-scores": {
    label: "العناوين والملخص والتقييمات",
    fields: [
      "work.title",
      "work.arabicTitle",
      "work.aliases",
      "work.summary",
      "work.scoreComponents",
    ],
  },
  essential: {
    label: "الفهرس الأساسي",
    fields: [
      "work.title",
      "work.arabicTitle",
      "work.kind",
      "work.year",
      "work.releaseStatus",
      "work.summary",
      "work.genres",
      "work.tags",
    ],
  },
  classification: {
    label: "التصنيف",
    fields: [
      "work.genres",
      "work.tags",
      "work.tone",
      "work.audience",
      "work.country",
      "work.sharedWith",
    ],
  },
  guidance: {
    label: "الإرشادات والتقييمات",
    fields: [
      "work.scoreComponents",
      "work.riskProfile",
      "work.contentWarnings",
      "work.analysisNotes",
    ],
  },
  publication: {
    label: "الإصدار والنشر",
    fields: [
      "work.releaseStart",
      "work.releaseEnd",
      "work.watchDates",
      "work.sourceMaterial",
      "work.publication",
      "work.curation",
      "work.externalLinks",
    ],
  },
  relations: {
    label: "صنّاع العمل والعلاقات",
    fields: ["work.credits", "work.relations"],
  },
  artwork: {
    label: "مسارات الصور",
    fields: ["work.imagePath", "work.bannerPath", "work.logoPath"],
  },
  structure: { label: "البنية", fields: ["structure"] },
  complete: {
    label: "السجل الكامل القابل للتعديل",
    fields: PROJECTION_FIELDS.map(({ key }) => key),
  },
} as const satisfies Record<
  string,
  { label: string; fields: readonly ProjectionKey[] }
>

const DEFAULT_PRESET = "titles-summary-scores" as const

const completeRecordSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z.object({
      work: adminWorkTransportSchema,
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
  if (!present) return "غير موجود"
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
  return adminWorkTransportSchema.parse({
    ...editable,
    relations: relations.map(({ workId, relationType, direction, notes }) => ({
      workId,
      relationType,
      direction,
      notes,
    })),
  })
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  )
}

function projectDocument(
  document: CompleteRecordDocument,
  fields: readonly ProjectionKey[],
  preset: ProjectionPreset
) {
  const workFields = fields
    .filter((field): field is Extract<ProjectionKey, `work.${string}`> =>
      field.startsWith("work.")
    )
    .map((field) => field.slice(5))
  const includeStructure = fields.includes("structure")
  return {
    schemaVersion: 2,
    projection: { preset, fields },
    records: document.records.map((record) => {
      const projectedWork: JsonObject = { id: record.work.id }
      for (const field of workFields) {
        projectedWork[field] = (record.work as unknown as JsonObject)[field]
      }
      return {
        id: record.work.id,
        work: projectedWork,
        ...(includeStructure ? { structure: record.structure } : {}),
      }
    }),
  }
}

function parseProjectedDocument(
  text: string,
  base: CompleteRecordDocument,
  fields: readonly ProjectionKey[],
  preset: ProjectionPreset
): CompleteRecordDocument {
  const raw: unknown = JSON.parse(text)
  if (!isObject(raw)) throw new Error("يجب أن يكون المستند كائن JSON.")
  if (raw.schemaVersion !== 2) throw new Error("schemaVersion must be 2.")
  if (!isObject(raw.projection)) throw new Error("projection is required.")
  if (raw.projection.preset !== preset) {
    throw new Error("قالب العرض مقفل. غيّره من عناصر تحكم المحرر.")
  }
  if (
    !Array.isArray(raw.projection.fields) ||
    !raw.projection.fields.every((field) => typeof field === "string") ||
    !sameStringSet(raw.projection.fields, fields)
  ) {
    throw new Error("قائمة حقول العرض مقفلة. استخدم عنصر تحكم الحقول.")
  }
  if (!Array.isArray(raw.records)) throw new Error("records must be an array.")

  const originals = new Map(
    base.records.map((record) => [record.work.id, record])
  )
  const expectedIds = [...originals.keys()].sort()
  const receivedIds: string[] = []
  const workFields = fields
    .filter((field): field is Extract<ProjectionKey, `work.${string}`> =>
      field.startsWith("work.")
    )
    .map((field) => field.slice(5))
  const allowedWorkFields = new Set(["id", ...workFields])
  const includeStructure = fields.includes("structure")

  const records = raw.records.map((value, index) => {
    if (!isObject(value)) throw new Error(`records.${index} must be an object.`)
    const allowedRecordKeys = new Set([
      "id",
      "work",
      ...(includeStructure ? ["structure"] : []),
    ])
    const unknownRecordKey = Object.keys(value).find(
      (key) => !allowedRecordKeys.has(key)
    )
    if (unknownRecordKey) {
      throw new Error(
        `records.${index}.${unknownRecordKey} is not part of this projection.`
      )
    }
    if (typeof value.id !== "string")
      throw new Error(`records.${index}.id is required.`)
    if (!isObject(value.work))
      throw new Error(`records.${index}.work is required.`)
    const projectedWork = value.work
    if (projectedWork.id !== value.id) {
      throw new Error(`${value.id}: work.id must match the record ID.`)
    }
    const unknownWorkKey = Object.keys(projectedWork).find(
      (key) => !allowedWorkFields.has(key)
    )
    if (unknownWorkKey) {
      throw new Error(
        `${value.id}: work.${unknownWorkKey} is hidden and cannot be edited in this projection.`
      )
    }
    const missingWorkField = workFields.find(
      (field) => !(field in projectedWork)
    )
    if (missingWorkField) {
      throw new Error(
        `${value.id}: selected field work.${missingWorkField} is missing.`
      )
    }
    const original = originals.get(value.id)
    if (!original)
      throw new Error(`Unknown or out-of-scope work ID: ${value.id}`)
    receivedIds.push(value.id)
    const mergedWork = adminWorkTransportSchema.parse({
      ...original.work,
      ...projectedWork,
      id: original.work.id,
    })
    const structure = includeStructure
      ? editableWorkStructureSchema.parse(value.structure)
      : original.structure
    if (structure.workId !== original.work.id) {
      throw new Error(
        `${value.id}: structure.workId must match the immutable work ID.`
      )
    }
    return { ...original, work: mergedWork, structure }
  })

  const sortedReceived = [...receivedIds].sort()
  if (
    new Set(receivedIds).size !== receivedIds.length ||
    JSON.stringify(expectedIds) !== JSON.stringify(sortedReceived)
  ) {
    throw new Error(
      "احتفظ بمعرّفات الأعمال الفريدة نفسها تماماً ضمن هذا النطاق."
    )
  }
  return { schemaVersion: 1, records }
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
  const [reviewSource, setReviewSource] =
    useState<CompleteRecordDocument | null>(null)
  const [error, setError] = useState("")
  const [preset, setPreset] = useState<ProjectionPreset>(DEFAULT_PRESET)
  const [selectedFields, setSelectedFields] = useState<ProjectionKey[]>(() => [
    ...PROJECTION_PRESETS[DEFAULT_PRESET].fields,
  ])
  const [draftBase, setDraftBase] = useState<CompleteRecordDocument | null>(
    null
  )
  const [dirty, setDirty] = useState(false)
  const [fieldSearch, setFieldSearch] = useState("")
  const [documentSearch, setDocumentSearch] = useState("")
  const [reviewSearch, setReviewSearch] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
      records: bundlesQuery.data.bundles.map((bundle) => ({
        work: toEditableWork(bundle.work),
        structure: bundle.structure,
        tracking: {
          existing: bundle.tracking,
        },
      })),
    }
  }, [bundlesQuery.data])

  useEffect(() => {
    if (!open || !sourceDocument || dirty || reviewed) return
    setDraftBase(sourceDocument)
    setJson(
      JSON.stringify(
        projectDocument(sourceDocument, selectedFields, preset),
        null,
        2
      )
    )
    setError("")
  }, [open, scope, sourceDocument, dirty, reviewed, selectedFields, preset])

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

  const review = async () => {
    try {
      if (!draftBase || !sourceDocument) {
        setError("لم تُحمّل السجلات المصدرية بعد.")
        return
      }
      const merged = parseProjectedDocument(
        json,
        draftBase,
        selectedFields,
        preset
      )
      const refreshed = await bundlesQuery.refetch()
      if (!refreshed.data) {
        throw new Error("تعذر تحديث أحدث سجلات قاعدة البيانات.")
      }
      if (refreshed.data.errors.length) {
        throw new Error(
          `تعذر تحميل ${refreshed.data.errors.length} سجل. أصلح السجلات الموضحة أدناه ثم أعد المحاولة.`
        )
      }
      const latestDocument: CompleteRecordDocument = {
        schemaVersion: 1,
        records: refreshed.data.bundles.map((bundle) => ({
          work: toEditableWork(bundle.work),
          structure: bundle.structure,
          tracking: { existing: bundle.tracking },
        })),
      }
      const latestById = new Map(
        latestDocument.records.map((record) => [record.work.id, record])
      )
      for (const record of merged.records) {
        const opening = draftBase.records.find(
          (candidate) => candidate.work.id === record.work.id
        )
        const latest = latestById.get(record.work.id)
        if (!opening || !latest) {
          throw new Error(
            `${record.work.id}: the source record no longer exists.`
          )
        }
        for (const field of selectedFields) {
          const openingValue =
            field === "structure"
              ? opening.structure
              : (opening.work as unknown as JsonObject)[field.slice(5)]
          const latestValue =
            field === "structure"
              ? latest.structure
              : (latest.work as unknown as JsonObject)[field.slice(5)]
          const draftValue =
            field === "structure"
              ? record.structure
              : (record.work as unknown as JsonObject)[field.slice(5)]
          if (
            !valuesEqual(openingValue, latestValue) &&
            !valuesEqual(openingValue, draftValue) &&
            !valuesEqual(latestValue, draftValue)
          ) {
            throw new Error(
              `${record.work.id}: ${field} changed elsewhere while you were editing. Reset the draft and reapply your change.`
            )
          }
          if (valuesEqual(openingValue, draftValue)) {
            if (field === "structure") record.structure = latest.structure
            else
              (record.work as unknown as JsonObject)[field.slice(5)] =
                latestValue
          }
        }
        const latestWork = latest.work as unknown as JsonObject
        const draftWork = record.work as unknown as JsonObject
        const safelyMergedWork: JsonObject = { ...latestWork }
        for (const field of selectedFields) {
          if (field.startsWith("work.")) {
            safelyMergedWork[field.slice(5)] = draftWork[field.slice(5)]
          }
        }
        record.work = adminWorkTransportSchema.parse(safelyMergedWork)
        if (!selectedFields.includes("structure")) {
          record.structure = latest.structure
        }
        record.tracking = latest.tracking
      }
      setError("")
      setReviewSource(latestDocument)
      setReviewed(completeRecordSchema.parse(merged))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح")
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
      if (!reviewSource) throw new Error("راجع المسودة الحالية قبل الحفظ.")
      const latestResult = await getAdminRecordBundles({
        data: { workIds: sourceIds },
      })
      if (latestResult.errors.length) {
        throw new Error(
          `تعذر التحقق من ${latestResult.errors.length} سجل قبل الحفظ.`
        )
      }
      const latestDocument: CompleteRecordDocument = {
        schemaVersion: 1,
        records: latestResult.bundles.map((bundle) => ({
          work: toEditableWork(bundle.work),
          structure: bundle.structure,
          tracking: { existing: bundle.tracking },
        })),
      }
      if (!valuesEqual(latestDocument, reviewSource)) {
        throw new Error(
          "تغيرت قاعدة البيانات بعد المراجعة. عُد إلى المحرر وراجع مجدداً قبل الحفظ."
        )
      }
      const result = await saveAdminRecordChanges({
        data: {
          changes: updates.map((update) => ({
            workId: update.record.work.id,
            ...(update.workChanged ? { work: update.record.work } : {}),
            ...(update.structureChanged
              ? { structure: update.record.structure }
              : {}),
          })),
        },
      })
      if (result.errors.length) {
        throw new Error(
          result.errors
            .map(({ workId, message }) => `${workId}: ${message}`)
            .join("\n")
        )
      }
    },
    onSuccess: async () => {
      setDirty(false)
      await onSaved()
      onOpenChange(false)
    },
  })

  const jsonValid = useMemo(() => {
    try {
      JSON.parse(json)
      return true
    } catch {
      return false
    }
  }, [json])

  const applyProjection = (
    nextFields: ProjectionKey[],
    nextPreset: ProjectionPreset
  ) => {
    try {
      if (!draftBase) return
      const merged = dirty
        ? parseProjectedDocument(json, draftBase, selectedFields, preset)
        : draftBase
      setDraftBase(merged)
      setSelectedFields(nextFields)
      setPreset(nextPreset)
      setJson(
        JSON.stringify(projectDocument(merged, nextFields, nextPreset), null, 2)
      )
      setDirty(
        Boolean(sourceDocument) &&
          JSON.stringify(merged) !== JSON.stringify(sourceDocument)
      )
      setReviewed(null)
      setError("")
    } catch (caught) {
      setError(
        `${caught instanceof Error ? caught.message : "JSON غير صالح"} أصلح المسودة قبل تغيير عرضها.`
      )
    }
  }

  const choosePreset = (value: string | null) => {
    if (!value || !(value in PROJECTION_PRESETS)) return
    const nextPreset = value as keyof typeof PROJECTION_PRESETS
    applyProjection([...PROJECTION_PRESETS[nextPreset].fields], nextPreset)
  }

  const toggleField = (field: ProjectionKey, checked: boolean) => {
    const nextFields = checked
      ? [...new Set([...selectedFields, field])]
      : selectedFields.filter((candidate) => candidate !== field)
    if (!nextFields.length) {
      setError("اختر حقلاً واحداً قابلاً للتعديل على الأقل.")
      return
    }
    applyProjection(nextFields, "custom")
  }

  const resetDraft = () => {
    if (!sourceDocument) return
    setDraftBase(sourceDocument)
    setJson(
      JSON.stringify(
        projectDocument(sourceDocument, selectedFields, preset),
        null,
        2
      )
    )
    setDirty(false)
    setReviewed(null)
    setError("")
  }

  const formatJson = (compact = false) => {
    try {
      setJson(JSON.stringify(JSON.parse(json), null, compact ? 0 : 2))
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح")
    }
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      setError("تعذر نسخ JSON إلى الحافظة.")
    }
  }

  const findNext = () => {
    const textarea = textareaRef.current
    if (!textarea || !documentSearch) return
    const start = textarea.selectionEnd
    const match = json
      .toLocaleLowerCase()
      .indexOf(documentSearch.toLocaleLowerCase(), start)
    const index =
      match >= 0
        ? match
        : json.toLocaleLowerCase().indexOf(documentSearch.toLocaleLowerCase())
    if (index < 0) {
      setError(`No match for “${documentSearch}”.`)
      return
    }
    textarea.focus()
    textarea.setSelectionRange(index, index + documentSearch.length)
    setError("")
  }

  const selectScope = (nextScope: JsonScope) => {
    if (dirty) {
      setError("أعد ضبط المسودة الحالية أو احفظها قبل تغيير نطاق السجلات.")
      return
    }
    setScope(nextScope)
    setDraftBase(null)
    setReviewed(null)
    setError("")
  }

  const visibleChanges = changes.filter(
    (change) =>
      !reviewSearch ||
      change.record.work.id
        .toLocaleLowerCase()
        .includes(reviewSearch.toLocaleLowerCase()) ||
      change.record.work.title
        .toLocaleLowerCase()
        .includes(reviewSearch.toLocaleLowerCase()) ||
      change.fieldDiffs.some((diff) =>
        diff.path.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase())
      )
  )

  const groupedFields = PROJECTION_FIELDS.reduce(
    (groups, field) => {
      const group = (groups[field.group] ??= [])
      group.push(field)
      return groups
    },
    {} as Record<string, Array<(typeof PROJECTION_FIELDS)[number]>>
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && dirty && !reviewed) {
      setError(
        "تحتوي المسودة على تغييرات غير محفوظة. أعد ضبطها أو راجعها واحفظها قبل الإغلاق."
      )
      return
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none lg:w-[min(72rem,calc(100vw-3rem))]"
      >
        <DialogHeader className="flex shrink-0 flex-col justify-between gap-4 border-b p-5 text-right md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
              <BracketsCurlyIcon className="size-5" />
            </div>
            <div>
              <DialogTitle>مساحة تحرير JSON لقاعدة البيانات</DialogTitle>
              <DialogDescription>
                عدّل الحقول التي تحتاجها فقط. تبقى القيم المخفية محفوظة
                والمعرّفات مقفلة وسجل التتبع محمياً.
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-1 font-mono text-[10px]">
            <Badge variant={reviewed ? "outline" : "default"}>١ · تعديل</Badge>
            <Badge variant={reviewed ? "default" : "outline"}>٢ · مراجعة</Badge>
          </div>
        </DialogHeader>

        {reviewed ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
              <div>
                <strong className="block text-sm">
                  تغيّر {changes.length} سجل
                </strong>
                <span className="text-xs text-muted-foreground">
                  {changes.reduce(
                    (total, change) => total + change.fieldDiffs.length,
                    0
                  )}{" "}
                  تغييراً دقيقاً في الحقول جاهزاً للحفظ.
                </span>
              </div>
              <Badge>{changes.length} معلّق</Badge>
            </div>
            {changes.length ? (
              <div className="flex flex-col gap-4">
                <Input
                  value={reviewSearch}
                  onChange={(event) => setReviewSearch(event.target.value)}
                  placeholder="فلترة حسب العنوان أو المعرّف أو المسار المتغير…"
                  aria-label="فلترة التغييرات المراجعة"
                />
                {visibleChanges.map(
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
                              {record.work.arabicTitle || record.work.title}
                            </h3>
                            <code className="mt-1 block text-[10px] text-muted-foreground">
                              {record.work.id}
                            </code>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Badge variant="outline">
                              {fieldDiffs.length} حقل
                            </Badge>
                            {workChanged && <Badge>العمل والشخصي</Badge>}
                            {structureChanged && (
                              <Badge variant="secondary">البنية</Badge>
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
                                    {diff.kind === "removed"
                                      ? "محذوف"
                                      : diff.kind === "changed"
                                        ? "متغير"
                                        : "مضاف"}
                                  </Badge>
                                  <code className="text-[11px] break-all text-muted-foreground">
                                    {diff.path}
                                  </code>
                                </dt>
                                <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                                  <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    القيمة القديمة
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
                                <span className="sr-only">تغيرت إلى</span>
                                <dd className="min-w-0 rounded-md border bg-muted/20 p-3">
                                  <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    القيمة الجديدة
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
                <strong>لم يُعثر على تغييرات</strong>
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[250px_1fr]">
            <aside className="flex flex-col gap-4 overflow-y-auto border-e bg-muted/20 p-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold">قالب التحرير</p>
                <Select
                  items={Object.entries(PROJECTION_PRESETS).map(
                    ([value, definition]) => ({
                      value,
                      label: definition.label,
                    })
                  )}
                  value={preset}
                  onValueChange={choosePreset}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(PROJECTION_PRESETS).map(
                        ([value, definition]) => (
                          <SelectItem key={value} value={value}>
                            {definition.label}
                          </SelectItem>
                        )
                      )}
                      {preset === "custom" && (
                        <SelectItem value="custom">اختيار مخصص</SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      />
                    }
                  >
                    <span className="flex items-center gap-2">
                      <FunnelIcon data-icon="inline-start" />
                      الحقول
                    </span>
                    <Badge variant="secondary">{selectedFields.length}</Badge>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-96 p-0">
                    <PopoverHeader className="border-b p-4">
                      <PopoverTitle>
                        الحقول الظاهرة القابلة للتعديل
                      </PopoverTitle>
                      <PopoverDescription>
                        يُضمّن معرّف العمل دائماً ولا يمكن تغييره.
                      </PopoverDescription>
                      <Input
                        value={fieldSearch}
                        onChange={(event) => setFieldSearch(event.target.value)}
                        placeholder="ابحث عن الحقول…"
                      />
                    </PopoverHeader>
                    <div className="flex max-h-96 flex-col gap-4 overflow-y-auto p-4">
                      {Object.entries(groupedFields).map(([group, fields]) => {
                        const matchingFields = fields.filter((field) =>
                          `${field.label} ${field.key}`
                            .toLocaleLowerCase()
                            .includes(fieldSearch.toLocaleLowerCase())
                        )
                        if (!matchingFields.length) return null
                        return (
                          <section key={group} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-xs">{group}</strong>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() =>
                                  applyProjection(
                                    [
                                      ...new Set([
                                        ...selectedFields,
                                        ...fields.map((field) => field.key),
                                      ]),
                                    ],
                                    "custom"
                                  )
                                }
                              >
                                تحديد المجموعة
                              </Button>
                            </div>
                            {matchingFields.map((field) => (
                              <label
                                key={field.key}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                              >
                                <Checkbox
                                  checked={selectedFields.includes(field.key)}
                                  onCheckedChange={(checked) =>
                                    toggleField(field.key, checked === true)
                                  }
                                />
                                <span className="min-w-0 flex-1 text-xs">
                                  {field.label}
                                  <code className="block truncate text-[10px] text-muted-foreground">
                                    {field.key}
                                  </code>
                                </span>
                              </label>
                            ))}
                          </section>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold">السجلات المعروضة</p>
                <div className="flex flex-col gap-1">
                  {(
                    [
                      ["all", "كل الأعمال", works.length],
                      ["visible", "النتائج الحالية", visibleWorks.length],
                      ["selected", "الأعمال المحددة", selectedIds.size],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={count === 0}
                      onClick={() => selectScope(value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs",
                        scope === value
                          ? "border-foreground bg-foreground text-background"
                          : "border-transparent bg-background hover:border-border",
                        count === 0 && "opacity-40"
                      )}
                    >
                      {label}
                      <span className="font-mono">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
            <div className="flex min-h-0 flex-col">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
                <Badge variant={jsonValid ? "secondary" : "destructive"}>
                  {jsonValid ? "JSON صالح" : "JSON غير صالح"}
                </Badge>
                {dirty && <Badge variant="outline">مسودة غير محفوظة</Badge>}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {sourceWorks.length} سجل · {selectedFields.length} حقل ·{" "}
                  {json.length.toLocaleString()} حرف
                </span>
                <div className="ml-auto flex min-w-64 items-center gap-1">
                  <Input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && findNext()}
                    placeholder="ابحث في JSON…"
                    className="h-7 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={findNext}
                    aria-label="البحث عن التالي"
                  >
                    <MagnifyingGlassIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => formatJson(false)}
                    aria-label="تنسيق JSON"
                  >
                    <TextAlignLeftIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => formatJson(true)}
                    aria-label="ضغط JSON"
                  >
                    <CodeIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={copyJson}
                    aria-label="نسخ JSON"
                  >
                    <ClipboardTextIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={resetDraft}
                    disabled={!dirty}
                    aria-label="إعادة ضبط المسودة"
                  >
                    <ArrowsClockwiseIcon />
                  </Button>
                </div>
              </div>
              {bundlesQuery.isPending ? (
                <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                  جارٍ تحميل السجلات المنظمة…
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={json}
                  onChange={(event) => {
                    setJson(event.target.value)
                    setDirty(true)
                    setReviewed(null)
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault()
                      review()
                    } else if (event.key === "Tab") {
                      event.preventDefault()
                      const target = event.currentTarget
                      const start = target.selectionStart
                      const end = target.selectionEnd
                      const next = `${json.slice(0, start)}  ${json.slice(end)}`
                      setJson(next)
                      setDirty(true)
                      requestAnimationFrame(() => {
                        target.selectionStart = target.selectionEnd = start + 2
                      })
                    }
                  }}
                  spellCheck={false}
                  dir="ltr"
                  aria-label="JSON للسجلات المعروضة"
                  className="min-h-0 flex-1 resize-none border-0 bg-transparent p-4 text-left font-mono text-xs leading-5 outline-none [unicode-bidi:plaintext]"
                />
              )}
            </div>
          </div>
        )}

        {(error ||
          mutation.error ||
          bundlesQuery.error ||
          bundlesQuery.data?.errors.length) && (
          <div className="shrink-0 border-t bg-destructive/5 px-5 py-2">
            <Alert variant="destructive" className="border-0 bg-transparent">
              <AlertDescription>
                {error ||
                  mutation.error?.message ||
                  bundlesQuery.error?.message || (
                    <span className="flex flex-col gap-1">
                      <strong>
                        تعذر تحميل {bundlesQuery.data?.errors.length} سجل. أصلح
                        هذه السجلات أو أخرجها من النطاق ثم أعد المحاولة:
                      </strong>
                      {bundlesQuery.data?.errors.slice(0, 6).map((item) => (
                        <code key={item.workId}>
                          {item.workId}: {item.message}
                        </code>
                      ))}
                    </span>
                  )}
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
                العودة إلى المحرر
              </Button>
              <Button
                onClick={() => mutation.mutate(changes)}
                disabled={!changes.length || mutation.isPending}
              >
                <FloppyDiskIcon />
                {mutation.isPending
                  ? "جارٍ الحفظ…"
                  : `حفظ ${changes.length} سجل`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                onClick={review}
                disabled={
                  !sourceDocument ||
                  bundlesQuery.isPending ||
                  Boolean(bundlesQuery.data?.errors.length)
                }
              >
                مراجعة التغييرات
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
