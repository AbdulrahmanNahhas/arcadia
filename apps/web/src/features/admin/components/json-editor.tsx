"use client";

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
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminWorkUpdate, Work } from "@/features/library/model";
import { adminWorkTransportSchema, editableWorkStructureSchema } from "@/features/library/model";
import { cn } from "@/lib/utils";
import { getAdminRecordBundles, saveAdminRecordChanges } from "@/server/library.functions";

type JsonScope = "all" | "visible" | "selected";
const TITLE_FIELD_MAP = {
  canonicalTitle: "title",
  titleAr: "arabicTitle",
  aliases: "aliases",
  summary: "summary",
  releaseYear: "year",
  isPrivate: "isPrivate",
  planetId: "planetId",
  genres: "genres",
  tones: "tone",
  tags: "tags",
  countries: "country",
  audience: "audience",
  risks: "riskProfile",
  contentWarnings: "contentWarnings",
  analysisNotes: "analysisNotes",
  externalIdentities: "externalLinks",
  credits: "contributors",
  relationships: "relations",
  posterPath: "imagePath",
  bannerPath: "bannerPath",
  logoPath: "logoPath",
} as const satisfies Record<string, Exclude<keyof AdminWorkUpdate, "id">>;

type TitleJsonField = keyof typeof TITLE_FIELD_MAP;
type TitleProjectionKey = `title.${TitleJsonField}`;
type InstallmentJsonField =
  | "id"
  | "kind"
  | "title"
  | "summary"
  | "status"
  | "position"
  | "releaseDate"
  | "runtimeMinutes"
  | "posterPath"
  | "score";
type EpisodeJsonField = "id" | "title" | "number" | "position" | "releaseDate" | "runtimeMinutes";
type StructureProjectionKey =
  | `structure.installments.${InstallmentJsonField}`
  | `structure.installments.episodes.${EpisodeJsonField}`;
type ProjectionKey = TitleProjectionKey | StructureProjectionKey;
type ProjectionPreset = keyof typeof PROJECTION_PRESETS | "custom";
type ProjectionFieldMetadata = { label: string; group: string };
type ProjectionField = ProjectionFieldMetadata & { key: ProjectionKey };

const TITLE_PROJECTION_FIELDS = {
  canonicalTitle: { label: "العنوان الأصلي", group: "هوية العنوان" },
  titleAr: { label: "العنوان العربي", group: "هوية العنوان" },
  aliases: { label: "العناوين البديلة", group: "الهوية" },
  summary: { label: "الملخص", group: "هوية العنوان" },
  releaseYear: { label: "سنة الإصدار", group: "إعدادات العنوان" },
  isPrivate: { label: "مخفي عن المنصة", group: "إعدادات العنوان" },
  planetId: { label: "الكوكب", group: "إعدادات العنوان" },
  genres: { label: "التصنيفات", group: "التصنيف والإرشادات" },
  tones: { label: "الطابع", group: "التصنيف والإرشادات" },
  tags: { label: "الوسوم", group: "التصنيف والإرشادات" },
  countries: { label: "الدول", group: "التصنيف والإرشادات" },
  audience: { label: "الجمهور الافتراضي", group: "التصنيف والإرشادات" },
  risks: { label: "المخاطر الافتراضية", group: "التصنيف والإرشادات" },
  contentWarnings: { label: "تحذيرات المحتوى", group: "الملاحظات" },
  analysisNotes: { label: "ملاحظات التحليل", group: "الملاحظات" },
  externalIdentities: { label: "المعرّفات والروابط الخارجية", group: "المعرفة المرتبطة" },
  credits: { label: "المساهمون والاستوديوهات", group: "المعرفة المرتبطة" },
  relationships: { label: "علاقات العناوين", group: "المعرفة المرتبطة" },
  posterPath: { label: "الملصق", group: "الصور" },
  bannerPath: { label: "الغلاف", group: "العلاقات والوسائط" },
  logoPath: { label: "الشعار", group: "الصور" },
} satisfies Record<TitleJsonField, ProjectionFieldMetadata>;

const STRUCTURE_PROJECTION_FIELDS: Array<ProjectionField> = [
  { key: "structure.installments.id", label: "معرّف الجزء", group: "الأجزاء" },
  { key: "structure.installments.kind", label: "النوع: موسم، فيلم، خاص", group: "الأجزاء" },
  { key: "structure.installments.title", label: "عنوان الجزء", group: "الأجزاء" },
  { key: "structure.installments.summary", label: "ملخص الجزء", group: "الأجزاء" },
  { key: "structure.installments.status", label: "حالة الإصدار", group: "الأجزاء" },
  { key: "structure.installments.position", label: "ترتيب الجزء", group: "الأجزاء" },
  { key: "structure.installments.releaseDate", label: "تاريخ الإصدار", group: "الأجزاء" },
  { key: "structure.installments.runtimeMinutes", label: "مدة العرض", group: "الأجزاء" },
  { key: "structure.installments.posterPath", label: "ملصق الجزء", group: "الأجزاء" },
  { key: "structure.installments.score", label: "التقييم التحريري", group: "الأجزاء" },
  { key: "structure.installments.episodes.id", label: "معرّف الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.title", label: "عنوان الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.number", label: "رقم الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.position", label: "ترتيب الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.releaseDate", label: "تاريخ الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.runtimeMinutes", label: "مدة الحلقة", group: "الحلقات" },
];

const PROJECTION_FIELDS: readonly ProjectionField[] = [
  ...(
    Object.entries(TITLE_PROJECTION_FIELDS) as Array<[TitleJsonField, ProjectionFieldMetadata]>
  ).map(([field, metadata]) => ({ key: `title.${field}` as TitleProjectionKey, ...metadata })),
  ...STRUCTURE_PROJECTION_FIELDS,
];

const PROJECTION_PRESETS = {
  identity: {
    label: "هوية العنوان",
    fields: ["title.canonicalTitle", "title.titleAr", "title.aliases", "title.summary"],
  },
  essential: {
    label: "الفهرس الأساسي",
    fields: [
      "title.canonicalTitle",
      "title.titleAr",
      "title.releaseYear",
      "title.isPrivate",
      "title.planetId",
      "title.summary",
      "title.genres",
      "title.tags",
      "structure.installments.kind",
      "structure.installments.title",
      "structure.installments.releaseDate",
    ],
  },
  classification: {
    label: "التصنيف",
    fields: ["title.genres", "title.tags", "title.tones", "title.audience", "title.countries"],
  },
  guidance: {
    label: "الإرشادات والتقييمات",
    fields: [
      "title.risks",
      "title.contentWarnings",
      "title.analysisNotes",
      "structure.installments.score",
    ],
  },
  release: {
    label: "الإصدارات والتواريخ",
    fields: [
      "structure.installments.id",
      "structure.installments.kind",
      "structure.installments.title",
      "structure.installments.status",
      "structure.installments.releaseDate",
      "structure.installments.episodes.releaseDate",
    ],
  },
  "installment-dates": {
    label: "تواريخ الأجزاء فقط",
    fields: ["structure.installments.releaseDate"],
  },
  relations: {
    label: "صنّاع العمل والعلاقات",
    fields: ["title.credits", "title.relationships", "title.externalIdentities"],
  },
  artwork: {
    label: "مسارات الصور",
    fields: [
      "title.posterPath",
      "title.bannerPath",
      "title.logoPath",
      "structure.installments.posterPath",
    ],
  },
  structure: {
    label: "كل الأجزاء والحلقات",
    fields: STRUCTURE_PROJECTION_FIELDS.map(({ key }) => key),
  },
  complete: {
    label: "السجل الكامل القابل للتعديل",
    fields: PROJECTION_FIELDS.map(({ key }) => key),
  },
} as const satisfies Record<string, { label: string; fields: readonly ProjectionKey[] }>;

const DEFAULT_PRESET = "complete" as const;

const completeRecordSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z.object({
      work: adminWorkTransportSchema,
      structure: editableWorkStructureSchema,
    }),
  ),
});

type CompleteRecordDocument = z.infer<typeof completeRecordSchema>;
type CompleteRecord = CompleteRecordDocument["records"][number];
type DiffKind = "added" | "removed" | "changed";
type FieldDiff = {
  kind: DiffKind;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown) {
  return value === null || (typeof value !== "object" && value !== undefined);
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function objectPath(path: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function collectValueDiffs(value: unknown, path: string, kind: "added" | "removed"): FieldDiff[] {
  if (Array.isArray(value)) {
    if (!value.length) {
      return [kind === "added" ? { kind, path, newValue: value } : { kind, path, oldValue: value }];
    }
    return value.flatMap((item, index) => collectValueDiffs(item, `${path}[${index}]`, kind));
  }
  if (isObject(value)) {
    const entries = Object.entries(value).filter(([, child]) => child !== undefined);
    if (!entries.length) {
      return [kind === "added" ? { kind, path, newValue: value } : { kind, path, oldValue: value }];
    }
    return entries.flatMap(([key, child]) => collectValueDiffs(child, objectPath(path, key), kind));
  }
  return [kind === "added" ? { kind, path, newValue: value } : { kind, path, oldValue: value }];
}

function findArrayIdentityKey(left: unknown[], right: unknown[]) {
  if (!left.length || !right.length || !left.every(isObject) || !right.every(isObject)) {
    return null;
  }

  const keys = Object.keys(left[0]).filter((key) =>
    [...left, ...right].every((item) => key in item && isPrimitive(item[key])),
  );

  return (
    keys
      .map((key) => {
        const leftValues = left.map((item) => JSON.stringify(item[key]));
        const rightValues = right.map((item) => JSON.stringify(item[key]));
        const rightSet = new Set(rightValues);
        return {
          key,
          overlap: leftValues.filter((value) => rightSet.has(value)).length,
          unique:
            new Set(leftValues).size === leftValues.length &&
            new Set(rightValues).size === rightValues.length,
        };
      })
      .filter(({ overlap, unique }) => overlap > 0 && unique)
      .sort((a, b) => b.overlap - a.overlap || a.key.localeCompare(b.key))[0]?.key ?? null
  );
}

function diffArrays(left: unknown[], right: unknown[], path: string): FieldDiff[] {
  const identityKey = findArrayIdentityKey(left, right);
  if (identityKey) {
    const identity = (item: JsonObject) => JSON.stringify(item[identityKey]);
    const leftByIdentity = new Map(
      left.map((item, index) => [identity(item as JsonObject), { item, index }]),
    );
    const rightByIdentity = new Map(
      right.map((item, index) => [identity(item as JsonObject), { item, index }]),
    );
    const commonLeft = left
      .map((item) => identity(item as JsonObject))
      .filter((value) => rightByIdentity.has(value));
    const commonRight = right
      .map((item) => identity(item as JsonObject))
      .filter((value) => leftByIdentity.has(value));
    const leftPosition = new Map(commonLeft.map((value, index) => [value, index]));
    const rightPosition = new Map(commonRight.map((value, index) => [value, index]));
    const diffs: FieldDiff[] = [];

    for (const [value, previous] of leftByIdentity) {
      const next = rightByIdentity.get(value);
      if (!next) {
        diffs.push(...collectValueDiffs(previous.item, `${path}[${previous.index}]`, "removed"));
        continue;
      }
      const selector = `${path}[${identityKey}=${value}]`;
      diffs.push(...diffValues(previous.item, next.item, selector));
      if (leftPosition.get(value) !== rightPosition.get(value)) {
        diffs.push({
          kind: "changed",
          path: `${selector}.[array position]`,
          oldValue: previous.index,
          newValue: next.index,
        });
      }
    }
    for (const [value, next] of rightByIdentity) {
      if (!leftByIdentity.has(value)) {
        diffs.push(...collectValueDiffs(next.item, `${path}[${next.index}]`, "added"));
      }
    }
    return diffs;
  }

  if (left.length === right.length) {
    return left.flatMap((value, index) => diffValues(value, right[index], `${path}[${index}]`));
  }

  const matches = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex--) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex--) {
      matches[leftIndex][rightIndex] = valuesEqual(left[leftIndex], right[rightIndex])
        ? matches[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(matches[leftIndex + 1][rightIndex], matches[leftIndex][rightIndex + 1]);
    }
  }

  const diffs: FieldDiff[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length || rightIndex < right.length) {
    if (
      leftIndex < left.length &&
      rightIndex < right.length &&
      valuesEqual(left[leftIndex], right[rightIndex])
    ) {
      leftIndex++;
      rightIndex++;
    } else if (
      rightIndex < right.length &&
      (leftIndex === left.length ||
        matches[leftIndex][rightIndex + 1] >= matches[leftIndex + 1][rightIndex])
    ) {
      diffs.push(...collectValueDiffs(right[rightIndex], `${path}[${rightIndex}]`, "added"));
      rightIndex++;
    } else {
      diffs.push(...collectValueDiffs(left[leftIndex], `${path}[${leftIndex}]`, "removed"));
      leftIndex++;
    }
  }
  return diffs;
}

function diffValues(left: unknown, right: unknown, path: string): FieldDiff[] {
  if (valuesEqual(left, right)) return [];

  if (Array.isArray(left) && Array.isArray(right)) {
    return diffArrays(left, right, path);
  }
  if (isObject(left) && isObject(right)) {
    const keys = new Set([
      ...Object.keys(left).filter((key) => left[key] !== undefined),
      ...Object.keys(right).filter((key) => right[key] !== undefined),
    ]);
    return [...keys].flatMap((key) => {
      const hasLeft = key in left && left[key] !== undefined;
      const hasRight = key in right && right[key] !== undefined;
      const childPath = objectPath(path, key);
      if (!hasLeft) return collectValueDiffs(right[key], childPath, "added");
      if (!hasRight) return collectValueDiffs(left[key], childPath, "removed");
      return diffValues(left[key], right[key], childPath);
    });
  }
  if (isObject(left) || Array.isArray(left) || isObject(right) || Array.isArray(right)) {
    return [
      ...collectValueDiffs(left, path, "removed"),
      ...collectValueDiffs(right, path, "added"),
    ];
  }
  return [{ kind: "changed", path, oldValue: left, newValue: right }];
}

function formatDiffValue(value: unknown, present: boolean) {
  if (!present) return "غير موجود";
  if (value === undefined) return "undefined";
  return JSON.stringify(value, null, 2);
}

export function toEditableWork(work: Work): AdminWorkUpdate {
  const {
    addedAt: _addedAt,
    catalogUpdatedAt: _catalogUpdatedAt,
    personalUpdatedAt: _personalUpdatedAt,
    palette: _palette,
    relations,
    ...editable
  } = work;
  return adminWorkTransportSchema.parse({
    ...editable,
    relations: relations.map(
      ({ id, workId, relationType, direction, notes, provenance, externalKey }) => ({
        id,
        workId,
        relationType,
        direction,
        notes,
        provenance,
        externalKey,
      }),
    ),
  });
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

const installmentPrefix = "structure.installments.";
const episodePrefix = "structure.installments.episodes.";

function selectedTitleFields(fields: readonly ProjectionKey[]) {
  return fields
    .filter((field): field is TitleProjectionKey => field.startsWith("title."))
    .map((field) => field.slice("title.".length) as TitleJsonField);
}

function selectedInstallmentFields(fields: readonly ProjectionKey[]) {
  return fields
    .filter(
      (field): field is `structure.installments.${InstallmentJsonField}` =>
        field.startsWith(installmentPrefix) && !field.startsWith(episodePrefix),
    )
    .map((field) => field.slice(installmentPrefix.length) as InstallmentJsonField);
}

function selectedEpisodeFields(fields: readonly ProjectionKey[]) {
  return fields
    .filter((field): field is `structure.installments.episodes.${EpisodeJsonField}` =>
      field.startsWith(episodePrefix),
    )
    .map((field) => field.slice(episodePrefix.length) as EpisodeJsonField);
}

function dateString(timestamp: number | null | undefined) {
  return timestamp == null ? null : new Date(timestamp).toISOString().slice(0, 10);
}

function dateTimestamp(value: unknown, path: string) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} must be a YYYY-MM-DD date or null.`);
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`${path} is not a valid calendar date.`);
  }
  return timestamp;
}

function projectedEpisode(
  episode: CompleteRecord["structure"]["seasons"][number]["units"][number],
  fields: EpisodeJsonField[],
) {
  const output: JsonObject = {};
  for (const field of fields) {
    if (field === "number") output.number = episode.unitNumber;
    else if (field === "releaseDate") output.releaseDate = dateString(episode.releaseAt);
    else output[field] = (episode as unknown as JsonObject)[field];
  }
  return output;
}

function projectedTitleValue(work: CompleteRecord["work"], field: TitleJsonField) {
  if (field === "externalIdentities") {
    return work.externalLinks.map((identity) => ({
      provider: identity.provider,
      externalId: identity.label,
      url: identity.url,
    }));
  }
  if (field === "credits") {
    return work.contributors.map((credit) => ({
      entityId: credit.entityId,
      name: credit.name,
      entityType: credit.entityType,
      role: credit.role,
      isPrimary: credit.isPrimary,
    }));
  }
  if (field === "relationships") {
    return work.relations.map((relationship) => ({
      targetTitleId: relationship.workId,
      kind: relationship.relationType,
      direction: relationship.direction,
      notes: relationship.notes,
    }));
  }
  return (work as unknown as JsonObject)[TITLE_FIELD_MAP[field]];
}

function editableTitleValue(field: TitleJsonField, value: unknown) {
  if (field === "externalIdentities") {
    if (!Array.isArray(value)) throw new Error("title.externalIdentities must be an array.");
    return value.map((identity, index) => {
      if (!isObject(identity)) {
        throw new Error(`title.externalIdentities.${index} must be an object.`);
      }
      return {
        provider: identity.provider,
        label: identity.externalId,
        url: identity.url,
      };
    });
  }
  if (field === "credits") {
    if (!Array.isArray(value)) throw new Error("title.credits must be an array.");
    return value.map((credit, index) => {
      if (!isObject(credit)) throw new Error(`title.credits.${index} must be an object.`);
      return {
        entityId: credit.entityId,
        name: credit.name,
        entityType: credit.entityType,
        role: credit.role,
        isPrimary: credit.isPrimary ?? false,
      };
    });
  }
  if (field === "relationships") {
    if (!Array.isArray(value)) throw new Error("title.relationships must be an array.");
    return value.map((relationship, index) => {
      if (!isObject(relationship)) {
        throw new Error(`title.relationships.${index} must be an object.`);
      }
      return {
        workId: relationship.targetTitleId,
        relationType: relationship.kind,
        direction: relationship.direction,
        notes: relationship.notes ?? "",
        provenance: "manual",
        externalKey: null,
      };
    });
  }
  return value;
}

function projectedInstallment(
  installment: CompleteRecord["structure"]["seasons"][number],
  fields: InstallmentJsonField[],
  episodeFields: EpisodeJsonField[],
) {
  const output: JsonObject = {};
  for (const field of fields) {
    if (field === "kind") output.kind = installment.installmentKind;
    else if (field === "status") output.status = installment.releaseStatus;
    else if (field === "releaseDate") output.releaseDate = dateString(installment.releaseAt);
    else if (field === "score") output.score = installment.score ?? null;
    else output[field] = (installment as unknown as JsonObject)[field];
  }
  if (episodeFields.length) {
    output.episodes = installment.units.map((episode) => projectedEpisode(episode, episodeFields));
  }
  return output;
}

function projectDocument(
  document: CompleteRecordDocument,
  fields: readonly ProjectionKey[],
  preset: ProjectionPreset,
) {
  const titleFields = selectedTitleFields(fields);
  const installmentFields = selectedInstallmentFields(fields);
  const episodeFields = selectedEpisodeFields(fields);
  const includeStructure = installmentFields.length > 0 || episodeFields.length > 0;
  return {
    schemaVersion: 3,
    projection: { preset, fields },
    records: document.records.map((record) => {
      const projectedTitle: JsonObject = {};
      for (const field of titleFields) {
        projectedTitle[field] = projectedTitleValue(record.work, field);
      }
      return {
        id: record.work.id,
        ...(titleFields.length ? { title: projectedTitle } : {}),
        ...(includeStructure
          ? {
              structure: {
                installments: record.structure.seasons.map((installment) =>
                  projectedInstallment(installment, installmentFields, episodeFields),
                ),
              },
            }
          : {}),
      };
    }),
  };
}

function mergeEpisodeProjection(
  value: unknown,
  original: CompleteRecord["structure"]["seasons"][number]["units"][number] | undefined,
  fields: EpisodeJsonField[],
  path: string,
) {
  if (!isObject(value)) throw new Error(`${path} must be an object.`);
  const allowed = new Set(fields);
  const unknown = Object.keys(value).find((key) => !allowed.has(key as EpisodeJsonField));
  if (unknown) throw new Error(`${path}.${unknown} is hidden in this projection.`);
  for (const field of fields) {
    if (!(field in value) && !(field === "id" && !original)) {
      throw new Error(`${path}.${field} is selected and cannot be omitted.`);
    }
  }
  const merged = {
    id: original?.id,
    unitType: "episode" as const,
    title: original?.title ?? null,
    unitNumber: original?.unitNumber ?? null,
    position: original?.position ?? 0,
    runtimeMinutes: original?.runtimeMinutes ?? null,
    releaseAt: original?.releaseAt ?? null,
  };
  for (const field of fields) {
    if (field === "number") merged.unitNumber = value.number as number | null;
    else if (field === "releaseDate")
      merged.releaseAt = dateTimestamp(value.releaseDate, `${path}.releaseDate`);
    else if (field in value) (merged as unknown as JsonObject)[field] = value[field];
  }
  return merged;
}

function mergeStructureProjection(
  value: unknown,
  original: CompleteRecord["structure"],
  installmentFields: InstallmentJsonField[],
  episodeFields: EpisodeJsonField[],
  recordId: string,
) {
  if (!isObject(value) || !Array.isArray(value.installments)) {
    throw new Error(`${recordId}: structure.installments must be an array.`);
  }
  const unknownStructureKey = Object.keys(value).find((key) => key !== "installments");
  if (unknownStructureKey) {
    throw new Error(`${recordId}: structure.${unknownStructureKey} is hidden in this projection.`);
  }
  if (
    value.installments.length !== original.seasons.length &&
    !["id", "kind", "title", "position"].every((field) =>
      installmentFields.includes(field as InstallmentJsonField),
    )
  ) {
    throw new Error(
      `${recordId}: select installment id, kind, title, and position before adding or removing installments.`,
    );
  }
  const originalById = new Map(original.seasons.map((season) => [season.id, season]));
  const seasons = value.installments.map((rawInstallment, index) => {
    if (!isObject(rawInstallment)) {
      throw new Error(`${recordId}: structure.installments.${index} must be an object.`);
    }
    const originalInstallment =
      typeof rawInstallment.id === "string"
        ? originalById.get(rawInstallment.id)
        : original.seasons[index];
    const allowed = new Set<string>([
      ...installmentFields,
      ...(episodeFields.length ? ["episodes"] : []),
    ]);
    const unknown = Object.keys(rawInstallment).find((key) => !allowed.has(key));
    if (unknown) {
      throw new Error(
        `${recordId}: structure.installments.${index}.${unknown} is hidden in this projection.`,
      );
    }
    for (const field of installmentFields) {
      if (!(field in rawInstallment) && !(field === "id" && !originalInstallment)) {
        throw new Error(
          `${recordId}: structure.installments.${index}.${field} is selected and cannot be omitted.`,
        );
      }
    }
    const merged = {
      id: originalInstallment?.id,
      title: originalInstallment?.title ?? "",
      installmentKind: originalInstallment?.installmentKind ?? ("season" as const),
      summary: originalInstallment?.summary ?? "",
      releaseStatus: originalInstallment?.releaseStatus ?? ("unknown" as const),
      posterPath: originalInstallment?.posterPath ?? null,
      score: originalInstallment?.score,
      seasonNumber: originalInstallment?.seasonNumber ?? null,
      position: originalInstallment?.position ?? index,
      runtimeMinutes: originalInstallment?.runtimeMinutes ?? null,
      unitCount: originalInstallment?.unitCount ?? 0,
      releaseAt: originalInstallment?.releaseAt ?? null,
      units: originalInstallment?.units ?? [],
    };
    for (const field of installmentFields) {
      if (field === "kind")
        merged.installmentKind = rawInstallment.kind as typeof merged.installmentKind;
      else if (field === "status")
        merged.releaseStatus = rawInstallment.status as typeof merged.releaseStatus;
      else if (field === "score")
        merged.score = (rawInstallment.score ?? undefined) as typeof merged.score;
      else if (field === "releaseDate") {
        merged.releaseAt = dateTimestamp(
          rawInstallment.releaseDate,
          `${recordId}.structure.installments.${index}.releaseDate`,
        );
      } else if (field in rawInstallment) {
        (merged as unknown as JsonObject)[field] = rawInstallment[field];
      }
    }
    if (episodeFields.length) {
      if (!Array.isArray(rawInstallment.episodes)) {
        throw new Error(`${recordId}: structure.installments.${index}.episodes must be an array.`);
      }
      if (
        rawInstallment.episodes.length !== (originalInstallment?.units.length ?? 0) &&
        !["id", "number", "position"].every((field) =>
          episodeFields.includes(field as EpisodeJsonField),
        )
      ) {
        throw new Error(
          `${recordId}: select episode id, number, and position before adding or removing episodes.`,
        );
      }
      const originalEpisodesById = new Map(
        (originalInstallment?.units ?? []).map((episode) => [episode.id, episode]),
      );
      merged.units = rawInstallment.episodes.map((episode, episodeIndex) =>
        mergeEpisodeProjection(
          episode,
          isObject(episode) && typeof episode.id === "string"
            ? originalEpisodesById.get(episode.id)
            : originalInstallment?.units[episodeIndex],
          episodeFields,
          `${recordId}.structure.installments.${index}.episodes.${episodeIndex}`,
        ),
      );
      merged.unitCount = merged.units.length;
    }
    merged.seasonNumber = merged.installmentKind === "season" ? merged.position : null;
    return merged;
  });
  return editableWorkStructureSchema.parse({
    workId: original.workId,
    seasons,
    ungroupedUnits: [],
  });
}

function parseProjectedDocument(
  text: string,
  base: CompleteRecordDocument,
  fields: readonly ProjectionKey[],
  preset: ProjectionPreset,
): CompleteRecordDocument {
  const raw: unknown = JSON.parse(text);
  if (!isObject(raw)) throw new Error("يجب أن يكون المستند كائن JSON.");
  if (raw.schemaVersion !== 3) throw new Error("schemaVersion must be 3.");
  if (!isObject(raw.projection)) throw new Error("projection is required.");
  if (raw.projection.preset !== preset) {
    throw new Error("قالب العرض مقفل. غيّره من عناصر تحكم المحرر.");
  }
  if (
    !Array.isArray(raw.projection.fields) ||
    !raw.projection.fields.every((field) => typeof field === "string") ||
    !sameStringSet(raw.projection.fields, fields)
  ) {
    throw new Error("قائمة حقول العرض مقفلة. استخدم عنصر تحكم الحقول.");
  }
  if (!Array.isArray(raw.records)) throw new Error("records must be an array.");

  const originals = new Map(base.records.map((record) => [record.work.id, record]));
  const receivedIds: string[] = [];
  const titleFields = selectedTitleFields(fields);
  const installmentFields = selectedInstallmentFields(fields);
  const episodeFields = selectedEpisodeFields(fields);
  const includeStructure = installmentFields.length > 0 || episodeFields.length > 0;

  const records = raw.records.map((value, index) => {
    if (!isObject(value)) throw new Error(`records.${index} must be an object.`);
    const allowedRecordKeys = new Set([
      "id",
      ...(titleFields.length ? ["title"] : []),
      ...(includeStructure ? ["structure"] : []),
    ]);
    const unknownRecordKey = Object.keys(value).find((key) => !allowedRecordKeys.has(key));
    if (unknownRecordKey) {
      throw new Error(`records.${index}.${unknownRecordKey} is not part of this projection.`);
    }
    if (typeof value.id !== "string") throw new Error(`records.${index}.id is required.`);
    const original = originals.get(value.id);
    if (!original) throw new Error(`Unknown or out-of-scope work ID: ${value.id}`);
    receivedIds.push(value.id);
    const projectedTitle = titleFields.length
      ? (() => {
          const rawTitle = value.title;
          if (!isObject(rawTitle)) throw new Error(`${value.id}: title is required.`);
          const allowedTitleFields = new Set(titleFields);
          const unknown = Object.keys(rawTitle).find(
            (key) => !allowedTitleFields.has(key as TitleJsonField),
          );
          if (unknown)
            throw new Error(`${value.id}: title.${unknown} is hidden in this projection.`);
          const missing = titleFields.find((field) => !(field in rawTitle));
          if (missing) throw new Error(`${value.id}: selected field title.${missing} is missing.`);
          return rawTitle;
        })()
      : {};
    const mergedWorkInput: JsonObject = { ...(original.work as unknown as JsonObject) };
    for (const field of titleFields) {
      mergedWorkInput[TITLE_FIELD_MAP[field]] = editableTitleValue(field, projectedTitle[field]);
    }
    const mergedWork = adminWorkTransportSchema.parse({
      ...mergedWorkInput,
      id: original.work.id,
    });
    const structure = includeStructure
      ? mergeStructureProjection(
          value.structure,
          original.structure,
          installmentFields,
          episodeFields,
          value.id,
        )
      : original.structure;
    return { ...original, work: mergedWork, structure };
  });

  if (new Set(receivedIds).size !== receivedIds.length) {
    throw new Error("يجب ألا يتكرر معرّف العمل ضمن المستند.");
  }
  const editedById = new Map(records.map((record) => [record.work.id, record]));
  return {
    schemaVersion: 1,
    records: base.records.map((record) => editedById.get(record.work.id) ?? record),
  };
}

export function JsonEditorDialog({
  open,
  onOpenChange,
  works,
  visibleWorks,
  selectedIds,
  onSaved,
  initialScope = "all",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  works: Work[];
  visibleWorks: Work[];
  selectedIds: Set<string>;
  onSaved: () => Promise<void>;
  initialScope?: JsonScope;
}) {
  const [scope, setScope] = useState<JsonScope>(initialScope);
  const [json, setJson] = useState("");
  const [reviewed, setReviewed] = useState<CompleteRecordDocument | null>(null);
  const [reviewSource, setReviewSource] = useState<CompleteRecordDocument | null>(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<ProjectionPreset>(DEFAULT_PRESET);
  const [selectedFields, setSelectedFields] = useState<ProjectionKey[]>(() => [
    ...PROJECTION_PRESETS[DEFAULT_PRESET].fields,
  ]);
  const [draftBase, setDraftBase] = useState<CompleteRecordDocument | null>(null);
  const [dirty, setDirty] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceWorks =
    scope === "visible"
      ? visibleWorks
      : scope === "selected"
        ? works.filter(({ id }) => selectedIds.has(id))
        : works;
  const sourceIds = sourceWorks.map(({ id }) => id);
  const bundlesQuery = useQuery({
    queryKey: ["admin-record-bundles", sourceIds],
    queryFn: () => getAdminRecordBundles({ data: { workIds: sourceIds } }),
    enabled: open && sourceIds.length > 0,
  });
  const sourceDocument = useMemo<CompleteRecordDocument | null>(() => {
    if (!bundlesQuery.data) return null;
    return {
      schemaVersion: 1,
      records: bundlesQuery.data.bundles.map((bundle) => ({
        work: toEditableWork(bundle.work),
        structure: bundle.structure,
      })),
    };
  }, [bundlesQuery.data]);

  useEffect(() => {
    if (!open || !sourceDocument || dirty || reviewed) return;
    setDraftBase(sourceDocument);
    setJson(JSON.stringify(projectDocument(sourceDocument, selectedFields, preset), null, 2));
    setError("");
  }, [open, sourceDocument, dirty, reviewed, selectedFields, preset]);

  const changes = useMemo(() => {
    if (!reviewed || !sourceDocument) return [];
    const originals = new Map(sourceDocument.records.map((record) => [record.work.id, record]));
    return reviewed.records.flatMap((record) => {
      const original = originals.get(record.work.id);
      if (!original) return [];
      const workChanged = JSON.stringify(original.work) !== JSON.stringify(record.work);
      const structureChanged =
        JSON.stringify(original.structure) !== JSON.stringify(record.structure);
      const fieldDiffs = [
        ...(workChanged ? diffValues(original.work, record.work, "work") : []),
        ...(structureChanged ? diffValues(original.structure, record.structure, "structure") : []),
      ];
      return workChanged || structureChanged
        ? [{ record, workChanged, structureChanged, fieldDiffs }]
        : [];
    });
  }, [reviewed, sourceDocument]);

  const review = async () => {
    try {
      if (!draftBase || !sourceDocument) {
        setError("لم تُحمّل السجلات المصدرية بعد.");
        return;
      }
      const merged = parseProjectedDocument(json, draftBase, selectedFields, preset);
      const refreshed = await bundlesQuery.refetch();
      if (!refreshed.data) {
        throw new Error("تعذر تحديث أحدث سجلات قاعدة البيانات.");
      }
      if (refreshed.data.errors.length) {
        throw new Error(
          `تعذر تحميل ${refreshed.data.errors.length} سجل. أصلح السجلات الموضحة أدناه ثم أعد المحاولة.`,
        );
      }
      const latestDocument: CompleteRecordDocument = {
        schemaVersion: 1,
        records: refreshed.data.bundles.map((bundle) => ({
          work: toEditableWork(bundle.work),
          structure: bundle.structure,
        })),
      };
      const latestById = new Map(latestDocument.records.map((record) => [record.work.id, record]));
      for (const record of merged.records) {
        const opening = draftBase.records.find((candidate) => candidate.work.id === record.work.id);
        const latest = latestById.get(record.work.id);
        if (!opening || !latest) {
          throw new Error(`${record.work.id}: the source record no longer exists.`);
        }
        for (const field of selectedFields.filter((candidate) => candidate.startsWith("title."))) {
          const jsonField = field.slice("title.".length) as TitleJsonField;
          const workField = TITLE_FIELD_MAP[jsonField];
          const openingValue = (opening.work as unknown as JsonObject)[workField];
          const latestValue = (latest.work as unknown as JsonObject)[workField];
          const draftValue = (record.work as unknown as JsonObject)[workField];
          if (
            !valuesEqual(openingValue, latestValue) &&
            !valuesEqual(openingValue, draftValue) &&
            !valuesEqual(latestValue, draftValue)
          ) {
            throw new Error(
              `${record.work.id}: ${field} changed elsewhere while you were editing. Reset the draft and reapply your change.`,
            );
          }
          if (valuesEqual(openingValue, draftValue)) {
            (record.work as unknown as JsonObject)[workField] = latestValue;
          }
        }
        const structureSelected = selectedFields.some((field) => field.startsWith("structure."));
        if (structureSelected && !valuesEqual(opening.structure, latest.structure)) {
          if (!valuesEqual(opening.structure, record.structure)) {
            throw new Error(
              `${record.work.id}: structure changed elsewhere while you were editing. Reset the draft and reapply your change.`,
            );
          }
          record.structure = latest.structure;
        }
        const latestWork = latest.work as unknown as JsonObject;
        const draftWork = record.work as unknown as JsonObject;
        const safelyMergedWork: JsonObject = { ...latestWork };
        for (const field of selectedFields) {
          if (field.startsWith("title.")) {
            const workField = TITLE_FIELD_MAP[field.slice("title.".length) as TitleJsonField];
            safelyMergedWork[workField] = draftWork[workField];
          }
        }
        record.work = adminWorkTransportSchema.parse(safelyMergedWork);
        if (!structureSelected) {
          record.structure = latest.structure;
        }
      }
      setError("");
      setReviewSource(latestDocument);
      setReviewed(completeRecordSchema.parse(merged));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح");
    }
  };

  const mutation = useMutation({
    mutationFn: async (
      updates: Array<{
        record: CompleteRecord;
        workChanged: boolean;
        structureChanged: boolean;
      }>,
    ) => {
      if (!reviewSource) throw new Error("راجع المسودة الحالية قبل الحفظ.");
      const latestResult = await getAdminRecordBundles({
        data: { workIds: sourceIds },
      });
      if (latestResult.errors.length) {
        throw new Error(`تعذر التحقق من ${latestResult.errors.length} سجل قبل الحفظ.`);
      }
      const latestDocument: CompleteRecordDocument = {
        schemaVersion: 1,
        records: latestResult.bundles.map((bundle) => ({
          work: toEditableWork(bundle.work),
          structure: bundle.structure,
        })),
      };
      if (!valuesEqual(latestDocument, reviewSource)) {
        throw new Error("تغيرت قاعدة البيانات بعد المراجعة. عُد إلى المحرر وراجع مجدداً قبل الحفظ.");
      }
      const result = await saveAdminRecordChanges({
        data: {
          changes: updates.map((update) => ({
            workId: update.record.work.id,
            ...(update.workChanged ? { work: update.record.work } : {}),
            ...(update.structureChanged ? { structure: update.record.structure } : {}),
          })),
        },
      });
      if (result.errors.length) {
        throw new Error(
          result.errors.map(({ workId, message }) => `${workId}: ${message}`).join("\n"),
        );
      }
    },
    onSuccess: async () => {
      setDirty(false);
      await onSaved();
      onOpenChange(false);
    },
  });

  const jsonValid = useMemo(() => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }, [json]);

  const applyProjection = (nextFields: ProjectionKey[], nextPreset: ProjectionPreset) => {
    try {
      if (!draftBase) return;
      const merged = dirty
        ? parseProjectedDocument(json, draftBase, selectedFields, preset)
        : draftBase;
      setDraftBase(merged);
      setSelectedFields(nextFields);
      setPreset(nextPreset);
      setJson(JSON.stringify(projectDocument(merged, nextFields, nextPreset), null, 2));
      setDirty(
        Boolean(sourceDocument) && JSON.stringify(merged) !== JSON.stringify(sourceDocument),
      );
      setReviewed(null);
      setError("");
    } catch (caught) {
      setError(
        `${caught instanceof Error ? caught.message : "JSON غير صالح"} أصلح المسودة قبل تغيير عرضها.`,
      );
    }
  };

  const choosePreset = (value: string | null) => {
    if (!value || !(value in PROJECTION_PRESETS)) return;
    const nextPreset = value as keyof typeof PROJECTION_PRESETS;
    applyProjection([...PROJECTION_PRESETS[nextPreset].fields], nextPreset);
  };

  const toggleField = (field: ProjectionKey, checked: boolean) => {
    const nextFields = checked
      ? [...new Set([...selectedFields, field])]
      : selectedFields.filter((candidate) => candidate !== field);
    if (!nextFields.length) {
      setError("اختر حقلاً واحداً قابلاً للتعديل على الأقل.");
      return;
    }
    applyProjection(nextFields, "custom");
  };

  const resetDraft = () => {
    if (!sourceDocument) return;
    setDraftBase(sourceDocument);
    setJson(JSON.stringify(projectDocument(sourceDocument, selectedFields, preset), null, 2));
    setDirty(false);
    setReviewed(null);
    setError("");
  };

  const formatJson = (compact = false) => {
    try {
      setJson(JSON.stringify(JSON.parse(json), null, compact ? 0 : 2));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON غير صالح");
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      setError("تعذر نسخ JSON إلى الحافظة.");
    }
  };

  const findNext = () => {
    const textarea = textareaRef.current;
    if (!textarea || !documentSearch) return;
    const start = textarea.selectionEnd;
    const match = json.toLocaleLowerCase().indexOf(documentSearch.toLocaleLowerCase(), start);
    const index =
      match >= 0 ? match : json.toLocaleLowerCase().indexOf(documentSearch.toLocaleLowerCase());
    if (index < 0) {
      setError(`No match for “${documentSearch}”.`);
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(index, index + documentSearch.length);
    setError("");
  };

  const selectScope = (nextScope: JsonScope) => {
    if (dirty) {
      setError("أعد ضبط المسودة الحالية أو احفظها قبل تغيير نطاق السجلات.");
      return;
    }
    setScope(nextScope);
    setDraftBase(null);
    setReviewed(null);
    setError("");
  };

  const visibleChanges = changes.filter(
    (change) =>
      !reviewSearch ||
      change.record.work.id.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase()) ||
      change.record.work.title.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase()) ||
      change.fieldDiffs.some((diff) =>
        diff.path.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase()),
      ),
  );

  const groupedFields = PROJECTION_FIELDS.reduce(
    (groups, field) => {
      const group = groups[field.group] ?? [];
      groups[field.group] = group;
      group.push(field);
      return groups;
    },
    {} as Record<string, Array<(typeof PROJECTION_FIELDS)[number]>>,
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setScope(initialScope);
    if (!nextOpen && dirty && !reviewed) {
      setError("تحتوي المسودة على تغييرات غير محفوظة. أعد ضبطها أو راجعها واحفظها قبل الإغلاق.");
      return;
    }
    onOpenChange(nextOpen);
  };

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
                عدّل الحقول التي تحتاجها فقط. تبقى القيم المخفية محفوظة، وتظهر التواريخ بصيغة
                YYYY-MM-DD، وتبقى المعرّفات مقفلة أثناء الدمج الآمن.
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
                <strong className="block text-sm">تغيّر {changes.length} سجل</strong>
                <span className="text-xs text-muted-foreground">
                  {changes.reduce((total, change) => total + change.fieldDiffs.length, 0)} تغييراً
                  دقيقاً في الحقول جاهزاً للحفظ.
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
                {visibleChanges.map(({ record, workChanged, structureChanged, fieldDiffs }) => {
                  const headingId = `json-review-${record.work.id}`;
                  return (
                    <section
                      key={record.work.id}
                      aria-labelledby={headingId}
                      className="overflow-hidden rounded-lg border bg-card"
                    >
                      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                        <div>
                          <h3 id={headingId} className="text-sm font-semibold">
                            {record.work.arabicTitle || record.work.title}
                          </h3>
                          <code className="mt-1 block text-[10px] text-muted-foreground">
                            {record.work.id}
                          </code>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Badge variant="outline">{fieldDiffs.length} حقل</Badge>
                          {workChanged && <Badge>بيانات العنوان</Badge>}
                          {structureChanged && <Badge variant="secondary">البنية</Badge>}
                        </div>
                      </header>
                      <dl className="divide-y">
                        {fieldDiffs.map((diff) => {
                          const hasOldValue = diff.kind !== "added";
                          const hasNewValue = diff.kind !== "removed";
                          return (
                            <div
                              key={`${diff.kind}-${diff.path}`}
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
                                  {formatDiffValue(diff.oldValue, hasOldValue)}
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
                                  {formatDiffValue(diff.newValue, hasNewValue)}
                                </pre>
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-lg border border-dashed p-12 text-center">
                <CheckIcon className="mb-3 size-8 text-primary" />
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
                  items={Object.entries(PROJECTION_PRESETS).map(([value, definition]) => ({
                    value,
                    label: definition.label,
                  }))}
                  value={preset}
                  onValueChange={choosePreset}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(PROJECTION_PRESETS).map(([value, definition]) => (
                        <SelectItem key={value} value={value}>
                          {definition.label}
                        </SelectItem>
                      ))}
                      {preset === "custom" && <SelectItem value="custom">اختيار مخصص</SelectItem>}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger
                    render={<Button variant="outline" className="w-full justify-between" />}
                  >
                    <span className="flex items-center gap-2">
                      <FunnelIcon data-icon="inline-start" />
                      الحقول
                    </span>
                    <Badge variant="secondary">{selectedFields.length}</Badge>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-96 p-0">
                    <PopoverHeader className="border-b p-4">
                      <PopoverTitle>الحقول الظاهرة القابلة للتعديل</PopoverTitle>
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
                            .includes(fieldSearch.toLocaleLowerCase()),
                        );
                        if (!matchingFields.length) return null;
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
                                    "custom",
                                  )
                                }
                              >
                                تحديد المجموعة
                              </Button>
                            </div>
                            {matchingFields.map((field) => (
                              <label
                                key={field.key}
                                htmlFor={`projection-${field.key}`}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                              >
                                <Checkbox
                                  id={`projection-${field.key}`}
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
                        );
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
                        count === 0 && "opacity-40",
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
                  <Button variant="ghost" size="icon-xs" onClick={copyJson} aria-label="نسخ JSON">
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
                    setJson(event.target.value);
                    setDirty(true);
                    setReviewed(null);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      review();
                    } else if (event.key === "Tab") {
                      event.preventDefault();
                      const target = event.currentTarget;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const next = `${json.slice(0, start)}  ${json.slice(end)}`;
                      setJson(next);
                      setDirty(true);
                      requestAnimationFrame(() => {
                        target.selectionStart = target.selectionEnd = start + 2;
                      });
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

        {(error || mutation.error || bundlesQuery.error || bundlesQuery.data?.errors.length) && (
          <div className="shrink-0 border-t bg-destructive/5 px-5 py-2">
            <Alert variant="destructive" className="border-0 bg-transparent">
              <AlertDescription>
                {error || mutation.error?.message || bundlesQuery.error?.message || (
                  <span className="flex flex-col gap-1">
                    <strong>
                      تعذر تحميل {bundlesQuery.data?.errors.length} سجل. أصلح هذه السجلات أو أخرجها
                      من النطاق ثم أعد المحاولة:
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
                {mutation.isPending ? "جارٍ الحفظ…" : `حفظ ${changes.length} سجل`}
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
  );
}
