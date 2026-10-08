import {
  isJsonObject,
  isIdentifiedJson,
  type JsonValue,
  type WorkField,
} from "@/features/editor/json/document/document-model";

export const installmentFields = [
  { key: "kind", label: "نوع الجزء" },
  { key: "position", label: "ترتيب الجزء" },
  { key: "summary", label: "ملخص الجزء" },
  { key: "status", label: "حالة العرض" },
  { key: "releaseDate", label: "تاريخ الإصدار" },
  { key: "runtimeMinutes", label: "المدة" },
  { key: "audienceOverride", label: "الجمهور" },
  { key: "ageOverride", label: "السن" },
  { key: "sexualityRiskOverride", label: "المحتوى الجنسي" },
  { key: "behavioralRiskOverride", label: "المحتوى السلوكي" },
  { key: "theologyRiskOverride", label: "المحتوى العقدي" },
  { key: "score", label: "التقييمات الستة" },
  { key: "media", label: "صور الجزء" },
  { key: "tmdbId", label: "TMDB" },
  { key: "imdbId", label: "IMDb" },
  { key: "anilistId", label: "AniList" },
  { key: "malId", label: "MAL" },
  { key: "episodes", label: "الحلقات" },
] as const;
export const episodeFields = [
  { key: "position", label: "ترتيب الحلقة" },
  { key: "title", label: "عنوان الحلقة" },
  { key: "summary", label: "الملخص" },
  { key: "releaseDate", label: "تاريخ الإصدار" },
  { key: "runtimeMinutes", label: "المدة" },
] as const;
export type StructureScope = { installments: string[]; episodes: string[] };
export const fullStructureScope: StructureScope = {
  installments: installmentFields.map(({ key }) => key),
  episodes: episodeFields.map(({ key }) => key),
};
function select(row: Record<string, JsonValue>, keys: string[]) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => keys.includes(key)));
}
export function projectRows(
  rows: Record<string, JsonValue>[],
  fields: WorkField[],
  scope: StructureScope,
) {
  return {
    schemaVersion: 1,
    fields,
    records: rows.map((row) => {
      const projected = select(row, ["id", ...fields]);
      if (Array.isArray(projected.installments))
        projected.installments = projected.installments.map((value) => {
          if (!isJsonObject(value)) return value;
          const item = select(value, ["id", "title", ...scope.installments]);
          if (Array.isArray(item.episodes))
            item.episodes = item.episodes.map((episode) =>
              isJsonObject(episode)
                ? select(episode, ["id", "number", ...scope.episodes])
                : episode,
            );
          return item;
        });
      return projected;
    }),
  };
}
// Missing fields are deliberately preserved. Supplied arrays retain only their supplied members;
// deletion protection and relationship checks still run on the server during review.
export function preserveHidden(current: JsonValue, patch: JsonValue): JsonValue {
  if (Array.isArray(current) && Array.isArray(patch))
    return patch.map((next) => {
      if (!isIdentifiedJson(next)) return next;
      const original = current.find((value) => isJsonObject(value) && value.id === next.id);
      return original ? preserveHidden(original, next) : next;
    });
  if (isJsonObject(current) && isJsonObject(patch))
    return Object.fromEntries([
      ...Object.entries(current),
      ...Object.entries(patch).map(([key, value]) => [
        key,
        Object.hasOwn(current, key) ? preserveHidden(current[key]!, value) : value,
      ]),
    ]);
  return patch;
}
