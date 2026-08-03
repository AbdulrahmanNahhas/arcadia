import { useQuery } from "@tanstack/react-query";
import { getTaxonomyTerms } from "@/server/library.functions";
import type { FacetKey } from "./filtering";
import type { Work, WorkKind } from "./model";
import { tagLabelsAr, taxonomyLabels } from "./model";

export const kindLabelsAr: Record<WorkKind, string> = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  manga: "مانغا",
  novel: "رواية",
  game: "لعبة",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصورة",
};

export const statusLabelsAr: Record<Work["status"], string> = {
  saved: "محفوظ",
  planned: "مخطط له",
  "in-progress": "قيد المتابعة",
  completed: "مكتمل",
  paused: "متوقف مؤقتاً",
  dropped: "متروك",
};

export function progressUnitLabelAr(value: string) {
  const labels: Record<string, string> = {
    episode: "حلقة",
    episodes: "حلقات",
    chapter: "فصل",
    chapters: "فصول",
    volume: "مجلد",
    volumes: "مجلدات",
    page: "صفحة",
    pages: "صفحات",
    route: "مسار",
    routes: "مسارات",
    hour: "ساعة",
    hours: "ساعات",
  };
  return labels[value.trim().toLocaleLowerCase()] ?? value;
}

const valueLabelsAr: Readonly<Record<string, string>> = {
  announced: "مُعلن",
  releasing: "قيد الإصدار",
  released: "صدر",
  ended: "منتهٍ",
  unknown: "غير معروف",
  none: "لا يوجد",
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  verified: "موثّق",
  provisional: "مبدئي",
  unreviewed: "غير مراجع",
  "not assessed": "غير مقيّم",
  structured: "مقسّم إلى وحدات",
  unstructured: "غير مقسّم",
  author: "مؤلف",
  "original-author": "مؤلف أصلي",
  writer: "كاتب",
  screenwriter: "كاتب سيناريو",
  director: "مخرج",
  illustrator: "رسّام",
  artist: "فنان",
  "animation-studio": "استوديو الرسوم المتحركة",
  "production-company": "شركة إنتاج",
  producer: "منتج",
  developer: "مطوّر",
  publisher: "ناشر",
  composer: "ملحن",
  editor: "محرر",
  translator: "مترجم",
  creator: "منشئ",
  person: "شخص",
  organization: "مؤسسة",
};

const facetVocabulary: Partial<Record<FacetKey, string>> = {
  genres: "genre",
  tags: "tag",
  tones: "tone",
  countries: "country",
  audiences: "audience",
};

const fallbackTaxonomyLabels: Readonly<Record<string, Record<string, string>>> = {
  genre: taxonomyLabels.genres,
  tone: taxonomyLabels.tones,
  audience: taxonomyLabels.audiences,
  tag: tagLabelsAr,
  country: taxonomyLabels.countries,
};

export const facetLabelsAr: Record<FacetKey, string> = {
  genres: "التصنيفات",
  tags: "الوسوم والموضوعات",
  tones: "الطابع",
  studios: "الاستوديوهات",
  contributors: "المساهمون",
  publishers: "الناشرون",
  publicationFormats: "صيغة النشر",
  releaseStatuses: "حالة الإصدار",
  countries: "الدول",
  audiences: "الجمهور",
  sharedWith: "مشاركة مع",
  sourceTypes: "المادة الأصلية",
  sexualityRisks: "إرشادات المحتوى الجنسي",
  behavioralRisks: "العنف والمحتوى المزعج",
  theologyRisks: "الموضوعات الدينية والغيبية",
  curationStatuses: "حالة المراجعة",
  creatorRoles: "أدوار صنّاع العمل",
  externalProviders: "المصادر الخارجية",
  structureStates: "بنية التتبع",
};

export function useArabicTranslations() {
  const { data: terms = [] } = useQuery({
    queryKey: ["taxonomy-terms"],
    queryFn: () => getTaxonomyTerms(),
    staleTime: 60_000,
  });

  const databaseLabels = new Map(
    terms
      .filter((term) => term.labelAr)
      .map((term) => [`${term.vocabulary}:${term.labelEn}`, term.labelAr!]),
  );

  const taxonomyLabel = (vocabulary: string, value: string) => {
    const fallback = fallbackTaxonomyLabels[vocabulary]?.[value];
    if (vocabulary === "country" && fallback) return fallback;
    return (
      databaseLabels.get(`${vocabulary}:${value}`) ?? fallback ?? valueLabelsAr[value] ?? value
    );
  };

  const facetValueLabel = (facet: FacetKey, value: string) => {
    const vocabulary = facetVocabulary[facet];
    return vocabulary ? taxonomyLabel(vocabulary, value) : (valueLabelsAr[value] ?? value);
  };

  return { taxonomyLabel, facetValueLabel };
}
