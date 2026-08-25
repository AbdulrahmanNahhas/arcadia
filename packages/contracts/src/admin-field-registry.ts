/**
 * The admin catalog field-metadata registry: every editable field, its UI widget kind, which
 * tab/preset it belongs to, its option source, and doc/safety prose — declared ONCE here and
 * consumed by three surfaces on the web side: the single-title editor, the bulk apply-to-many
 * editor, and the JSON editor's field picker + live documentation panel + copy-guide generator.
 *
 * This supersedes `adminSchemaFieldGuide` (removed from `index.ts`), which only documented
 * ~16 of the ~30+ admin-editable fields and had no machine-usable widget/option information —
 * the JSON editor's field picker and the single/bulk editors previously each declared their own
 * field lists independently, with real drift between them (documented separately per surface,
 * never cross-checked). This is the fix for that.
 *
 * Design note (why this is a *parallel* map, not derived purely from the Zod schemas in
 * `admin-catalog.ts` via `.meta()`): two properties here are not schema-derivable at all.
 * Vocabulary fields (`genres`/`tones`/`tags`/`countries`) are DB-backed dynamic enums — the Zod
 * schema can only say `string[]`, the actual valid values live in editable DB tables (see
 * `vocabularyNameSchema`). And UI widget selection / bulk-edit semantics are a concern of the
 * *admin UI*, not of wire validation, which is also used for plain API request parsing where
 * none of this applies — folding it into the validation schema would be a layering violation.
 * So: Zod schemas stay the single source of truth for shape/required/nullable/static-enum
 * values; this registry supplies everything else, and a Vitest cross-check
 * (`admin-field-registry.test.ts`) asserts each entry's `required`/`nullable`/static `options`
 * actually match the real schema at `zodPath`, catching drift without a fragile 1:1 derivation.
 *
 * This file intentionally has zero runtime imports — it's pure data — so it can't participate in
 * any circular-import hazard with `./admin-catalog` or `./index`.
 */

export type AdminFieldEntity =
  | "title"
  | "installment"
  | "episode"
  | "award-recognition"
  | "award-organization"
  | "award-category"
  | "award-ceremony";

export type AdminFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multiselect"
  | "tags"
  | "relation"
  | "relation-multi"
  | "json"
  | "composite";

export type AdminFieldOptionSource =
  | { type: "static"; values: readonly string[] }
  | { type: "vocabulary"; vocabulary: "genres" | "tones" | "tags" | "countries" }
  | {
      type: "relation";
      resolver:
        | "planets"
        | "entities"
        | "award-organizations"
        | "award-categories"
        | "titles"
        | "installments";
    };

export type AdminFieldBulkMode = "none" | "set" | "add-remove";

export interface AdminFieldMeta {
  /** Unique dot-path used as the field's identity across all three surfaces, e.g. "title.age". */
  path: string;
  entity: AdminFieldEntity;
  /** Tab/preset grouping — drives both the single-edit form's tabs and the JSON editor's presets. */
  tab: string;
  labelAr: string;
  labelEn: string;
  kind: AdminFieldKind;
  required: boolean;
  nullable: boolean;
  options?: AdminFieldOptionSource;
  /** One-line explanation shown in the JSON editor's doc panel and inline field help. */
  purpose: string;
  example?: unknown;
  /** Shown as an inline warning near the field and in the JSON editor's safety notes. */
  safetyNotes?: string;
  /** Can this field appear in a JSON "new record" template (i.e. is it needed/useful to create a record)? */
  jsonCreatable: boolean;
  /** Whether/how this field can be edited across many records at once (Stage 3's bulk editor). */
  bulk: AdminFieldBulkMode;
  /**
   * Path into the entity's canonical Zod schema (from `admin-catalog.ts`, or `index.ts`'s
   * `adminAwardRecognitionInputSchema` for `award-recognition` fields), used ONLY by the
   * cross-check test — never imported/used at runtime by this file itself.
   */
  zodPath: readonly string[];
}

export const adminFieldRegistry: readonly AdminFieldMeta[] = [
  // ── title: identity ──────────────────────────────────────────────────────────────────
  {
    path: "title.canonicalTitle",
    entity: "title",
    tab: "identity",
    labelAr: "العنوان الأساسي",
    labelEn: "Canonical title",
    kind: "text",
    required: true,
    nullable: false,
    purpose: "The display and sort title used across the catalog.",
    example: "Attack on Titan",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["canonicalTitle"],
  },
  {
    path: "title.titleAr",
    entity: "title",
    tab: "identity",
    labelAr: "العنوان بالعربية",
    labelEn: "Arabic title",
    kind: "text",
    required: false,
    nullable: true,
    purpose: "Preferred Arabic title shown throughout the RTL interface.",
    example: "هجوم العمالقة",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["titleAr"],
  },
  {
    path: "title.aliases",
    entity: "title",
    tab: "identity",
    labelAr: "الأسماء البديلة",
    labelEn: "Aliases",
    kind: "tags",
    required: false,
    nullable: false,
    purpose: "Alternative titles used to make the title searchable under other names.",
    example: ["Shingeki no Kyojin"],
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["aliases"],
  },
  {
    path: "title.summary",
    entity: "title",
    tab: "identity",
    labelAr: "الملخص",
    labelEn: "Summary",
    kind: "textarea",
    required: false,
    nullable: false,
    purpose: "Editorial summary shown on the title's public page.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["summary"],
  },
  {
    path: "title.releaseYear",
    entity: "title",
    tab: "identity",
    labelAr: "سنة الإصدار",
    labelEn: "Release year",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "Four-digit release year.",
    example: 2013,
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["releaseYear"],
  },
  {
    path: "title.isPrivate",
    entity: "title",
    tab: "identity",
    labelAr: "خاص",
    labelEn: "Private",
    kind: "boolean",
    required: false,
    nullable: false,
    purpose: "Hides the title from the public catalog; visible only to admins/editors.",
    jsonCreatable: false,
    bulk: "set",
    zodPath: ["isPrivate"],
  },
  {
    path: "title.planetId",
    entity: "title",
    tab: "identity",
    labelAr: "الكوكب",
    labelEn: "Planet",
    kind: "relation",
    required: false,
    nullable: true,
    options: { type: "relation", resolver: "planets" },
    purpose: "The universe/collection ('planet') this title belongs to, if any.",
    jsonCreatable: false,
    bulk: "set",
    zodPath: ["planetId"],
  },
  {
    path: "title.tmdbId",
    entity: "title",
    tab: "identity",
    labelAr: "معرّف TMDB",
    labelEn: "TMDB id",
    kind: "number",
    required: false,
    nullable: true,
    purpose:
      "The TMDB id for a franchise title itself (a movie's own TMDB id lives on its installment instead — see structure.installments.tmdbId).",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["tmdbId"],
  },
  {
    path: "title.imdbId",
    entity: "title",
    tab: "identity",
    labelAr: "معرّف IMDb",
    labelEn: "IMDb id",
    kind: "text",
    required: false,
    nullable: true,
    purpose:
      "The IMDb id (ttNNNNNNN) for a franchise title itself — a movie's own IMDb id lives on its installment instead.",
    example: "tt2560140",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["imdbId"],
  },
  {
    path: "title.tvdbId",
    entity: "title",
    tab: "identity",
    labelAr: "معرّف TVDB",
    labelEn: "TVDB id",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "TheTVDB id, used to resolve Fanart.tv's TV clear-logo endpoint for this title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["tvdbId"],
  },
  {
    path: "title.anilistId",
    entity: "title",
    tab: "identity",
    labelAr: "معرّف AniList",
    labelEn: "AniList id",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "The AniList id for this title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["anilistId"],
  },
  {
    path: "title.malId",
    entity: "title",
    tab: "identity",
    labelAr: "معرّف MyAnimeList",
    labelEn: "MyAnimeList id",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "The MyAnimeList id for this title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["malId"],
  },

  // ── title: classification ────────────────────────────────────────────────────────────
  {
    path: "title.audience",
    entity: "title",
    tab: "classification",
    labelAr: "الفئة العمرية المستهدفة",
    labelEn: "Audience",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["general", "teen", "young-adult", "adult"] },
    purpose: "Default audience classification for the title.",
    jsonCreatable: true,
    bulk: "set",
    zodPath: ["audience"],
  },
  {
    path: "title.age",
    entity: "title",
    tab: "classification",
    labelAr: "تصنيف السن",
    labelEn: "Age rating",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["all", "7+", "10+", "13+", "16+", "18+"] },
    purpose:
      "Age rating. Exists in the database on every title but was not editable anywhere in the admin UI before this refactor.",
    jsonCreatable: true,
    bulk: "set",
    zodPath: ["age"],
  },
  {
    path: "title.sexualityRisk",
    entity: "title",
    tab: "classification",
    labelAr: "درجة الحساسية الجنسية",
    labelEn: "Sexuality risk",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["none", "low", "medium", "high"] },
    purpose: "Default sexuality-content risk level.",
    jsonCreatable: true,
    bulk: "set",
    zodPath: ["sexualityRisk"],
  },
  {
    path: "title.behavioralRisk",
    entity: "title",
    tab: "classification",
    labelAr: "درجة الحساسية السلوكية",
    labelEn: "Behavioral risk",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["none", "low", "medium", "high"] },
    purpose: "Default behavioral-content risk level (violence, substance use, etc.).",
    jsonCreatable: true,
    bulk: "set",
    zodPath: ["behavioralRisk"],
  },
  {
    path: "title.theologyRisk",
    entity: "title",
    tab: "classification",
    labelAr: "درجة الحساسية العقدية",
    labelEn: "Theology risk",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["none", "low", "medium", "high"] },
    purpose: "Default theological/religious-content risk level.",
    jsonCreatable: true,
    bulk: "set",
    zodPath: ["theologyRisk"],
  },
  {
    path: "title.genres",
    entity: "title",
    tab: "classification",
    labelAr: "الأنواع",
    labelEn: "Genres",
    kind: "multiselect",
    required: false,
    nullable: false,
    options: { type: "vocabulary", vocabulary: "genres" },
    purpose: "Genre tags, resolved against the admin-editable genres vocabulary.",
    jsonCreatable: true,
    bulk: "add-remove",
    zodPath: ["genres"],
  },
  {
    path: "title.tones",
    entity: "title",
    tab: "classification",
    labelAr: "النبرة",
    labelEn: "Tones",
    kind: "multiselect",
    required: false,
    nullable: false,
    options: { type: "vocabulary", vocabulary: "tones" },
    purpose: "Tone tags, resolved against the admin-editable tones vocabulary.",
    jsonCreatable: false,
    bulk: "add-remove",
    zodPath: ["tones"],
  },
  {
    path: "title.tags",
    entity: "title",
    tab: "classification",
    labelAr: "الوسوم",
    labelEn: "Tags",
    kind: "multiselect",
    required: false,
    nullable: false,
    options: { type: "vocabulary", vocabulary: "tags" },
    purpose: "Free-form descriptive tags, resolved against the admin-editable tags vocabulary.",
    jsonCreatable: false,
    bulk: "add-remove",
    zodPath: ["tags"],
  },
  {
    path: "title.countries",
    entity: "title",
    tab: "classification",
    labelAr: "الدول",
    labelEn: "Countries",
    kind: "multiselect",
    required: false,
    nullable: false,
    options: { type: "vocabulary", vocabulary: "countries" },
    purpose: "Country/origin tags, resolved against the admin-editable countries vocabulary.",
    jsonCreatable: false,
    bulk: "add-remove",
    zodPath: ["countries"],
  },
  {
    path: "title.contentWarnings",
    entity: "title",
    tab: "classification",
    labelAr: "تحذيرات المحتوى",
    labelEn: "Content warnings",
    kind: "textarea",
    required: false,
    nullable: true,
    purpose: "Free-text content warnings shown to viewers before watching.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["contentWarnings"],
  },

  // ── title: editorial / publishing ────────────────────────────────────────────────────
  {
    path: "title.analysisNotes",
    entity: "title",
    tab: "editorial",
    labelAr: "ملاحظات تحليلية",
    labelEn: "Analysis notes",
    kind: "textarea",
    required: false,
    nullable: true,
    purpose: "Internal editorial analysis, not shown to viewers.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["analysisNotes"],
  },
  {
    path: "title.workflowStatus",
    entity: "title",
    tab: "publishing",
    labelAr: "حالة سير العمل",
    labelEn: "Workflow status",
    kind: "select",
    required: false,
    nullable: false,
    options: {
      type: "static",
      values: ["draft", "in_review", "approved", "published", "archived"],
    },
    purpose:
      "Editorial lifecycle stage. Was previously only reachable indirectly (as 2 of its 5 states) through a 'curation' shortcut field — now directly editable.",
    jsonCreatable: true,
    bulk: "set",
    zodPath: ["workflowStatus"],
  },
  {
    path: "title.qualityScore",
    entity: "title",
    tab: "publishing",
    labelAr: "درجة الجودة",
    labelEn: "Quality score",
    kind: "number",
    required: false,
    nullable: false,
    purpose:
      "Internal editorial quality score (integer, 0 or higher). Was never writable before this refactor.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["qualityScore"],
  },
  {
    path: "title.curatorNotes",
    entity: "title",
    tab: "publishing",
    labelAr: "ملاحظات المحرر",
    labelEn: "Curator notes",
    kind: "textarea",
    required: false,
    nullable: false,
    purpose: "Notes left by the curator who reviewed/verified this title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["curatorNotes"],
  },
  {
    path: "title.verifiedAt",
    entity: "title",
    tab: "publishing",
    labelAr: "تاريخ التحقق",
    labelEn: "Verified at",
    kind: "datetime",
    required: false,
    nullable: true,
    purpose:
      "When this title was last editorially verified. Who verified it is always derived from the session, never client-supplied.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["verifiedAt"],
  },
  {
    path: "title.provenance",
    entity: "title",
    tab: "publishing",
    labelAr: "بيانات المصدر",
    labelEn: "Provenance",
    kind: "json",
    required: false,
    nullable: false,
    purpose:
      "Free-form structured metadata about where this record's data came from. Edited as raw JSON; a rich editor isn't worth building for an arbitrary bag of fields.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["provenance"],
  },

  // ── installment ───────────────────────────────────────────────────────────────────────
  {
    path: "structure.installments.kind",
    entity: "installment",
    tab: "structure",
    labelAr: "نوع الجزء",
    labelEn: "Installment kind",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["season", "movie", "special"] },
    purpose: "Whether this installment is a season, a standalone movie, or a special.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["kind"],
  },
  {
    path: "structure.installments.title",
    entity: "installment",
    tab: "structure",
    labelAr: "عنوان الجزء",
    labelEn: "Installment title",
    kind: "text",
    required: true,
    nullable: false,
    purpose: "Display title for this specific season/movie/special.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["title"],
  },
  {
    path: "structure.installments.status",
    entity: "installment",
    tab: "structure",
    labelAr: "حالة الإصدار",
    labelEn: "Release status",
    kind: "select",
    required: false,
    nullable: false,
    options: { type: "static", values: ["announced", "airing", "completed", "unknown"] },
    purpose: "Factual release state of this installment.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["status"],
  },
  {
    path: "structure.installments.position",
    entity: "installment",
    tab: "structure",
    labelAr: "الترتيب",
    labelEn: "Position",
    kind: "number",
    required: true,
    nullable: false,
    purpose: "Stable, non-negative display order among the title's installments.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["position"],
  },
  {
    path: "structure.installments.releaseDate",
    entity: "installment",
    tab: "structure",
    labelAr: "تاريخ الإصدار",
    labelEn: "Release date",
    kind: "date",
    required: false,
    nullable: true,
    purpose: "ISO calendar date this installment released or begins releasing.",
    example: "2013-04-07",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["releaseDate"],
  },
  {
    path: "structure.installments.runtimeMinutes",
    entity: "installment",
    tab: "structure",
    labelAr: "المدة بالدقائق",
    labelEn: "Runtime (minutes)",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "Runtime in minutes, for movies/specials.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["runtimeMinutes"],
  },
  {
    path: "structure.installments.tmdbId",
    entity: "installment",
    tab: "structure",
    labelAr: "معرّف TMDB",
    labelEn: "TMDB id",
    kind: "number",
    required: false,
    nullable: true,
    purpose:
      "This installment's own TMDB id — a movie's IMDb/TMDB match lives on its installment, not the umbrella title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["tmdbId"],
  },
  {
    path: "structure.installments.imdbId",
    entity: "installment",
    tab: "structure",
    labelAr: "معرّف IMDb",
    labelEn: "IMDb id",
    kind: "text",
    required: false,
    nullable: true,
    purpose:
      "This installment's own IMDb id (ttNNNNNNN) — what the torrent-streaming addon resolves a movie by.",
    example: "tt0245429",
    safetyNotes:
      "Setting this to an id that already matches a different installment fails: each IMDb id is unique per installment.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["imdbId"],
  },
  {
    path: "structure.installments.tvdbId",
    entity: "installment",
    tab: "structure",
    labelAr: "معرّف TVDB",
    labelEn: "TVDB id",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "This installment's own TheTVDB id.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["tvdbId"],
  },
  {
    path: "structure.installments.anilistId",
    entity: "installment",
    tab: "structure",
    labelAr: "معرّف AniList",
    labelEn: "AniList id",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "This installment's own AniList id.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["anilistId"],
  },
  {
    path: "structure.installments.malId",
    entity: "installment",
    tab: "structure",
    labelAr: "معرّف MyAnimeList",
    labelEn: "MyAnimeList id",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "This installment's own MyAnimeList id.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["malId"],
  },
  {
    path: "structure.installments.audienceOverride",
    entity: "installment",
    tab: "structure-advanced",
    labelAr: "تجاوز الفئة العمرية",
    labelEn: "Audience override",
    kind: "select",
    required: false,
    nullable: true,
    options: { type: "static", values: ["general", "teen", "young-adult", "adult"] },
    purpose:
      "Overrides the title's default audience for this installment only. Null clears the override.",
    safetyNotes:
      "Advanced/rarely used — edit via the JSON editor rather than dedicated UI controls.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["audienceOverride"],
  },
  {
    path: "structure.installments.ageOverride",
    entity: "installment",
    tab: "structure-advanced",
    labelAr: "تجاوز تصنيف السن",
    labelEn: "Age override",
    kind: "select",
    required: false,
    nullable: true,
    options: { type: "static", values: ["all", "7+", "10+", "13+", "16+", "18+"] },
    purpose: "Overrides the title's default age rating for this installment only.",
    safetyNotes:
      "Advanced/rarely used — edit via the JSON editor rather than dedicated UI controls.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["ageOverride"],
  },
  {
    path: "structure.installments.episodes.number",
    entity: "episode",
    tab: "structure",
    labelAr: "رقم الحلقة",
    labelEn: "Episode number",
    kind: "number",
    required: true,
    nullable: false,
    purpose: "Unique episode number within its installment; supports .5-style specials.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["number"],
  },
  {
    path: "structure.installments.episodes.title",
    entity: "episode",
    tab: "structure",
    labelAr: "عنوان الحلقة",
    labelEn: "Episode title",
    kind: "text",
    required: false,
    nullable: true,
    purpose: "Optional episode title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["title"],
  },
  {
    path: "structure.installments.episodes.position",
    entity: "episode",
    tab: "structure",
    labelAr: "ترتيب الحلقة",
    labelEn: "Episode position",
    kind: "number",
    required: true,
    nullable: false,
    purpose: "Stable, non-negative display order among the installment's episodes.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["position"],
  },
  {
    path: "structure.installments.episodes.releaseDate",
    entity: "episode",
    tab: "structure",
    labelAr: "تاريخ إصدار الحلقة",
    labelEn: "Episode release date",
    kind: "date",
    required: false,
    nullable: true,
    purpose: "ISO calendar date this episode released.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["releaseDate"],
  },

  // ── award recognition (fields live on index.ts's adminAwardRecognitionInputSchema) ──────
  {
    path: "award.organizationId",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "الجهة المانحة",
    labelEn: "Organization",
    kind: "relation",
    required: true,
    nullable: false,
    options: { type: "relation", resolver: "award-organizations" },
    purpose: "The awarding organization.",
    jsonCreatable: true,
    bulk: "add-remove",
    zodPath: ["organizationId"],
  },
  {
    path: "award.categoryId",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "الفئة",
    labelEn: "Category",
    kind: "relation",
    required: true,
    nullable: false,
    options: { type: "relation", resolver: "award-categories" },
    purpose: "The award category, scoped to the chosen organization.",
    jsonCreatable: true,
    bulk: "add-remove",
    zodPath: ["categoryId"],
  },
  {
    path: "award.result",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "النتيجة",
    labelEn: "Result",
    kind: "select",
    required: true,
    nullable: false,
    options: { type: "static", values: ["winner", "nominee"] },
    purpose: "Whether the title won or was nominated.",
    jsonCreatable: true,
    bulk: "add-remove",
    zodPath: ["result"],
  },
  {
    path: "award.year",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "السنة",
    labelEn: "Year",
    kind: "number",
    required: true,
    nullable: true,
    purpose: "Ceremony year; also upserts a matching award_ceremonies row.",
    jsonCreatable: true,
    bulk: "add-remove",
    zodPath: ["year"],
  },
  {
    path: "award.isFeatured",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "إبراز في واجهة العنوان",
    labelEn: "Featured",
    kind: "boolean",
    required: true,
    nullable: false,
    purpose:
      "Shows this recognition as the title's hero badge. Only one per title can be featured — setting this unsets it on every other recognition for the same title.",
    safetyNotes: "Setting this clears the flag on every other recognition of the same title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["isFeatured"],
  },
  {
    path: "award.installmentId",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "النطاق",
    labelEn: "Scope (installment)",
    kind: "relation",
    required: true,
    nullable: true,
    options: { type: "relation", resolver: "installments" },
    purpose:
      "Scopes the recognition to a specific installment instead of the whole title; must belong to the same title.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["installmentId"],
  },
  {
    path: "award.notes",
    entity: "award-recognition",
    tab: "awards",
    labelAr: "ملاحظات",
    labelEn: "Notes",
    kind: "textarea",
    required: true,
    nullable: true,
    purpose: "Free-text notes about the recognition.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["notes"],
  },

  // ── award ceremony (previously unreachable in any admin UI) ─────────────────────────────
  {
    path: "award-ceremony.year",
    entity: "award-ceremony",
    tab: "award-ceremonies",
    labelAr: "السنة",
    labelEn: "Year",
    kind: "number",
    required: true,
    nullable: false,
    purpose: "Ceremony year; unique per organization.",
    jsonCreatable: true,
    bulk: "none",
    zodPath: ["year"],
  },
  {
    path: "award-ceremony.edition",
    entity: "award-ceremony",
    tab: "award-ceremonies",
    labelAr: "الدورة",
    labelEn: "Edition",
    kind: "number",
    required: false,
    nullable: true,
    purpose: "Ordinal edition number of the ceremony (e.g. the 96th Academy Awards).",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["edition"],
  },
  {
    path: "award-ceremony.label",
    entity: "award-ceremony",
    tab: "award-ceremonies",
    labelAr: "الاسم المعروض",
    labelEn: "Label",
    kind: "text",
    required: false,
    nullable: false,
    purpose:
      "Display label for the ceremony. Auto-created (defaulted to the year) the first time a recognition for that org/year is saved — this field lets a curator overwrite that default without it being clobbered back on later recognition saves.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["label"],
  },
  {
    path: "award-ceremony.heldOn",
    entity: "award-ceremony",
    tab: "award-ceremonies",
    labelAr: "تاريخ الحفل",
    labelEn: "Held on",
    kind: "date",
    required: false,
    nullable: true,
    purpose: "Date the ceremony was held.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["heldOn"],
  },
  {
    path: "award-ceremony.sourceUrl",
    entity: "award-ceremony",
    tab: "award-ceremonies",
    labelAr: "رابط المصدر",
    labelEn: "Source URL",
    kind: "text",
    required: false,
    nullable: true,
    purpose: "Link to a source documenting the ceremony.",
    jsonCreatable: false,
    bulk: "none",
    zodPath: ["sourceUrl"],
  },
];

export function fieldsForEntity(entity: AdminFieldEntity): readonly AdminFieldMeta[] {
  return adminFieldRegistry.filter((field) => field.entity === entity);
}

export function fieldsForTab(tab: string): readonly AdminFieldMeta[] {
  return adminFieldRegistry.filter((field) => field.tab === tab);
}

export function fieldByPath(path: string): AdminFieldMeta | undefined {
  return adminFieldRegistry.find((field) => field.path === path);
}
