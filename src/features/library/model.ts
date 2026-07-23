import { z } from "zod"

export const workKinds = [
  "movie",
  "series",
  "anime",
  "manga",
  "novel",
  "game",
  "visual-novel",
  "comic",
] as const

export const workKindSchema = z.enum(workKinds)
export type WorkKind = z.infer<typeof workKindSchema>

export const genres = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Historical",
  "Horror",
  "Mecha",
  "Military",
  "Music",
  "Mystery",
  "Political",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
] as const

export const audiences = ["Adult", "Young Adult", "Teen", "General"] as const

export const tones = [
  "Wholesome",
  "Emotional",
  "Bittersweet",
  "Reflective",
  "Tense",
  "Hype / Energetic",
  "Dark",
  "Surreal / Whimsical",
  "Epic",
  "Atmospheric",
] as const

export const creatorRoles = [
  "author",
  "director",
  "main-studio",
  "publisher",
  "creator",
] as const

export const personalStatuses = [
  "planned",
  "in-progress",
  "completed",
  "paused",
  "dropped",
] as const

export const genreSchema = z.enum(genres)
export const toneSchema = z.enum(tones)
export const creatorRoleSchema = z.enum(creatorRoles)
export const personalStatusSchema = z.enum(personalStatuses)

function isCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine(isCalendarDate, "Use a valid calendar date.")

export const trackingEntrySchema = z.object({
  id: z.string(),
  workId: z.string(),
  progress: z.number().int().min(0),
  status: personalStatusSchema,
  occurredOn: dateOnlySchema,
  daySequence: z.number().int().min(0),
  recordedAt: z.number().int(),
})

export const recordTrackingEntrySchema = trackingEntrySchema.pick({
  workId: true,
  progress: true,
  status: true,
  occurredOn: true,
})

export const trackingPageInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
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
})

export type TrackingEntry = z.infer<typeof trackingEntrySchema>
export type RecordTrackingEntry = z.infer<typeof recordTrackingEntrySchema>
export type TrackingPageInput = z.infer<typeof trackingPageInputSchema>

export type Genre = z.infer<typeof genreSchema>
export type Tone = z.infer<typeof toneSchema>

export const workCreditSchema = z.object({
  entityId: z.string(),
  name: z.string().min(1),
  entityType: z.enum(["person", "studio", "publisher", "organization"]),
  role: creatorRoleSchema,
})

export const workCreditInputSchema = workCreditSchema.omit({ entityId: true })
export type WorkCredit = z.infer<typeof workCreditSchema>

export const publicationSchema = z.object({
  format: z.string().nullable(),
  publisher: z.string().nullable(),
  imprint: z.string().nullable(),
  serialization: z.array(z.string()),
  contents: z.array(z.string()),
})

export const workRelationInputSchema = z.object({
  workId: z.string().min(1),
  relationType: z.enum([
    "adaptation",
    "sequel",
    "prequel",
    "spin-off",
    "related",
  ]),
  direction: z.enum(["outgoing", "incoming"]),
  notes: z.string().default(""),
})

export const relatedWorkSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: workKindSchema,
  year: z.number().int().nullable(),
  releaseStatus: z.enum([
    "announced",
    "releasing",
    "released",
    "ended",
    "unknown",
  ]),
  imagePath: z.string().nullable(),
})

export const workRelationSchema = workRelationInputSchema.extend({
  id: z.string(),
  work: relatedWorkSchema,
})
export type WorkRelation = z.infer<typeof workRelationSchema>

export const workSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  subtitle: z.string().default(""),
  kind: workKindSchema,
  year: z.number().int().nullable(),
  releaseStatus: z.enum([
    "announced",
    "releasing",
    "released",
    "ended",
    "unknown",
  ]),
  runtimeMinutes: z.number().int().min(0).nullable(),
  pageCount: z.number().int().min(0).nullable(),
  episodeCount: z.number().int().min(0).nullable(),
  chapterCount: z.number().int().min(0).nullable(),
  status: personalStatusSchema,
  progress: z.number().min(0),
  progressTotal: z.number().min(0).nullable(),
  progressUnit: z.string(),
  rating: z.number().min(0).max(10).nullable(),
  favorite: z.boolean(),
  completedAt: z.number().int().nullable(),
  trackedOn: dateOnlySchema.nullable(),
  summary: z.string(),
  tags: z.array(z.string()),
  genres: z.array(z.string()),
  aliases: z.array(z.string()),
  studios: z.array(z.string()),
  audience: z.array(z.string()).max(1),
  sharedWith: z.array(z.string()),
  tone: z.array(z.string()),
  contentWarnings: z.string().nullable(),
  analysisNotes: z.string().nullable(),
  riskProfile: z
    .object({
      sexuality: z.enum(["none", "low", "medium", "high", "unknown"]),
      fanService: z.number().min(0).max(10).nullable(),
      behavioral: z.enum(["none", "low", "medium", "high", "unknown"]),
      theology: z.enum(["none", "low", "medium", "high", "unknown"]),
    })
    .nullable(),
  scoreBreakdown: z.record(z.string(), z.number().min(0).max(10)),
  externalLinks: z.array(
    z.object({
      provider: z.string(),
      label: z.string(),
      url: z.url(),
    })
  ),
  releaseStart: z.string().nullable(),
  releaseEnd: z.string().nullable(),
  watchDates: z
    .object({
      firstWatchedAt: z.string().nullable(),
      lastWatchedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
    })
    .nullable(),
  country: z.array(z.string()),
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
  curation: z
    .object({
      reviewedAt: z.string(),
      status: z.enum(["verified", "provisional"]),
      notes: z.string().nullable(),
    })
    .nullable(),
  credits: z.array(workCreditSchema),
  relations: z.array(workRelationSchema),
  creator: z.string(),
  imagePath: z.string().nullable(),
  bannerPath: z.string().nullable(),
  logoPath: z.string().nullable(),
  palette: z.string(),
  addedAt: z.number(),
  catalogUpdatedAt: z.number(),
  personalUpdatedAt: z.number(),
})

export type Work = z.infer<typeof workSchema>

export type StructuralProgress = {
  id: string
  status: Work["status"]
  progress: number
  completedAt: number | null
  updatedAt: number
}

export type WorkUnitDetail = {
  id: string
  workId: string
  seasonId: string | null
  unitType: "episode" | "chapter" | "volume"
  title: string | null
  unitNumber: number | null
  position: number
  runtimeMinutes: number | null
  pageCount: number | null
  releaseAt: number | null
  progress: StructuralProgress | null
}

export type WorkSeasonDetail = {
  id: string
  workId: string
  title: string
  seasonNumber: number | null
  position: number
  runtimeMinutes: number | null
  unitCount: number | null
  releaseAt: number | null
  progress: StructuralProgress | null
  units: WorkUnitDetail[]
}

export type WorkStructure = {
  workId: string
  seasons: WorkSeasonDetail[]
  ungroupedUnits: WorkUnitDetail[]
  completedUnits: number
  totalUnits: number
}

export const editableWorkUnitSchema = z.object({
  id: z.string().min(1).optional(),
  unitType: z.enum(["episode", "chapter", "volume"]),
  title: z.string().nullable().default(null),
  unitNumber: z.number().nullable().default(null),
  position: z.number().int().min(0),
  runtimeMinutes: z.number().int().min(0).nullable().default(null),
  pageCount: z.number().int().min(0).nullable().default(null),
  releaseAt: z.number().int().nullable().default(null),
})

export const editableWorkSeasonSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  seasonNumber: z.number().nullable().default(null),
  position: z.number().int().min(0),
  runtimeMinutes: z.number().int().min(0).nullable().default(null),
  unitCount: z.number().int().min(0).nullable().default(null),
  releaseAt: z.number().int().nullable().default(null),
  units: z.array(editableWorkUnitSchema),
})

export const editableWorkStructureSchema = z.object({
  workId: z.string().min(1),
  seasons: z.array(editableWorkSeasonSchema),
  ungroupedUnits: z.array(editableWorkUnitSchema),
})

export type EditableWorkStructure = z.infer<typeof editableWorkStructureSchema>

export type FilterOperator =
  | "equals"
  | "not-equals"
  | "contains"
  | "starts-with"
  | "greater-than"
  | "less-than"
  | "between"
  | "is-empty"
  | "is-not-empty"
  | "includes"
  | "regex"

export type FilterNode =
  | {
      type: "condition"
      field: string
      operator: FilterOperator
      value?: unknown
    }
  | {
      type: "group"
      conjunction: "and" | "or"
      children: FilterNode[]
    }

export const filterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("condition"),
      field: z.string(),
      operator: z.enum([
        "equals",
        "not-equals",
        "contains",
        "starts-with",
        "greater-than",
        "less-than",
        "between",
        "is-empty",
        "is-not-empty",
        "includes",
        "regex",
      ]),
      value: z.unknown().optional(),
    }),
    z.object({
      type: z.literal("group"),
      conjunction: z.enum(["and", "or"]),
      children: z.array(filterNodeSchema),
    }),
  ])
)

export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  layout: z.enum([
    "gallery",
    "grid",
    "table",
    "timeline",
    "calendar",
    "graph",
    "statistics",
    "kanban",
  ]),
  filters: filterNodeSchema,
  sort: z.array(
    z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })
  ),
  groupBy: z.string().nullable(),
  visibleColumns: z.array(z.string()),
  cardSize: z.number().int().min(1).max(5),
  search: z.string(),
  display: z.record(z.string(), z.unknown()),
})

export const savedUserViewSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(100),
  layout: z.enum(["gallery", "table", "timeline", "statistics"]),
  sort: z.enum(["title", "rating", "recent", "year"]),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  kinds: z.array(workKindSchema),
  excludedKinds: z.array(workKindSchema).default([]),
  statuses: z.array(workSchema.shape.status),
  excludedStatuses: z.array(workSchema.shape.status).default([]),
  minRating: z.number().min(0).max(10),
  favoriteOnly: z.boolean(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  cardSize: z.number().int().min(1).max(300),
  gallery: z.object({
    mode: z.enum(["cover", "title", "full"]),
    imageType: z.enum(["poster", "logo"]),
    showType: z.boolean(),
    showRating: z.boolean(),
  }),
  facets: z
    .object(
      Object.fromEntries(
        [
          "genres",
          "tags",
          "tones",
          "studios",
          "contributors",
          "publishers",
          "publicationFormats",
          "releaseStatuses",
          "countries",
          "audiences",
          "sharedWith",
          "sourceTypes",
          "sexualityRisks",
          "behavioralRisks",
          "theologyRisks",
          "curationStatuses",
          "creatorRoles",
          "externalProviders",
          "structureStates",
        ].map((key) => [
          key,
          z.object({
            include: z.array(z.string()),
            exclude: z.array(z.string()),
          }),
        ])
      ) as Record<
        | "genres"
        | "tags"
        | "tones"
        | "studios"
        | "contributors"
        | "publishers"
        | "publicationFormats"
        | "releaseStatuses"
        | "countries"
        | "audiences"
        | "sharedWith"
        | "sourceTypes"
        | "sexualityRisks"
        | "behavioralRisks"
        | "theologyRisks"
        | "curationStatuses"
        | "creatorRoles"
        | "externalProviders"
        | "structureStates",
        z.ZodObject<{
          include: z.ZodArray<z.ZodString>
          exclude: z.ZodArray<z.ZodString>
        }>
      >
    )
    .optional(),
  search: z.string().default(""),
  visibleColumns: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false),
})

export const createSavedUserViewSchema = savedUserViewSchema.omit({ id: true })
export type SavedUserView = z.infer<typeof savedUserViewSchema>

export const createWorkSchema = workSchema
  .pick({
    title: true,
    kind: true,
    year: true,
    status: true,
  })
  .extend({
    summary: z.string().default(""),
  })

export type CreateWork = z.infer<typeof createWorkSchema>

export const adminWorkUpdateSchema = workSchema
  .omit({
    addedAt: true,
    catalogUpdatedAt: true,
    personalUpdatedAt: true,
    palette: true,
    relations: true,
  })
  .extend({
    genres: z.array(genreSchema),
    tone: z.array(toneSchema),
    relations: z.array(workRelationInputSchema),
  })
export type AdminWorkUpdate = z.infer<typeof adminWorkUpdateSchema>

export const bulkCreateWorkSchema = z.object({
  works: z
    .array(
      createWorkSchema.extend({
        genres: z.array(genreSchema).default([]),
        tags: z.array(z.string()).default([]),
        studios: z.array(z.string()).default([]),
      })
    )
    .min(1)
    .max(500),
})

export const bulkUpdateWorksSchema = z.object({
  workIds: z.array(z.string()).min(1).max(1000),
  kind: workKindSchema.optional(),
  favorite: z.boolean().optional(),
  addGenres: z.array(genreSchema).default([]),
  removeGenres: z.array(genreSchema).default([]),
  addTags: z.array(z.string()).default([]),
  removeTags: z.array(z.string()).default([]),
})
