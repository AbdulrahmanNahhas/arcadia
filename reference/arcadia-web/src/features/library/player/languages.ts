/**
 * Everything the player knows about a language: the Arabic label the family reads, the flag that
 * makes a row scannable at TV distance, and every code mpv/ffmpeg/OpenSubtitles are known to
 * report for it (ISO 639-1, 639-2/B, 639-2/T, and the odd region-suffixed tag like `pt-BR`).
 */
export interface LanguageInfo {
  /** Canonical ISO 639-1 code (`"en"`), or `"und"` for a track with no usable language tag. */
  code: string;
  label: string;
  flag: string;
}

interface LanguageEntry extends LanguageInfo {
  aliases: readonly string[];
}

const LANGUAGES: readonly LanguageEntry[] = [
  { code: "ar", label: "العربية", flag: "🇸🇦", aliases: ["ara"] },
  { code: "en", label: "الإنجليزية", flag: "🇺🇸", aliases: ["eng"] },
  { code: "es", label: "الإسبانية", flag: "🇪🇸", aliases: ["spa"] },
  { code: "ja", label: "اليابانية", flag: "🇯🇵", aliases: ["jpn"] },
  { code: "fr", label: "الفرنسية", flag: "🇫🇷", aliases: ["fre", "fra"] },
  { code: "de", label: "الألمانية", flag: "🇩🇪", aliases: ["ger", "deu"] },
  { code: "it", label: "الإيطالية", flag: "🇮🇹", aliases: ["ita"] },
  { code: "ru", label: "الروسية", flag: "🇷🇺", aliases: ["rus"] },
  { code: "ko", label: "الكورية", flag: "🇰🇷", aliases: ["kor"] },
  { code: "pt", label: "البرتغالية", flag: "🇵🇹", aliases: ["por"] },
  { code: "pt-br", label: "البرتغالية (البرازيل)", flag: "🇧🇷", aliases: ["pob"] },
  { code: "tr", label: "التركية", flag: "🇹🇷", aliases: ["tur"] },
  { code: "pl", label: "البولندية", flag: "🇵🇱", aliases: ["pol"] },
  { code: "nl", label: "الهولندية", flag: "🇳🇱", aliases: ["dut", "nld"] },
  {
    code: "zh",
    label: "الصينية",
    flag: "🇨🇳",
    aliases: ["chi", "zho", "zh-cn", "zh-tw", "zt", "ze"],
  },
  { code: "fa", label: "الفارسية", flag: "🇮🇷", aliases: ["per", "fas"] },
  { code: "hi", label: "الهندية", flag: "🇮🇳", aliases: ["hin"] },
  { code: "ta", label: "التاميلية", flag: "🇮🇳", aliases: ["tam"] },
  { code: "te", label: "التيلوغوية", flag: "🇮🇳", aliases: ["tel"] },
  { code: "ur", label: "الأردية", flag: "🇵🇰", aliases: ["urd"] },
  { code: "bn", label: "البنغالية", flag: "🇧🇩", aliases: ["ben"] },
  { code: "id", label: "الإندونيسية", flag: "🇮🇩", aliases: ["ind"] },
  { code: "ms", label: "الماليزية", flag: "🇲🇾", aliases: ["may", "msa"] },
  { code: "th", label: "التايلندية", flag: "🇹🇭", aliases: ["tha"] },
  { code: "vi", label: "الفيتنامية", flag: "🇻🇳", aliases: ["vie"] },
  { code: "he", label: "العبرية", flag: "🇮🇱", aliases: ["heb"] },
  { code: "el", label: "اليونانية", flag: "🇬🇷", aliases: ["gre", "ell"] },
  { code: "sv", label: "السويدية", flag: "🇸🇪", aliases: ["swe"] },
  { code: "nb", label: "النرويجية", flag: "🇳🇴", aliases: ["no", "nor", "nob"] },
  { code: "da", label: "الدنماركية", flag: "🇩🇰", aliases: ["dan"] },
  { code: "fi", label: "الفنلندية", flag: "🇫🇮", aliases: ["fin"] },
  { code: "hu", label: "المجرية", flag: "🇭🇺", aliases: ["hun"] },
  { code: "cs", label: "التشيكية", flag: "🇨🇿", aliases: ["cze", "ces"] },
  { code: "ro", label: "الرومانية", flag: "🇷🇴", aliases: ["rum", "ron"] },
  { code: "uk", label: "الأوكرانية", flag: "🇺🇦", aliases: ["ukr"] },
  { code: "bg", label: "البلغارية", flag: "🇧🇬", aliases: ["bul"] },
  { code: "hr", label: "الكرواتية", flag: "🇭🇷", aliases: ["hrv"] },
  { code: "sr", label: "الصربية", flag: "🇷🇸", aliases: ["srp"] },
];

const UNKNOWN_LANGUAGE: LanguageInfo = { code: "und", label: "غير محدد", flag: "🏳️" };

const byCode = new Map<string, LanguageEntry>();
for (const entry of LANGUAGES) {
  byCode.set(entry.code, entry);
  for (const alias of entry.aliases) byCode.set(alias, entry);
}

/**
 * Folds any code a track or subtitle service reports into the canonical entry. Unknown but
 * well-formed codes still get a flagless entry with the code as its label, so a rare language is
 * shown honestly rather than dropped.
 */
export function languageInfo(raw: string | null | undefined): LanguageInfo {
  if (!raw) return UNKNOWN_LANGUAGE;
  const code = raw.trim().toLowerCase();
  if (!code || code === "und" || code === "unknown") return UNKNOWN_LANGUAGE;
  const exact = byCode.get(code);
  if (exact) return exact;
  // `pt-BR`, `zh-Hans`, `en-US`: the base tag is what matters, once the suffixed form has had its
  // own chance above.
  const base = code.split(/[-_]/)[0];
  const baseEntry = base ? byCode.get(base) : undefined;
  if (baseEntry) return baseEntry;
  return { code, label: code.toUpperCase(), flag: "🏳️" };
}

/**
 * The languages offered by default in the audio and subtitle pickers. Everything else exists in
 * the file/search results too, behind an explicit "show all languages" toggle — the old fixed
 * filter hid tracks entirely, which broke down whenever a track was mislabelled or the family
 * actually wanted a dub the filter excluded.
 */
export const CURATED_AUDIO_LANGUAGES: readonly string[] = ["ar", "en", "es", "ja"];
export const CURATED_SUBTITLE_LANGUAGES: readonly string[] = ["ar", "en", "es"];
