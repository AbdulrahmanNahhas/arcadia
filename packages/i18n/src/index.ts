import { taxonomy } from "@arcadia/domain";

/**
 * Arcadia's interface is Arabic-only. This object is the shared UI vocabulary;
 * bilingual taxonomy labels below are retained only for catalog metadata/imports.
 */
export const ar = {
  common: {
    save: "حفظ التغييرات",
    cancel: "إلغاء",
    add: "إضافة",
    edit: "تعديل",
    remove: "حذف",
    search: "بحث",
    loading: "جارٍ التحميل…",
    retry: "إعادة المحاولة",
    close: "إغلاق",
  },
  auth: {
    title: "الدخول إلى أركاديا",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    signIn: "دخول",
    signOut: "تسجيل الخروج",
    invalidCredentials: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    sessionRequired: "سجّل الدخول لمتابعة الاستكشاف.",
  },
  accounts: {
    title: "حسابات العائلة",
    choose: "من يستكشف الليلة؟",
    create: "إضافة حساب",
    invite: "إنشاء دعوة",
    settings: "إعدادات الحساب",
    hiddenRules: "قواعد الإخفاء",
    noHiddenRuleDetails: "تُطبّق حدود العائلة تلقائياً لحماية تجربة التصفح.",
  },
  awards: {
    title: "الجوائز والتكريمات",
    organization: "الجهة المانحة",
    category: "الفئة",
    addOrganization: "إضافة جهة مانحة",
    addCategory: "إضافة فئة",
    winner: "فائز",
    nominee: "مرشّح",
  },
  social: {
    familyActivity: "نشاط العائلة",
    review: "مراجعة",
    discussion: "نقاش العائلة",
    spoiler: "يتضمن حرقاً",
    publish: "نشر",
  },
} as const;

export const audienceOptions = [
  ["general", "عام"],
  ["teen", "يافعون"],
  ["young-adult", "شباب"],
  ["adult", "بالغون"],
] as const;
export const ageOptions = [
  ["all", "للجميع"],
  ["7+", "7+"],
  ["10+", "10+"],
  ["13+", "13+"],
  ["16+", "16+"],
  ["18+", "18+"],
] as const;
export const riskOptions = [
  ["none", "لا يوجد"],
  ["low", "منخفض"],
  ["medium", "متوسط"],
  ["high", "مرتفع"],
] as const;
export const accountKindLabels = {
  admin: "مدير",
  family: "عائلة",
  personal: "شخصي",
} as const;
export const accountRoleLabels = { owner: "المالك", editor: "محرّر", member: "عضو" } as const;
export const accountStatusLabels = {
  invited: "بانتظار التفعيل",
  active: "نشط",
  suspended: "موقوف",
} as const;
export const accountCapabilityLabels = {
  "catalog.view": "عرض الكتالوج",
  "catalog.edit": "تحرير الأعمال",
  "people.edit": "تحرير الأشخاص",
  "studios.edit": "تحرير الاستوديوهات",
  "awards.edit": "تحرير الجوائز",
  "accounts.manage": "إدارة الحسابات",
  "policies.manage": "إدارة قواعد الإخفاء",
  "social.moderate": "إشراف النقاشات",
  "media.manage": "إدارة الوسائط",
  "analytics.view": "عرض الإحصاءات",
} as const;
export const avatarLabels = {
  "orbit-1": "الفجر",
  "orbit-2": "السديم",
  "orbit-3": "المرجان",
  "orbit-4": "الزمرد",
  "orbit-5": "القمر",
} as const;

export type Locale = "ar" | "en";
type Message = { ar: string; en: string };

export const messages = {
  browse: { ar: "تصفّح", en: "Browse" },
  titles: { ar: "العناوين", en: "Titles" },
  installments: { ar: "الأجزاء", en: "Installments" },
  accounts: { ar: "الحسابات", en: "Accounts" },
  settings: { ar: "الإعدادات", en: "Settings" },
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

const controlledValueLabels: Record<string, Message> = {
  upcoming: { ar: "قادم", en: "Upcoming" },
  announced: { ar: "معلن", en: "Announced" },
  airing: { ar: "يعرض الآن", en: "Airing" },
  returning: { ar: "مستمر", en: "Returning" },
  completed: { ar: "مكتمل", en: "Completed" },
  unknown: { ar: "غير معروف", en: "Unknown" },
  person: { ar: "شخص", en: "Person" },
  organization: { ar: "مؤسسة", en: "Organization" },
  admin: { ar: "مدير", en: "Administrator" },
  family: { ar: "عائلة", en: "Family" },
  personal: { ar: "شخصي", en: "Personal" },
  sequel: { ar: "تكملة", en: "Sequel" },
  adaptation: { ar: "اقتباس", en: "Adaptation" },
  "spin-off": { ar: "عمل مشتق", en: "Spin-off" },
  "side-story": { ar: "قصة جانبية", en: "Side story" },
  compilation: { ar: "تجميعي", en: "Compilation" },
  alternative: { ar: "بديل", en: "Alternative" },
  related: { ar: "مرتبط", en: "Related" },
};

export function vocabularyFallbackLabel(
  locale: Locale,
  vocabulary: keyof typeof taxonomy | string,
  slug: string,
) {
  if (vocabulary in taxonomy)
    return taxonomyLabel(locale, vocabulary as keyof typeof taxonomy, slug);
  return controlledValueLabels[slug]?.[locale] ?? valueLabel(locale, slug);
}
