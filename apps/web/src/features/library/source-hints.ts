import type { StreamCandidate } from "@arcadia/contracts";

/**
 * What a release's free text says about its *audio* and subtitles — the addon carries no
 * structured field, so this is the same kind of heuristic `detectLanguages` (API) uses for the
 * language flags, applied to the words releasers actually put in names: "Dual Audio", "Multi
 * Subs", "DUBBED", "ARABIC"… Shown before choosing a source (download picker, player source
 * panel) so a family member can pick the dub they want instead of finding out after 2 GB.
 */
export type SourceHint = {
  key: string;
  label: string;
  /** Audio hints are the ones a family member picks by; subtitle hints are secondary. */
  kind: "audio" | "subtitle";
};

const hintRules: ReadonlyArray<{ pattern: RegExp; hint: SourceHint }> = [
  { pattern: /dual[\s._-]?audio/i, hint: { key: "dual", label: "صوت مزدوج", kind: "audio" } },
  {
    pattern: /multi[\s._-]?(audio|lang(uage)?s?)\b|\bmulti\b(?![\s._-]?subs?)/i,
    hint: { key: "multi-audio", label: "صوتيات متعددة", kind: "audio" },
  },
  {
    pattern: /\b(ar(abic)?[\s._-]?dub(bed)?|dub(bed)?[\s._-]?ar(abic)?)\b|مدبلج/i,
    hint: { key: "ar-dub", label: "دبلجة عربية", kind: "audio" },
  },
  { pattern: /\bdub(bed|s)?\b/i, hint: { key: "dub", label: "مدبلج", kind: "audio" } },
  {
    pattern: /multi[\s._-]?subs?\b/i,
    hint: { key: "multi-subs", label: "ترجمات متعددة", kind: "subtitle" },
  },
  {
    pattern: /\b(ar(abic)?[\s._-]?subs?|subs?[\s._-]?ar(abic)?)\b|مترجم/i,
    hint: { key: "ar-subs", label: "ترجمة عربية", kind: "subtitle" },
  },
  { pattern: /\bsubbed\b|\bsubs?\b/i, hint: { key: "subs", label: "مترجم", kind: "subtitle" } },
];

export function sourceHints(
  candidate: Pick<StreamCandidate, "filename" | "description" | "label">,
): SourceHint[] {
  const text = [candidate.filename, candidate.description, candidate.label]
    .filter((part): part is string => Boolean(part))
    .join("\n");
  const found: SourceHint[] = [];
  for (const rule of hintRules) {
    if (!rule.pattern.test(text)) continue;
    // "مدبلج" is implied by the more specific Arabic-dub hint; "مترجم" by the Arabic-subs one.
    if (rule.hint.key === "dub" && found.some((hint) => hint.key === "ar-dub")) continue;
    if (rule.hint.key === "subs" && found.some((hint) => hint.kind === "subtitle")) continue;
    found.push(rule.hint);
  }
  return found;
}
