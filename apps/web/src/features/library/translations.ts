import { vocabularyFallbackLabel } from "@arcadia/i18n";
import { useQuery } from "@tanstack/react-query";
import { getTaxonomyTerms } from "@/server/library.functions";
import type { FacetKey } from "./filtering";
import type { WorkKind } from "./model";

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

// `@arcadia/domain`'s taxonomy (genres/tones/tags) is keyed in the plural, but browse facets
// use the singular vocabulary name (matching the `vocabulary_terms`-style DB rows). Map back to
// the plural before delegating to `vocabularyFallbackLabel`, or its lookup silently misses.
function canonicalVocabulary(vocabulary: string) {
  if (vocabulary === "genre") return "genres";
  if (vocabulary === "tone") return "tones";
  if (vocabulary === "tag") return "tags";
  return vocabulary;
}

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

  const taxonomyLabel = (vocabulary: string, value: string) =>
    databaseLabels.get(`${vocabulary}:${value}`) ??
    vocabularyFallbackLabel("ar", canonicalVocabulary(vocabulary), value);

  const facetValueLabel = (facet: FacetKey, value: string) => {
    const vocabulary = facetVocabulary[facet];
    return vocabulary ? taxonomyLabel(vocabulary, value) : (valueLabelsAr[value] ?? value);
  };

  return { taxonomyLabel, facetValueLabel };
}
