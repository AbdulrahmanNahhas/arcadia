import { vocabularyFallbackLabel } from "@arcadia/i18n";
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
    hour: "ساعة",
    hours: "ساعات",
  };
  return labels[value.trim().toLocaleLowerCase()] ?? value;
}

const valueLabelsAr: Readonly<Record<string, string>> = {
  upcoming: "قادم",
  airing: "يعرض الآن",
  returning: "مستمر",
  completed: "مكتمل",
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
  creator: "منشئ",
  original_author: "مؤلف أصلي",
  director: "مخرج",
  writer: "كاتب",
  producer: "منتج",
  executive_producer: "منتج تنفيذي",
  creative_producer: "منتج إبداعي",
  character_designer: "مصمم شخصيات",
  art_director: "مدير فني",
  scene_design: "تصميم المشاهد",
  composer: "ملحن",
  animation_studio: "استوديو الرسوم المتحركة",
  production_company: "شركة إنتاج",
  distributor: "موزّع",
  publisher: "ناشر",
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
    terms.flatMap((term) =>
      term.labelAr
        ? [[`${term.vocabulary.replace(/s$/, "")}:${term.slug}`, term.labelAr] as const]
        : [],
    ),
  );

  const taxonomyLabel = (vocabulary: string, value: string) => {
    const fallback = fallbackTaxonomyLabels[vocabulary]?.[value];
    if (vocabulary === "country" && fallback) return fallback;
    return (
      databaseLabels.get(`${vocabulary}:${value}`) ??
      fallback ??
      vocabularyFallbackLabel("ar", vocabulary, value)
    );
  };

  const facetValueLabel = (facet: FacetKey, value: string) => {
    const vocabulary = facetVocabulary[facet];
    return vocabulary ? taxonomyLabel(vocabulary, value) : (valueLabelsAr[value] ?? value);
  };

  return { taxonomyLabel, facetValueLabel };
}
