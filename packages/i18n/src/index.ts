import { taxonomy } from "@arcadia/domain";

export type Locale = "ar" | "en";
type Message = { ar: string; en: string };

export const messages = {
  browse: { ar: "تصفّح", en: "Browse" },
  titles: { ar: "العناوين", en: "Titles" },
  installments: { ar: "الأجزاء", en: "Installments" },
  profiles: { ar: "الملفات", en: "Profiles" },
  settings: { ar: "الإعدادات", en: "Settings" },
  mockAuth: { ar: "وضع العرض — ليس نظام حماية", en: "Demo mode — not security" },
  scoreCoverage: {
    ar: "{scored} من {total} أجزاء مقيّمة",
    en: "{scored} of {total} installments scored",
  },
  noResults: { ar: "لا توجد عناوين تطابق هذه الخيارات.", en: "No titles match these choices." },
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof messages;
export function t(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    messages[key][locale] as string,
  );
}

const taxonomyLabels = new Map<string, Message>(
  Object.entries(taxonomy).flatMap(([vocabulary, values]) =>
    values.map(([slug, en, ar]) => [`${vocabulary}:${slug}`, { ar, en }] as const),
  ),
);
export function taxonomyLabel(locale: Locale, vocabulary: keyof typeof taxonomy, slug: string) {
  return taxonomyLabels.get(`${vocabulary}:${slug}`)?.[locale] ?? slug;
}

export const classificationLabels = {
  general: { ar: "عام", en: "General" },
  teen: { ar: "يافعون", en: "Teen" },
  "young-adult": { ar: "شباب", en: "Young Adult" },
  adult: { ar: "بالغون", en: "Adult" },
  all: { ar: "للجميع", en: "All" },
  none: { ar: "لا يوجد", en: "None" },
  low: { ar: "منخفض", en: "Low" },
  medium: { ar: "متوسط", en: "Medium" },
  high: { ar: "مرتفع", en: "High" },
} as const;

export function valueLabel(locale: Locale, value: string) {
  return (classificationLabels as Record<string, Message>)[value]?.[locale] ?? value;
}
