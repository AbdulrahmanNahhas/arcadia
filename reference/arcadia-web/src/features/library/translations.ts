import { titleKindLabels } from "@arcadia/domain";
import { vocabularyFallbackLabel } from "@arcadia/i18n";
import { useQuery } from "@tanstack/react-query";
import { labelFromSlug } from "@/server/compat";
import { getTaxonomyTerms } from "@/server/library.functions";
import type { FacetKey } from "./filtering";
import { taxonomyLabels, type WorkKind } from "./model";

/** The one Arabic name for each catalog type — every surface (browse chips, group headers, the
 *  card badge, the admin table) reads it from here rather than keeping its own copy. */
export const kindLabelsAr = {
  "animated-movie": titleKindLabels["animated-movie"].ar,
  "animated-series": titleKindLabels["animated-series"].ar,
  "live-action-movie": titleKindLabels["live-action-movie"].ar,
  "live-action-series": titleKindLabels["live-action-series"].ar,
} satisfies Record<WorkKind, string>;

const valueLabelsArEntries = {
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
} satisfies Record<string, string>;

/** Arabic label for a value that isn't tied to a specific facet's controlled vocabulary
 *  (statuses, risk levels, curation states, role slugs, …). Keyed by arbitrary value strings,
 *  so a `Map` rather than an object dictionary keeps the lookup honest about that shape. */
export const valueLabelsAr = new Map(Object.entries(valueLabelsArEntries));

const facetVocabulary = new Map<FacetKey, string>([
  ["genres", "genre"],
  ["tags", "tag"],
  ["tones", "tone"],
  ["countries", "country"],
  ["audiences", "audience"],
]);

// `@arcadia/domain`'s taxonomy (genres/tones/tags) is keyed in the plural, but browse facets
// use the singular vocabulary name (matching the `vocabulary_terms`-style DB rows). Map back to
// the plural before delegating to `vocabularyFallbackLabel`, or its lookup silently misses.
function canonicalVocabulary(vocabulary: string) {
  if (vocabulary === "genre") return "genres";
  if (vocabulary === "tone") return "tones";
  if (vocabulary === "tag") return "tags";
  return vocabulary;
}

export const facetLabelsAr = {
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
} satisfies Record<FacetKey, string>;

function useTaxonomyTerms() {
  const { data: terms = [] } = useQuery({
    queryKey: ["taxonomy-terms"],
    queryFn: () => getTaxonomyTerms(),
    staleTime: 60_000,
  });
  return terms;
}

const fallbackCountryLabels: Record<string, string> = taxonomyLabels.countries;

/**
 * The countries a work may carry, in the English-label form `Work.country` holds (the same
 * `labelFromSlug` the API compat layer applies), plus their Arabic labels — read from the
 * database vocabulary so a country added under /admin/vocabularies is immediately offerable.
 * The static map only stands in until the query resolves (or offline).
 */
export function useCountryOptions() {
  const terms = useTaxonomyTerms();
  const live = terms.filter((term) => term.vocabulary === "countries" && term.isActive);
  if (live.length === 0) {
    return { values: Object.keys(fallbackCountryLabels), labels: fallbackCountryLabels };
  }
  const labels: Record<string, string> = {};
  for (const term of live) {
    const value = labelFromSlug(term.slug);
    labels[value] = term.labelAr || fallbackCountryLabels[value] || value;
  }
  return { values: Object.keys(labels), labels };
}

export function useArabicTranslations() {
  const terms = useTaxonomyTerms();

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
    const vocabulary = facetVocabulary.get(facet);
    return vocabulary ? taxonomyLabel(vocabulary, value) : (valueLabelsAr.get(value) ?? value);
  };

  return { taxonomyLabel, facetValueLabel };
}
