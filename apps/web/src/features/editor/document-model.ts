import type { WorkDocument } from "@arcadia/cli/work";
import { z } from "zod";

export const workFields = [
  { key: "canonicalTitle", label: "العنوان الأصلي", group: "الهوية" },
  { key: "titleAr", label: "العنوان العربي", group: "الهوية" },
  { key: "sortTitle", label: "اسم الترتيب", group: "الهوية" },
  { key: "releaseYear", label: "سنة الإصدار", group: "الهوية" },
  { key: "format", label: "الصيغة", group: "الهوية" },
  { key: "aliases", label: "الأسماء البديلة", group: "الهوية" },
  { key: "trivia", label: "حقائق ومعلومات", group: "الهوية" },
  { key: "summary", label: "الملخص", group: "الهوية" },
  { key: "genres", label: "التصنيفات", group: "الفهرسة" },
  { key: "tones", label: "الطابع", group: "الفهرسة" },
  { key: "tags", label: "الوسوم", group: "الفهرسة" },
  { key: "countries", label: "الدول", group: "الفهرسة" },
  { key: "planets", label: "الكواكب", group: "الفهرسة" },
  { key: "credits", label: "المساهمات", group: "الفهرسة" },
  { key: "audience", label: "الجمهور", group: "التحرير" },
  { key: "age", label: "تصنيف السن", group: "التحرير" },
  { key: "sexualityRisk", label: "المحتوى الجنسي", group: "التحرير" },
  { key: "behavioralRisk", label: "المحتوى السلوكي", group: "التحرير" },
  { key: "theologyRisk", label: "المحتوى العقدي", group: "التحرير" },
  { key: "contentWarnings", label: "تنبيهات المحتوى", group: "التحرير" },
  { key: "analysisNotes", label: "ملاحظات التحليل", group: "التحرير" },
  { key: "curatorNotes", label: "ملاحظات المحرر", group: "التحرير" },
  { key: "workflowStatus", label: "حالة النشر", group: "التحرير" },
  { key: "qualityScore", label: "جودة البيانات", group: "التحرير" },
  { key: "isPrivate", label: "عمل خاص", group: "الصور والظهور" },
  { key: "media", label: "الصور", group: "الصور والظهور" },
  { key: "installments", label: "الأجزاء والحلقات والتقييمات", group: "البنية" },
  { key: "tmdbId", label: "TMDB", group: "المراجع" },
  { key: "imdbId", label: "IMDb", group: "المراجع" },
  { key: "anilistId", label: "AniList", group: "المراجع" },
  { key: "malId", label: "MAL", group: "المراجع" },
  { key: "externalIds", label: "المعرّفات الخارجية", group: "المراجع" },
  { key: "awards", label: "الجوائز", group: "الجوائز" },
  { key: "relations", label: "الأعمال المرتبطة", group: "المراجع" },
] as const satisfies readonly { key: keyof WorkDocument; label: string; group: string }[];
export type WorkField = (typeof workFields)[number]["key"];
export const fieldKeys = workFields.map((field) => field.key);
export type JsonValue = z.infer<ReturnType<typeof z.json>>;
export const documentRow = z.record(z.string(), z.json());
export const projectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    fields: z.array(z.enum(fieldKeys)).min(1),
    records: z.array(documentRow).min(1),
  })
  .strict();
export type WorkSnapshot = { document: WorkDocument; revision: string };
export type DocumentValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | DocumentValue[]
  | { [key: string]: DocumentValue };
function isDocumentObject(value: DocumentValue): value is { [key: string]: DocumentValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isJsonString(value: JsonValue): value is string {
  return typeof value === "string";
}
function identified(value: JsonValue): value is { [key: string]: JsonValue } & { id: string } {
  return isJsonObject(value) && typeof value.id === "string";
}
export function equalValue(left: DocumentValue, right: DocumentValue): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length && left.every((value, index) => equalValue(value, right[index]))
    );
  if (isDocumentObject(left) && isDocumentObject(right)) {
    const a = Object.entries(left);
    const b = Object.entries(right);
    return (
      a.length === b.length &&
      a.every(([key, value]) => Object.hasOwn(right, key) && equalValue(value, right[key]))
    );
  }
  return false;
}
export function projectDocuments(documents: readonly WorkDocument[], fields: readonly WorkField[]) {
  return {
    schemaVersion: 1,
    fields,
    records: documents.map((document) =>
      Object.fromEntries([
        ["id", document.id],
        ...fields.filter((key) => document[key] !== undefined).map((key) => [key, document[key]]),
      ]),
    ),
  };
}
export interface DocumentChange {
  path: string;
  before: JsonValue | null;
  after: JsonValue | null;
}
export function documentChanges(before: JsonValue, after: JsonValue, path = ""): DocumentChange[] {
  if (equalValue(before, after)) return [];
  if (isJsonObject(before) && isJsonObject(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) =>
      documentChanges(before[key] ?? null, after[key] ?? null, path ? `${path}.${key}` : key),
    );
  }
  if (Array.isArray(before) && Array.isArray(after) && [...before, ...after].every(identified)) {
    const ids = [
      ...new Set([...before, ...after].map((value) => (identified(value) ? value.id : ""))),
    ];
    return ids.flatMap((id) =>
      documentChanges(
        before.find((value) => identified(value) && value.id === id) ?? null,
        after.find((value) => identified(value) && value.id === id) ?? null,
        `${path}[${id}]`,
      ),
    );
  }
  return [{ path, before, after }];
}
export type DocumentReview = {
  ticket: string;
  expiresAt: number;
  records: { id: string; name: string; changes: DocumentChange[] }[];
};
