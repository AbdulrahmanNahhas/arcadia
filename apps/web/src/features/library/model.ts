import {
  type AdminEntityInput,
  awardRecognitionSchema,
  adminEntityInputSchema as contractAdminEntityInputSchema,
  workflowStatusSchema,
} from "@arcadia/contracts";
import { ageSchema, taxonomy } from "@arcadia/domain";
import { z } from "zod";

export const workKinds = [
  "movie",
  "series",
  "anime",
  "manga",
  "novel",
  "game",
  "visual-novel",
  "comic",
] as const;

export const workKindSchema = z.enum(workKinds);
export type WorkKind = z.infer<typeof workKindSchema>;

export const ageValues = ageSchema.options;
export const workflowStatusValues = workflowStatusSchema.options;

export const genres = [
  "Action",
  "Adventure",
  "Comedy",
  "Crime",
  "Drama",
  "Fantasy",
  "Historical",
  "Horror",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Science Fiction",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "War",
] as const;

export const audiences = ["Adult", "Young Adult", "Teen", "General"] as const;

export const countries = [
  "Australia",
  "Austria",
  "Belgium",
  "Canada",
  "China",
  "Denmark",
  "Finland",
  "France",
  "Japan",
  "Latvia",
  "Luxembourg",
  "Netherlands",
  "South Korea",
  "Spain",
  "Switzerland",
  "United Kingdom",
  "United States",
] as const;

export const tones = [
  "Wholesome",
  "Emotional",
  "Bittersweet",
  "Reflective",
  "Tense",
  "Energetic",
  "Dark",
  "Whimsical",
  "Epic",
  "Atmospheric",
] as const;

// `genres`/`tones`/`tags` labels are derived from `@arcadia/domain`'s taxonomy — the single
// source of truth also used to seed the database — rather than hand-copied here. Hand-copying
// previously let this file drift out of sync with the real vocabulary (missing/duplicate/stale
// translations); deriving them makes that drift impossible.
function labelsFromTaxonomy(vocabulary: "genres" | "tones" | "tags") {
  return Object.fromEntries(
    taxonomy[vocabulary].map(([, labelEn, labelAr]): [string, string] => [labelEn, labelAr]),
  );
}

export const taxonomyLabels = {
  genres: labelsFromTaxonomy("genres"),
  tones: labelsFromTaxonomy("tones"),
  audiences: {
    Adult: "بالغون",
    "Young Adult": "شباب بالغون",
    Teen: "مراهقون",
    General: "عام",
  },
  countries: {
    Australia: "أستراليا",
    Austria: "النمسا",
    Belgium: "بلجيكا",
    Canada: "كندا",
    China: "الصين",
    Denmark: "الدنمارك",
    Finland: "فنلندا",
    France: "فرنسا",
    Japan: "اليابان",
    Latvia: "لاتفيا",
    Luxembourg: "لوكسمبورغ",
    Netherlands: "هولندا",
    Spain: "إسبانيا",
    "South Korea": "كوريا الجنوبية",
    Switzerland: "سويسرا",
    "United Kingdom": "المملكة المتحدة",
    "United States": "الولايات المتحدة",
  },
  ages: {
    all: "للجميع",
    "7+": "7+",
    "10+": "10+",
    "13+": "13+",
    "16+": "16+",
    "18+": "18+",
  },
  workflowStatuses: {
    draft: "مسودة",
    in_review: "قيد المراجعة",
    approved: "معتمد",
    published: "منشور",
    archived: "مؤرشف",
  },
} as const;

export const tagLabelsAr = labelsFromTaxonomy("tags");

export const personContributorRoles = [
  "creator",
  "original_author",
  "director",
  "writer",
  "producer",
  "executive_producer",
  "creative_producer",
  "character_designer",
  "art_director",
  "scene_design",
  "composer",
] as const;

export const organizationContributorRoles = [
  "animation_studio",
  "production_company",
  "distributor",
  "publisher",
] as const;

export const contributorRoles = [
  ...personContributorRoles,
  ...organizationContributorRoles,
] as const;

export const contributorRolesByEntityType = {
  person: personContributorRoles,
  organization: organizationContributorRoles,
} as const;

export function contributorRoleEntityType(
  role: (typeof contributorRoles)[number],
): "person" | "organization" {
  return (organizationContributorRoles as readonly string[]).includes(role)
    ? "organization"
    : "person";
}

export const personalStatuses = [
  "saved",
  "planned",
  "in-progress",
  "completed",
  "paused",
  "dropped",
] as const;

export const genreSchema = z.enum(genres);
export const toneSchema = z.enum(tones);
export const audienceSchema = z.enum(audiences);
export const countrySchema = z.enum(countries);
export const contributorRoleSchema = z.enum(contributorRoles);
export const personalStatusSchema = z.enum(personalStatuses);

function isCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "استخدم تاريخاً بصيغة YYYY-MM-DD.")
  .refine(isCalendarDate, "استخدم تاريخاً صحيحاً.");

export const trackingEntrySchema = z.object({
  id: z.string(),
  workId: z.string(),
  progressBefore: z.number().int().min(0),
  progress: z.number().int().min(0),
  statusBefore: personalStatusSchema,
  status: personalStatusSchema,
  occurredOn: dateOnlySchema,
  daySequence: z.number().int().min(0),
  recordedAt: z.number().int(),
});

export const recordTrackingEntrySchema = trackingEntrySchema.pick({
  workId: true,
  progress: true,
  status: true,
  occurredOn: true,
});

export const trackingPageInputSchema = z.object({
  limit: z.number().int().min(1).max(10_000).default(200),
  cursor: z
    .object({
      occurredOn: dateOnlySchema,
      daySequence: z.number().int().min(0),
      id: z.string(),
    })
    .optional(),
  workId: z.string().optional(),
  statuses: z.array(personalStatusSchema).optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
});

export type TrackingEntry = z.infer<typeof trackingEntrySchema>;
export type RecordTrackingEntry = z.infer<typeof recordTrackingEntrySchema>;
export type TrackingPageInput = z.infer<typeof trackingPageInputSchema>;

export type Genre = z.infer<typeof genreSchema>;
export type Tone = z.infer<typeof toneSchema>;
export type Audience = z.infer<typeof audienceSchema>;
export type Country = z.infer<typeof countrySchema>;

export const workContributionSchema = z.object({
  entityId: z.string(),
  name: z.string().min(1),
  entityType: z.enum(["person", "organization"]),
  role: contributorRoleSchema,
  isPrimary: z.boolean().default(false),
});

export const workContributionInputSchema = workContributionSchema.omit({
  entityId: true,
});
export type WorkContribution = z.infer<typeof workContributionSchema>;

export const entitySchema = z.object({
  id: z.string(),
  name: z.string(),
  sortName: z.string(),
  entityType: z.enum(["person", "organization"]),
  description: z.string(),
  imagePath: z.string().nullable(),
  primaryUrl: z.string().nullable(),
  malId: z.number().int().positive().nullable(),
  anilistId: z.number().int().positive().nullable(),
  imdbId: z.string().nullable(),
  wikipediaUrl: z.string().nullable(),
  establishedAt: z.string().nullable(),
  birthDate: z.string().nullable(),
  deathDate: z.string().nullable(),
  favorites: z.number().int().min(0).nullable(),
  aliases: z.array(z.string()).default([]),
  workCount: z.number().int().min(0),
  roles: z.array(z.object({ role: contributorRoleSchema, count: z.number().int().min(1) })),
  kinds: z.array(z.object({ kind: workKindSchema, count: z.number().int().min(1) })),
  works: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      arabicTitle: z.string().nullable(),
      kind: workKindSchema,
      year: z.number().int().nullable(),
      status: personalStatusSchema,
      releaseStatus: z.enum(["upcoming", "airing", "returning", "completed", "unknown"]),
      calculatedRating: z.number().min(0).max(10).nullable(),
      isSequelMovie: z.boolean(),
      imagePath: z.string().nullable(),
      isPrivate: z.boolean().default(false),
      roles: z.array(contributorRoleSchema),
      contributions: z
        .array(
          z.object({
            role: contributorRoleSchema,
            roleLabelAr: z.string(),
            position: z.number().int().min(0),
            isPrimary: z.boolean(),
          }),
        )
        .default([]),
    }),
  ),
});
export type Entity = z.infer<typeof entitySchema>;

export const adminEntityInputSchema = contractAdminEntityInputSchema;
export type { AdminEntityInput };

export const publicationSchema = z.object({
  format: z.string().nullable(),
  publisher: z.string().nullable(),
  imprint: z.string().nullable(),
  serialization: z.array(z.string()),
  contents: z.array(z.string()),
});

export const workRelationInputSchema = z.object({
  id: z.string().min(1).optional(),
  workId: z.string().min(1),
  relationType: z.enum([
    "adaptation",
    "sequel",
    "spin-off",
    "side-story",
    "compilation",
    "alternative",
    "related",
  ]),
  direction: z.enum(["outgoing", "incoming"]),
  notes: z.string().default(""),
  provenance: z.string().default("manual"),
  externalKey: z.string().nullable().default(null),
});

export const relatedWorkSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: workKindSchema,
  year: z.number().int().nullable(),
  releaseStatus: z.enum(["upcoming", "airing", "returning", "completed", "unknown"]),
  imagePath: z.string().nullable(),
});

export const workRelationSchema = workRelationInputSchema.extend({
  id: z.string(),
  work: relatedWorkSchema,
});
export type WorkRelation = z.infer<typeof workRelationSchema>;

export const workSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  arabicTitle: z.string().nullable().default(null),
  installmentId: z.string().nullable().optional(),
  installmentTitle: z.string().nullable().optional(),
  kind: workKindSchema,
  /**
   * Kinds of the title's own installments (`season`/`movie`/`special`), distinct from `kind`
   * (the umbrella title's own type). Lets catalog filtering find e.g. a movie installment
   * that lives under an `anime` title, which `kind` alone would hide from a "Movie" filter.
   */
  installmentKinds: z.array(z.enum(["season", "movie", "special"])).default([]),
  year: z.number().int().nullable(),
  releaseStatus: z.enum(["upcoming", "airing", "returning", "completed", "unknown"]),
  isPrivate: z.boolean().default(false),
  planetId: z.string().nullable().default(null),
  runtimeMinutes: z.number().int().min(0).nullable(),
  playtimeMinutes: z.number().int().min(0).nullable(),
  pageCount: z.number().int().min(0).nullable(),
  episodeCount: z.number().int().min(0).nullable(),
  chapterCount: z.number().int().min(0).nullable(),
  volumeCount: z.number().int().min(0).nullable(),
  routeCount: z.number().int().min(0).nullable(),
  status: personalStatusSchema,
  progress: z.number().min(0),
  progressTotal: z.number().min(0).nullable(),
  progressUnit: z.string(),
  calculatedRating: z.number().min(0).max(10).nullable(),
  scoreCoverage: z.object({ scored: z.number().int(), total: z.number().int() }).optional(),
  favorite: z.boolean(),
  completedAt: z.number().int().nullable(),
  trackedOn: dateOnlySchema.nullable(),
  summary: z.string(),
  tags: z.array(z.string()),
  genres: z.array(z.string()),
  aliases: z.array(z.string()),
  studios: z.array(z.string()),
  audience: audienceSchema.nullable(),
  sharedWith: z.array(z.string()),
  tone: z.array(z.string()),
  contentWarnings: z.string().nullable(),
  analysisNotes: z.string().nullable(),
  riskProfile: z
    .object({
      sexuality: z.enum(["none", "low", "medium", "high", "unknown"]),
      behavioral: z.enum(["none", "low", "medium", "high", "unknown"]),
      theology: z.enum(["none", "low", "medium", "high", "unknown"]),
    })
    .nullable(),
  scoreComponents: z
    .object({
      story: z.number().min(0).max(10).optional(),
      characters: z.number().min(0).max(10).optional(),
      depth: z.number().min(0).max(10).optional(),
      worldBuilding: z.number().min(0).max(10).optional(),
      originality: z.number().min(0).max(10).optional(),
      craft: z.number().min(0).max(10).optional(),
    })
    .default({}),
  externalLinks: z.array(
    z.object({
      provider: z.string(),
      label: z.string(),
      url: z.url(),
    }),
  ),
  /** Typed catalog identifiers — for a franchise title these are the title's own ids (AniList/
   * MAL/TVDB), distinct from each installment's `tmdbId`/`imdbId` on `WorkSeasonDetail`. */
  tmdbId: z.number().int().positive().nullable().default(null),
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .nullable()
    .default(null),
  tvdbId: z.number().int().positive().nullable().default(null),
  anilistId: z.number().int().positive().nullable().default(null),
  malId: z.number().int().positive().nullable().default(null),
  awards: z.array(awardRecognitionSchema),
  releaseStart: z.string().nullable(),
  releaseEnd: z.string().nullable(),
  watchDates: z
    .object({
      firstWatchedAt: z.string().nullable(),
      lastWatchedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
    })
    .nullable(),
  country: z.array(countrySchema),
  sourceMaterial: z
    .object({
      type: z.string(),
      started: z.number().int().nullable(),
      finished: z.number().int().nullable(),
      serialization: z.array(z.string()),
      publication: z.string().nullable(),
    })
    .nullable(),
  publication: publicationSchema.nullable(),
  /**
   * @deprecated Superseded by the direct `workflowStatus`/`curatorNotes`/`verifiedAt` fields
   * below — those can reach every workflow state and write `qualityScore`, which this
   * two-state proxy never could. Kept only for the API's legacy-payload fallback path.
   */
  curation: z
    .object({
      reviewedAt: z.string(),
      status: z.enum(["verified", "provisional"]),
      notes: z.string().nullable(),
    })
    .nullable(),
  age: ageSchema.nullable(),
  workflowStatus: workflowStatusSchema.nullable(),
  qualityScore: z.number().int().nullable(),
  curatorNotes: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  contributors: z.array(workContributionSchema),
  animationStudios: z.array(workContributionSchema),
  productionCompanies: z.array(workContributionSchema),
  publishers: z.array(workContributionSchema),
  relations: z.array(workRelationSchema),
  isSequelMovie: z.boolean(),
  creator: z.string(),
  imagePath: z.string().nullable(),
  bannerPath: z.string().nullable(),
  logoPath: z.string().nullable(),
  palette: z.string(),
  addedAt: z.number(),
  catalogUpdatedAt: z.number(),
  personalUpdatedAt: z.number(),
});

export type Work = z.infer<typeof workSchema>;

export type StructuralProgress = {
  id: string;
  status: Work["status"];
  progress: number;
  completedAt: number | null;
  updatedAt: number;
};

export type WorkUnitDetail = {
  id: string;
  workId: string;
  seasonId: string | null;
  unitType: "episode" | "chapter" | "volume";
  title: string | null;
  unitNumber: number | null;
  position: number;
  runtimeMinutes: number | null;
  pageCount: number | null;
  releaseAt: number | null;
  progress: StructuralProgress | null;
};

export type WorkSeasonDetail = {
  id: string;
  workId: string;
  title: string;
  installmentKind?: "season" | "movie" | "special";
  summary?: string;
  releaseStatus?: "announced" | "airing" | "completed" | "unknown";
  rating?: number | null;
  score?: {
    story: number | null;
    characters: number | null;
    depth: number | null;
    worldBuilding: number | null;
    originality: number | null;
    craft: number | null;
  };
  seasonNumber: number | null;
  position: number;
  runtimeMinutes: number | null;
  unitCount: number | null;
  releaseAt: number | null;
  posterPath?: string | null;
  /** This installment's own catalog identifiers — a movie's IMDb id lives here, not on the
   * title, since a franchise title's installments each match a different IMDb/TMDB entry. */
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  anilistId?: number | null;
  malId?: number | null;
  progress: StructuralProgress | null;
  units: WorkUnitDetail[];
};

export type WorkStructure = {
  workId: string;
  seasons: WorkSeasonDetail[];
  ungroupedUnits: WorkUnitDetail[];
  completedUnits: number;
  totalUnits: number;
};

export const editableWorkUnitSchema = z.object({
  id: z.string().min(1).optional(),
  unitType: z.literal("episode").default("episode"),
  title: z.string().nullable().default(null),
  unitNumber: z.number().nullable().default(null),
  position: z.number().int().min(0),
  runtimeMinutes: z.number().int().min(0).nullable().default(null),
  releaseAt: z.number().int().nullable().default(null),
});

export const editableWorkSeasonSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  installmentKind: z.enum(["season", "movie", "special"]).default("season"),
  summary: z.string().default(""),
  releaseStatus: z.enum(["announced", "airing", "completed", "unknown"]).default("unknown"),
  posterPath: z.string().nullable().default(null),
  score: z
    .object({
      story: z.number().min(0).max(10).nullable(),
      characters: z.number().min(0).max(10).nullable(),
      depth: z.number().min(0).max(10).nullable(),
      worldBuilding: z.number().min(0).max(10).nullable(),
      originality: z.number().min(0).max(10).nullable(),
      craft: z.number().min(0).max(10).nullable(),
    })
    .optional(),
  seasonNumber: z.number().nullable().default(null),
  position: z.number().int().min(0),
  runtimeMinutes: z.number().int().min(0).nullable().default(null),
  unitCount: z.number().int().min(0).nullable().default(null),
  releaseAt: z.number().int().nullable().default(null),
  tmdbId: z.number().int().positive().nullable().default(null),
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .nullable()
    .default(null),
  tvdbId: z.number().int().positive().nullable().default(null),
  anilistId: z.number().int().positive().nullable().default(null),
  malId: z.number().int().positive().nullable().default(null),
  units: z.array(editableWorkUnitSchema),
});

export const editableWorkStructureSchema = z.object({
  workId: z.string().min(1),
  seasons: z.array(editableWorkSeasonSchema),
  ungroupedUnits: z.array(editableWorkUnitSchema),
});

export type EditableWorkStructure = z.infer<typeof editableWorkStructureSchema>;

export const createWorkSchema = workSchema
  .pick({
    title: true,
    kind: true,
    year: true,
    status: true,
    isPrivate: true,
  })
  .extend({
    summary: z.string().default(""),
    status: personalStatusSchema.default("saved"),
    isPrivate: z.boolean().default(false),
  });

export type CreateWork = z.input<typeof createWorkSchema>;

export const adminWorkTransportSchema = workSchema
  .omit({
    addedAt: true,
    catalogUpdatedAt: true,
    personalUpdatedAt: true,
    palette: true,
    relations: true,
    calculatedRating: true,
    scoreCoverage: true,
    animationStudios: true,
    productionCompanies: true,
    publishers: true,
    isSequelMovie: true,
    // Awards are no longer part of a title's own save payload — they're written immediately,
    // one recognition at a time, through the admin awards endpoints (see TitleAwardsPanel /
    // AwardRecognitionForm). Omitting it here matches what the editor form actually sends.
    awards: true,
  })
  .extend({
    genres: z.array(genreSchema),
    tone: z.array(toneSchema),
    relations: z.array(workRelationInputSchema),
  });

export const adminWorkUpdateSchema = adminWorkTransportSchema.superRefine((work, context) => {
  if (work.tags.length > 12) {
    context.addIssue({
      code: "too_big",
      maximum: 12,
      origin: "array",
      inclusive: true,
      path: ["tags"],
      message: "اختر 12 وسماً قابلاً لإعادة الاستخدام كحد أقصى.",
    });
  }
  const isVerified = work.workflowStatus === "approved" || work.workflowStatus === "published";
  if (!isVerified) return;
  if (work.genres.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["genres"],
      message: "تحتاج الأعمال الموثّقة إلى تصنيف واحد على الأقل.",
    });
  }
  if (work.tone.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["tone"],
      message: "تحتاج الأعمال الموثّقة إلى طابع واحد على الأقل.",
    });
  }
  if (work.audience === null) {
    context.addIssue({
      code: "custom",
      path: ["audience"],
      message: "تحتاج الأعمال الموثّقة إلى جمهور مستهدف.",
    });
  }
});
export type AdminWorkUpdate = z.infer<typeof adminWorkUpdateSchema>;

export const adminRecordChangeSchema = z.object({
  workId: z.string().min(1),
  work: adminWorkTransportSchema.optional(),
  structure: editableWorkStructureSchema.optional(),
});

export const bulkCreateWorkSchema = z.object({
  works: z
    .array(
      createWorkSchema.extend({
        genres: z.array(genreSchema).default([]),
        tags: z.array(z.string()).default([]),
        studios: z.array(z.string()).default([]),
      }),
    )
    .min(1)
    .max(500),
});

export const bulkUpdateWorksSchema = z.object({
  workIds: z.array(z.string()).min(1).max(1000),
  kind: workKindSchema.optional(),
  audience: z.enum(audiences).nullable().optional(),
  favorite: z.boolean().optional(),
  addGenres: z.array(genreSchema).default([]),
  removeGenres: z.array(genreSchema).default([]),
  addTags: z.array(z.string()).default([]),
  removeTags: z.array(z.string()).default([]),
});
