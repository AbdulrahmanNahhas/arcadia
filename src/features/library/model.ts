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

export const workCreditSchema = z.object({
  entityId: z.string(),
  name: z.string().min(1),
  entityType: z.string().min(1),
  role: z.string().min(1),
})

export const workCreditInputSchema = workCreditSchema.omit({ entityId: true })
export type WorkCredit = z.infer<typeof workCreditSchema>

export const publicationSchema = z.object({
  format: z.string().nullable(),
  publisher: z.string().nullable(),
  imprint: z.string().nullable(),
  serialization: z.array(z.string()),
  demographic: z.string().nullable(),
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
  status: z.enum(["planned", "in-progress", "completed", "paused", "dropped"]),
  progress: z.number().min(0),
  progressTotal: z.number().min(0).nullable(),
  progressUnit: z.string(),
  rating: z.number().min(0).max(10).nullable(),
  favorite: z.boolean(),
  summary: z.string(),
  tags: z.array(z.string()),
  genres: z.array(z.string()),
  aliases: z.array(z.string()),
  studios: z.array(z.string()),
  favoriteCharacters: z.array(z.string()),
  audience: z.array(z.string()),
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
  notes: z.string(),
  creator: z.string(),
  imagePath: z.string().nullable(),
  bannerPath: z.string().nullable(),
  logoPath: z.string().nullable(),
  palette: z.string(),
  addedAt: z.number(),
})

export type Work = z.infer<typeof workSchema>

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
    palette: true,
    relations: true,
  })
  .extend({ relations: z.array(workRelationInputSchema) })
export type AdminWorkUpdate = z.infer<typeof adminWorkUpdateSchema>

export const bulkCreateWorkSchema = z.object({
  works: z
    .array(
      createWorkSchema.extend({
        genres: z.array(z.string()).default([]),
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
  status: workSchema.shape.status.optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
  favorite: z.boolean().optional(),
  addGenres: z.array(z.string()).default([]),
  removeGenres: z.array(z.string()).default([]),
  addTags: z.array(z.string()).default([]),
  removeTags: z.array(z.string()).default([]),
})
