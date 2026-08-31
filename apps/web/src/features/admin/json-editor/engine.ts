import type { AdminAwardRecognitionInput, AwardOrganizationOption } from "@arcadia/contracts";
import { z } from "zod";
import type { AdminWorkUpdate, Work } from "@/features/library/model";
import { adminWorkTransportSchema, editableWorkStructureSchema } from "@/features/library/model";

/**
 * The JSON editor's projection/diff/merge engine — moved out of the old modal
 * (`components/json-editor.tsx`) largely unchanged (it was sound), extended with:
 * - the title fields Stage 2 added (`age`/`workflowStatus`/`qualityScore`/`curatorNotes`/
 *   `verifiedAt`), replacing the retired `curation` two-state proxy;
 * - a new `awards` top-level projection (title-level `awards` was removed from
 *   `AdminWorkUpdate` entirely in Stage 2 — award recognitions are a parallel, id-based
 *   normalized resource now, not a plain field on the title, so they need their own merge path
 *   rather than flowing through `TITLE_FIELD_MAP`).
 */

export type JsonScope = "ids" | "all";

/** Maps a projection JSON field name (e.g. `canonicalTitle`) to its `AdminWorkUpdate` key
 *  (e.g. `title`) — exported so callers reconciling a projected title field against the live
 *  `CompleteRecord["work"]` (which uses `AdminWorkUpdate` key names) can look up the right key. */
export const TITLE_FIELD_MAP = {
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
  age: "age",
  risks: "riskProfile",
  contentWarnings: "contentWarnings",
  analysisNotes: "analysisNotes",
  workflowStatus: "workflowStatus",
  qualityScore: "qualityScore",
  curatorNotes: "curatorNotes",
  verifiedAt: "verifiedAt",
  externalIdentities: "externalLinks",
  credits: "contributors",
  relationships: "relations",
  posterPath: "imagePath",
  bannerPath: "bannerPath",
  logoPath: "logoPath",
  tmdbId: "tmdbId",
  imdbId: "imdbId",
  tvdbId: "tvdbId",
  anilistId: "anilistId",
  malId: "malId",
} as const satisfies Record<string, Exclude<keyof AdminWorkUpdate, "id">>;

export type TitleJsonField = keyof typeof TITLE_FIELD_MAP;
export type TitleProjectionKey = `title.${TitleJsonField}`;
export type InstallmentJsonField =
  | "id"
  | "kind"
  | "title"
  | "summary"
  | "status"
  | "position"
  | "releaseDate"
  | "runtimeMinutes"
  | "posterPath"
  | "score"
  | "tmdbId"
  | "imdbId"
  | "tvdbId"
  | "anilistId"
  | "malId";
export type EpisodeJsonField =
  | "id"
  | "title"
  | "summary"
  | "number"
  | "position"
  | "releaseDate"
  | "runtimeMinutes";
export type StructureProjectionKey =
  | `structure.installments.${InstallmentJsonField}`
  | `structure.installments.episodes.${EpisodeJsonField}`;
export type ProjectionKey = TitleProjectionKey | StructureProjectionKey | "awards";
export type ProjectionPreset = keyof typeof PROJECTION_PRESETS | "custom";
export type ProjectionFieldMetadata = { label: string; group: string };
export type ProjectionField = ProjectionFieldMetadata & { key: ProjectionKey };

export const TITLE_PROJECTION_FIELDS = {
  canonicalTitle: { label: "العنوان الأصلي", group: "هوية العنوان" },
  titleAr: { label: "العنوان العربي", group: "هوية العنوان" },
  aliases: { label: "العناوين البديلة", group: "هوية العنوان" },
  summary: { label: "الملخص", group: "هوية العنوان" },
  releaseYear: { label: "سنة الإصدار", group: "إعدادات العنوان" },
  isPrivate: { label: "مخفي عن المنصة", group: "إعدادات العنوان" },
  planetId: { label: "الكوكب", group: "إعدادات العنوان" },
  genres: { label: "التصنيفات", group: "التصنيف والإرشادات" },
  tones: { label: "الطابع", group: "التصنيف والإرشادات" },
  tags: { label: "الوسوم", group: "التصنيف والإرشادات" },
  countries: { label: "الدول", group: "التصنيف والإرشادات" },
  audience: { label: "الجمهور الافتراضي", group: "التصنيف والإرشادات" },
  age: { label: "تصنيف السن", group: "التصنيف والإرشادات" },
  risks: { label: "المخاطر الافتراضية", group: "التصنيف والإرشادات" },
  contentWarnings: { label: "تحذيرات المحتوى", group: "الملاحظات" },
  analysisNotes: { label: "ملاحظات التحليل", group: "الملاحظات" },
  workflowStatus: { label: "حالة سير العمل", group: "النشر" },
  qualityScore: { label: "درجة الجودة", group: "النشر" },
  curatorNotes: { label: "ملاحظات المحرر", group: "النشر" },
  verifiedAt: { label: "تاريخ التحقق", group: "النشر" },
  externalIdentities: { label: "المعرّفات والروابط الخارجية", group: "المعرفة المرتبطة" },
  credits: { label: "المساهمون والاستوديوهات", group: "المعرفة المرتبطة" },
  relationships: { label: "علاقات العناوين", group: "المعرفة المرتبطة" },
  posterPath: { label: "الملصق", group: "الصور" },
  bannerPath: { label: "الغلاف", group: "الصور" },
  logoPath: { label: "الشعار", group: "الصور" },
  tmdbId: { label: "معرّف TMDB", group: "المعرّفات الخارجية" },
  imdbId: { label: "معرّف IMDb", group: "المعرّفات الخارجية" },
  tvdbId: { label: "معرّف TVDB", group: "المعرّفات الخارجية" },
  anilistId: { label: "معرّف AniList", group: "المعرّفات الخارجية" },
  malId: { label: "معرّف MyAnimeList", group: "المعرّفات الخارجية" },
} satisfies Record<TitleJsonField, ProjectionFieldMetadata>;

export const STRUCTURE_PROJECTION_FIELDS: Array<ProjectionField> = [
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
  { key: "structure.installments.tmdbId", label: "معرّف TMDB للجزء", group: "معرّفات الجزء" },
  { key: "structure.installments.imdbId", label: "معرّف IMDb للجزء", group: "معرّفات الجزء" },
  { key: "structure.installments.tvdbId", label: "معرّف TVDB للجزء", group: "معرّفات الجزء" },
  {
    key: "structure.installments.anilistId",
    label: "معرّف AniList للجزء",
    group: "معرّفات الجزء",
  },
  { key: "structure.installments.malId", label: "معرّف MyAnimeList للجزء", group: "معرّفات الجزء" },
  { key: "structure.installments.episodes.id", label: "معرّف الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.title", label: "عنوان الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.summary", label: "ملخص الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.number", label: "رقم الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.position", label: "ترتيب الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.releaseDate", label: "تاريخ الحلقة", group: "الحلقات" },
  { key: "structure.installments.episodes.runtimeMinutes", label: "مدة الحلقة", group: "الحلقات" },
];

const AWARDS_PROJECTION_FIELD: ProjectionField = {
  key: "awards",
  label: "الجوائز والترشيحات",
  group: "الجوائز",
};

export const PROJECTION_FIELDS: readonly ProjectionField[] = [
  // SAFETY: `TITLE_PROJECTION_FIELDS` is declared `satisfies Record<TitleJsonField, ...>`, so
  // its entries are always `[TitleJsonField, ProjectionFieldMetadata]` pairs — `Object.entries`
  // just widens that to `[string, ...]` at the type level.
  ...(
    Object.entries(TITLE_PROJECTION_FIELDS) as Array<[TitleJsonField, ProjectionFieldMetadata]>
  ).map(([field, metadata]) => ({
    // SAFETY: `field` is a `TitleJsonField`, so `title.${field}` always matches `TitleProjectionKey`.
    key: `title.${field}` as TitleProjectionKey,
    ...metadata,
  })),
  ...STRUCTURE_PROJECTION_FIELDS,
  AWARDS_PROJECTION_FIELD,
];

export const PROJECTION_PRESETS = {
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
    fields: [
      "title.genres",
      "title.tags",
      "title.tones",
      "title.audience",
      "title.age",
      "title.countries",
    ],
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
  publishing: {
    label: "النشر والمراجعة",
    fields: [
      "title.workflowStatus",
      "title.qualityScore",
      "title.curatorNotes",
      "title.verifiedAt",
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
  awards: {
    label: "الجوائز والترشيحات",
    fields: ["awards"],
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

export const DEFAULT_PRESET = "complete" as const;

/** The shape a title's awards take in the projected JSON — human-typeable (slugs), not raw ids. */
export const projectedAwardSchema = z.object({
  id: z.string().uuid().optional(),
  organizationSlug: z.string().trim().min(1),
  categorySlug: z.string().trim().min(1),
  installmentId: z.string().uuid().nullable().default(null),
  year: z.number().int().min(1900).max(2100).nullable().default(null),
  result: z.enum(["winner", "nominee"]),
  isFeatured: z.boolean().default(false),
  sourceUrl: z.string().url().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type ProjectedAward = z.infer<typeof projectedAwardSchema>;

/** A title's current award recognitions, as loaded for the editor (id-based, admin shape). */
export type RecordAward = AdminAwardRecognitionInput & { id: string };

export const completeRecordSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z.object({
      work: adminWorkTransportSchema,
      structure: editableWorkStructureSchema,
      awards: z.array(z.custom<RecordAward>()),
    }),
  ),
});

export type CompleteRecordDocument = z.infer<typeof completeRecordSchema>;
export type CompleteRecord = CompleteRecordDocument["records"][number];
export type DiffKind = "added" | "removed" | "changed";
export type FieldDiff = {
  kind: DiffKind;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is null | string | number | boolean | bigint | symbol {
  return value === null || (typeof value !== "object" && value !== undefined);
}

/** Every place this engine narrows an unvalidated JSON value to `string` before using it as an
 *  identifier, date input, or similar — declared as a type guard so oxlint's `no-runtime-typeof`
 *  rule recognizes it as boundary-narrowing rather than an ad hoc `typeof` check. */
function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function valuesEqual(left: unknown, right: unknown) {
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
      .toSorted((a, b) => b.overlap - a.overlap || a.key.localeCompare(b.key))[0]?.key ?? null
  );
}

function diffArrays(left: unknown[], right: unknown[], path: string): FieldDiff[] {
  const identityKey = findArrayIdentityKey(left, right);
  if (identityKey) {
    // `findArrayIdentityKey` only returns a key once it has confirmed every item in both
    // arrays is an object carrying it, so the `isObject` fallback below is defensive, not load
    // bearing.
    const identity = (item: unknown) => JSON.stringify(isObject(item) ? item[identityKey] : null);
    const leftByIdentity = new Map(left.map((item, index) => [identity(item), { item, index }]));
    const rightByIdentity = new Map(right.map((item, index) => [identity(item), { item, index }]));
    const commonLeft = left
      .map((item) => identity(item))
      .filter((value) => rightByIdentity.has(value));
    const commonRight = right
      .map((item) => identity(item))
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

export function diffValues(left: unknown, right: unknown, path: string): FieldDiff[] {
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

export function formatDiffValue(value: unknown, present: boolean) {
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
    awards: _awards,
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
  if (left.length !== right.length) return false;
  const sortedLeft = left.toSorted();
  const sortedRight = right.toSorted();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

const installmentPrefix = "structure.installments.";
const episodePrefix = "structure.installments.episodes.";

export function selectedTitleFields(fields: readonly ProjectionKey[]) {
  // SAFETY: the preceding `.filter` narrows `field` to `TitleProjectionKey`
  // (`title.${TitleJsonField}`), so slicing off the `"title."` prefix always yields a
  // `TitleJsonField`.
  return fields
    .filter((field): field is TitleProjectionKey => field.startsWith("title."))
    .map((field) => field.slice("title.".length) as TitleJsonField);
}

function selectedInstallmentFields(fields: readonly ProjectionKey[]) {
  // SAFETY: the preceding `.filter` narrows `field` to `structure.installments.${InstallmentJsonField}`,
  // so slicing off the `installmentPrefix` always yields an `InstallmentJsonField`.
  return fields
    .filter(
      (field): field is `structure.installments.${InstallmentJsonField}` =>
        field.startsWith(installmentPrefix) && !field.startsWith(episodePrefix),
    )
    .map((field) => field.slice(installmentPrefix.length) as InstallmentJsonField);
}

function selectedEpisodeFields(fields: readonly ProjectionKey[]) {
  // SAFETY: the preceding `.filter` narrows `field` to
  // `structure.installments.episodes.${EpisodeJsonField}`, so slicing off the `episodePrefix`
  // always yields an `EpisodeJsonField`.
  return fields
    .filter((field): field is `structure.installments.episodes.${EpisodeJsonField}` =>
      field.startsWith(episodePrefix),
    )
    .map((field) => field.slice(episodePrefix.length) as EpisodeJsonField);
}

function dateString(timestamp: number | null | undefined) {
  return timestamp == null ? null : new Date(timestamp).toISOString().slice(0, 10);
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function dateTimestamp(value: unknown, path: string) {
  if (value === null) return null;
  const parsed = isoDateSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${path} must be a YYYY-MM-DD date or null.`);
  const timestamp = Date.parse(`${parsed.data}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== parsed.data
  ) {
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
    else if (field === "id") output.id = episode.id;
    else if (field === "title") output.title = episode.title;
    else if (field === "summary") output.summary = episode.summary;
    else if (field === "position") output.position = episode.position;
    else output.runtimeMinutes = episode.runtimeMinutes;
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
  return work[TITLE_FIELD_MAP[field]];
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
    else if (field === "id") output.id = installment.id;
    else if (field === "title") output.title = installment.title;
    else if (field === "summary") output.summary = installment.summary;
    else if (field === "position") output.position = installment.position;
    else if (field === "runtimeMinutes") output.runtimeMinutes = installment.runtimeMinutes;
    else if (field === "tmdbId") output.tmdbId = installment.tmdbId ?? null;
    else if (field === "imdbId") output.imdbId = installment.imdbId ?? null;
    else if (field === "tvdbId") output.tvdbId = installment.tvdbId ?? null;
    else if (field === "anilistId") output.anilistId = installment.anilistId ?? null;
    else if (field === "malId") output.malId = installment.malId ?? null;
    else output.posterPath = installment.posterPath;
  }
  if (episodeFields.length) {
    output.episodes = installment.units.map((episode) => projectedEpisode(episode, episodeFields));
  }
  return output;
}

/** Resolves a projected award (org/category slugs) against the live options list. */
function projectedAward(
  award: RecordAward,
  organizations: readonly AwardOrganizationOption[],
): ProjectedAward {
  const organization = organizations.find((item) => item.id === award.organizationId);
  const category = organization?.categories.find((item) => item.id === award.categoryId);
  return {
    id: award.id,
    organizationSlug: organization?.slug ?? award.organizationId,
    categorySlug: category?.slug ?? award.categoryId,
    installmentId: award.installmentId,
    year: award.year,
    result: award.result,
    isFeatured: award.isFeatured,
    sourceUrl: award.sourceUrl,
    notes: award.notes,
  };
}

export function projectDocument(
  document: CompleteRecordDocument,
  fields: readonly ProjectionKey[],
  preset: ProjectionPreset,
  organizations: readonly AwardOrganizationOption[],
) {
  const titleFields = selectedTitleFields(fields);
  const installmentFields = selectedInstallmentFields(fields);
  const episodeFields = selectedEpisodeFields(fields);
  const includeStructure = installmentFields.length > 0 || episodeFields.length > 0;
  const includeAwards = fields.includes("awards");
  return {
    schemaVersion: 3,
    projection: { preset, fields },
    records: document.records.map((record) => {
      const projectedTitle: JsonObject = {};
      for (const field of titleFields) {
        projectedTitle[field] = projectedTitleValue(record.work, field);
      }
      const projected: JsonObject = {};
      projected.id = record.work.id;
      if (titleFields.length) projected.title = projectedTitle;
      if (includeStructure) {
        projected.structure = {
          installments: record.structure.seasons.map((installment) =>
            projectedInstallment(installment, installmentFields, episodeFields),
          ),
        };
      }
      if (includeAwards) {
        projected.awards = record.awards.map((award) => projectedAward(award, organizations));
      }
      return projected;
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
  const unknown = Object.keys(value).find((key) => {
    // SAFETY: `Set#has` does a plain equality check regardless of the argument's static type,
    // so a `key` that isn't really an `EpisodeJsonField` correctly reports as not-allowed.
    return !allowed.has(key as EpisodeJsonField);
  });
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
    summary: original?.summary ?? "",
    unitNumber: original?.unitNumber ?? null,
    position: original?.position ?? 0,
    runtimeMinutes: original?.runtimeMinutes ?? null,
    releaseAt: original?.releaseAt ?? null,
  };
  // Every branch below writes a JSON-derived value onto `merged`.
  // SAFETY (applies to every assertion in this loop): `merged` is folded into
  // `editableWorkStructureSchema.parse(...)` by the caller (mergeStructureProjection) before it
  // reaches anything else, so a malformed value here surfaces as a clear schema error rather
  // than silent corruption.
  for (const field of fields) {
    if (field === "number") {
      // SAFETY: see loop comment above.
      merged.unitNumber = value.number as number | null;
    } else if (field === "releaseDate") {
      merged.releaseAt = dateTimestamp(value.releaseDate, `${path}.releaseDate`);
    } else if (field === "id" && "id" in value) {
      // SAFETY: see loop comment above.
      merged.id = value.id as string | undefined;
    } else if (field === "title" && "title" in value) {
      // SAFETY: see loop comment above.
      merged.title = value.title as string | null;
    } else if (field === "summary" && "summary" in value) {
      // SAFETY: see loop comment above.
      merged.summary = value.summary as string;
    } else if (field === "position" && "position" in value) {
      // SAFETY: see loop comment above.
      merged.position = value.position as number;
    } else if (field === "runtimeMinutes" && "runtimeMinutes" in value) {
      // SAFETY: see loop comment above.
      merged.runtimeMinutes = value.runtimeMinutes as number | null;
    }
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
  // SAFETY: `Array#includes` does a plain equality check regardless of the argument's static
  // type, so a `field` that isn't really an `InstallmentJsonField` correctly reports as absent.
  const hasAllOwnershipFields = ["id", "kind", "title", "position"].every((field) =>
    installmentFields.includes(field as InstallmentJsonField),
  );
  if (value.installments.length !== original.seasons.length && !hasAllOwnershipFields) {
    throw new Error(
      `${recordId}: select installment id, kind, title, and position before adding or removing installments.`,
    );
  }
  const originalById = new Map(original.seasons.map((season) => [season.id, season]));
  const seasons = value.installments.map((rawInstallment, index) => {
    if (!isObject(rawInstallment)) {
      throw new Error(`${recordId}: structure.installments.${index} must be an object.`);
    }
    const originalInstallment = isString(rawInstallment.id)
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
      // Not (yet) a selectable `InstallmentJsonField` — always carried over from the live row so
      // a structure projection that doesn't know about these fields can't null them out (see the
      // player/torrent roadmap's Phase 0: this is the same rebuild-loses-it hazard `write.ts` and
      // the structure PUT handler close server-side, but the JSON editor bypasses those through
      // its own client-side merge, so it needs the same guard).
      tmdbId: originalInstallment?.tmdbId ?? null,
      imdbId: originalInstallment?.imdbId ?? null,
      tvdbId: originalInstallment?.tvdbId ?? null,
      anilistId: originalInstallment?.anilistId ?? null,
      malId: originalInstallment?.malId ?? null,
      units: originalInstallment?.units ?? [],
    };
    // Every branch below writes a JSON-derived value onto `merged`.
    // SAFETY (applies to every assertion in this loop): `merged` is folded into
    // `editableWorkStructureSchema.parse(...)` at the end of this function, so a malformed
    // value here surfaces as a clear schema error rather than silent corruption.
    for (const field of installmentFields) {
      if (field === "kind") {
        // SAFETY: see loop comment above.
        merged.installmentKind = rawInstallment.kind as typeof merged.installmentKind;
      } else if (field === "status") {
        // SAFETY: see loop comment above.
        merged.releaseStatus = rawInstallment.status as typeof merged.releaseStatus;
      } else if (field === "score") {
        // SAFETY: see loop comment above.
        merged.score = (rawInstallment.score ?? undefined) as typeof merged.score;
      } else if (field === "releaseDate") {
        merged.releaseAt = dateTimestamp(
          rawInstallment.releaseDate,
          `${recordId}.structure.installments.${index}.releaseDate`,
        );
      } else if (field === "id" && "id" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.id = rawInstallment.id as string | undefined;
      } else if (field === "title" && "title" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.title = rawInstallment.title as string;
      } else if (field === "summary" && "summary" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.summary = rawInstallment.summary as string;
      } else if (field === "position" && "position" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.position = rawInstallment.position as number;
      } else if (field === "runtimeMinutes" && "runtimeMinutes" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.runtimeMinutes = rawInstallment.runtimeMinutes as number | null;
      } else if (field === "posterPath" && "posterPath" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.posterPath = rawInstallment.posterPath as string | null;
      } else if (field === "tmdbId" && "tmdbId" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.tmdbId = rawInstallment.tmdbId as number | null;
      } else if (field === "imdbId" && "imdbId" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.imdbId = rawInstallment.imdbId as string | null;
      } else if (field === "tvdbId" && "tvdbId" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.tvdbId = rawInstallment.tvdbId as number | null;
      } else if (field === "anilistId" && "anilistId" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.anilistId = rawInstallment.anilistId as number | null;
      } else if (field === "malId" && "malId" in rawInstallment) {
        // SAFETY: see loop comment above.
        merged.malId = rawInstallment.malId as number | null;
      }
    }
    if (episodeFields.length) {
      if (!Array.isArray(rawInstallment.episodes)) {
        throw new Error(`${recordId}: structure.installments.${index}.episodes must be an array.`);
      }
      // SAFETY: `Array#includes` does a plain equality check regardless of the argument's
      // static type, so a `field` that isn't really an `EpisodeJsonField` correctly reports as
      // absent.
      const hasAllEpisodeOwnershipFields = ["id", "number", "position"].every((field) =>
        episodeFields.includes(field as EpisodeJsonField),
      );
      if (
        rawInstallment.episodes.length !== (originalInstallment?.units.length ?? 0) &&
        !hasAllEpisodeOwnershipFields
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
          isObject(episode) && isString(episode.id)
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

/**
 * Resolves a record's projected `awards` array (org/category slugs) into the normalized,
 * id-based shape the recognition endpoints need — this is where "add an award via JSON"
 * becomes safe: an unknown slug fails clearly here rather than silently writing nothing or
 * throwing an opaque 400 from the server.
 */
function mergeAwardsProjection(
  value: unknown,
  original: readonly RecordAward[],
  organizations: readonly AwardOrganizationOption[],
  recordId: string,
): RecordAward[] {
  if (!Array.isArray(value)) throw new Error(`${recordId}: awards must be an array.`);
  const originalById = new Map(original.map((award) => [award.id, award]));
  return value.map((raw, index) => {
    const path = `${recordId}: awards.${index}`;
    const parsed = projectedAwardSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`${path}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
    }
    const award = parsed.data;
    if (award.id && !originalById.has(award.id)) {
      throw new Error(`${path}: unknown award id "${award.id}" — omit id to create a new one.`);
    }
    const organization = organizations.find((item) => item.slug === award.organizationSlug);
    if (!organization) {
      throw new Error(`${path}: unknown organizationSlug "${award.organizationSlug}".`);
    }
    const category = organization.categories.find((item) => item.slug === award.categorySlug);
    if (!category) {
      throw new Error(
        `${path}: unknown categorySlug "${award.categorySlug}" for organization "${organization.slug}".`,
      );
    }
    return {
      id: award.id ?? crypto.randomUUID(),
      organizationId: organization.id,
      categoryId: category.id,
      titleId: recordId,
      installmentId: award.installmentId,
      year: award.year,
      result: award.result,
      isFeatured: award.isFeatured,
      sourceUrl: award.sourceUrl,
      notes: award.notes,
    };
  });
}

export function parseProjectedDocument(
  text: string,
  base: CompleteRecordDocument,
  fields: readonly ProjectionKey[],
  preset: ProjectionPreset,
  organizations: readonly AwardOrganizationOption[],
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
    !raw.projection.fields.every((field) => isString(field)) ||
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
  const includeAwards = fields.includes("awards");

  const records = raw.records.map((value, index) => {
    if (!isObject(value)) throw new Error(`records.${index} must be an object.`);
    const allowedRecordKeys = new Set([
      "id",
      ...(titleFields.length ? ["title"] : []),
      ...(includeStructure ? ["structure"] : []),
      ...(includeAwards ? ["awards"] : []),
    ]);
    const unknownRecordKey = Object.keys(value).find((key) => !allowedRecordKeys.has(key));
    if (unknownRecordKey) {
      throw new Error(`records.${index}.${unknownRecordKey} is not part of this projection.`);
    }
    if (!isString(value.id)) throw new Error(`records.${index}.id is required.`);
    const original = originals.get(value.id);
    if (!original) throw new Error(`Unknown or out-of-scope work ID: ${value.id}`);
    receivedIds.push(value.id);
    const projectedTitle = titleFields.length
      ? (() => {
          const rawTitle = value.title;
          if (!isObject(rawTitle)) throw new Error(`${value.id}: title is required.`);
          const allowedTitleFields = new Set(titleFields);
          // SAFETY: `Set#has` does a plain equality check regardless of the argument's static
          // type, so a `key` that isn't really a `TitleJsonField` correctly reports as absent.
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
    // `mergedWorkInput` is a staging object: it starts as the known-good `original.work` and
    // gets overwritten one selected field at a time with values parsed from client JSON, so it
    // can't keep `AdminWorkUpdate`'s precise type mid-loop. `adminWorkTransportSchema.parse(...)`
    // below is what actually validates it before it's trusted as a work update.
    const mergedWorkInput: JsonObject = {};
    Object.assign(mergedWorkInput, original.work);
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
    const awards = includeAwards
      ? mergeAwardsProjection(value.awards, original.awards, organizations, value.id)
      : original.awards;
    return { ...original, work: mergedWork, structure, awards };
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

/** Diffs a title's awards against `original` and returns what the save step needs to apply. */
export function diffAwards(original: readonly RecordAward[], desired: readonly RecordAward[]) {
  const originalById = new Map(original.map((award) => [award.id, award]));
  const desiredById = new Map(desired.map((award) => [award.id, award]));
  const toCreate: AdminAwardRecognitionInput[] = [];
  const toUpdate: AdminAwardRecognitionInput[] = [];
  for (const award of desired) {
    const existing = originalById.get(award.id);
    if (!existing) toCreate.push({ ...award, id: undefined });
    else if (!valuesEqual(existing, award)) toUpdate.push(award);
  }
  const toDeleteIds = original
    .filter((award) => !desiredById.has(award.id))
    .map((award) => award.id);
  return { toCreate, toUpdate, toDeleteIds };
}
