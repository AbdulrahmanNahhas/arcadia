/**
 * Arabic labels for the raw enum keys the statistics endpoint returns (`public`, `animated-
 * series`, `airing`, `poster`, `image/jpeg`, …). Vocabulary rows (genres, tags, planets…) already
 * carry `labelAr` from the database; these are the fixed keys the API computes itself.
 */
const labels = new Map<string, string>([
  // visibility
  ["public", "عام"],
  ["private", "خاص"],
  // kinds: format × structure
  ["animated-movie", "فيلم رسوم متحركة"],
  ["animated-series", "مسلسل رسوم متحركة"],
  ["live-action-movie", "فيلم حيّ"],
  ["live-action-series", "مسلسل حيّ"],
  // installment status
  ["announced", "مُعلن"],
  ["airing", "يُعرض الآن"],
  ["completed", "مكتمل"],
  ["unknown", "غير محدد"],
  ["upcoming", "قادم"],
  ["returning", "يعود"],
  // media roles
  ["poster", "ملصق"],
  ["banner", "غلاف"],
  ["logo", "شعار"],
  ["profile", "صورة شخصية"],
  // media formats
  ["image/jpeg", "JPEG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
  ["image/gif", "GIF"],
  // installment kinds
  ["season", "موسم"],
  ["movie", "فيلم"],
  ["special", "خاص"],
]);

export function statisticsLabel(key: string): string {
  return labels.get(key) ?? key;
}

/** `{ key, value }` → `{ key, label, value }` so charts and legends never show a raw key. */
export function labelled<T extends { key: string }>(items: T[]): Array<T & { labelAr: string }> {
  return items.map((item) => ({ ...item, labelAr: statisticsLabel(item.key) }));
}
