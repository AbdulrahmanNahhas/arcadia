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
] as const

export const audiences = ["Adult", "Young Adult", "Teen", "General"] as const

export const countries = [
  "Australia",
  "France",
  "Japan",
  "South Korea",
  "United Kingdom",
  "United States",
] as const

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
] as const

export const taxonomyLabels = {
  genres: {
    Action: "أكشن",
    Adventure: "مغامرة",
    Comedy: "كوميديا",
    Crime: "جريمة",
    Drama: "دراما",
    Fantasy: "فانتازيا",
    Historical: "تاريخي",
    Horror: "رعب",
    Mecha: "ميكا",
    Music: "موسيقى",
    Mystery: "غموض",
    Psychological: "نفسي",
    Romance: "رومانسية",
    "Science Fiction": "خيال علمي",
    "Slice of Life": "شريحة من الحياة",
    Sports: "رياضة",
    Supernatural: "خوارق",
    Thriller: "إثارة",
    War: "حرب",
  },
  tones: {
    Wholesome: "دافئ",
    Emotional: "عاطفي",
    Bittersweet: "حلو ومر",
    Reflective: "تأملي",
    Tense: "متوتر",
    Energetic: "حماسي",
    Dark: "قاتم",
    Whimsical: "خيالي مرح",
    Epic: "ملحمي",
    Atmospheric: "غني بالأجواء",
  },
  audiences: {
    Adult: "بالغون",
    "Young Adult": "شباب بالغون",
    Teen: "مراهقون",
    General: "عام",
  },
  countries: {
    Australia: "أستراليا",
    France: "فرنسا",
    Japan: "اليابان",
    "South Korea": "كوريا الجنوبية",
    "United Kingdom": "المملكة المتحدة",
    "United States": "الولايات المتحدة",
  },
} as const

export const tagLabelsAr: Readonly<Record<string, string>> = {
  "Adult Cast": "شخصيات بالغة",
  Adoption: "التبنّي",
  Agriculture: "الزراعة",
  Aliens: "كائنات فضائية",
  "Animal Cast": "شخصيات حيوانية",
  "Animated Movie": "فيلم رسوم متحركة",
  Animals: "الحيوانات",
  "Anime Movie": "فيلم أنمي",
  Anthology: "قصص مختارة",
  Antihero: "بطل مضاد",
  Art: "الفن",
  "Artificial Intelligence": "الذكاء الاصطناعي",
  "Arranged Marriage": "زواج مدبّر",
  Assassins: "القتلة المأجورون",
  Badminton: "الريشة الطائرة",
  Basketball: "كرة السلة",
  "Body Horror": "رعب جسدي",
  "Body Swap": "تبادل الأجساد",
  Bullying: "التنمّر",
  "Cat and Mouse": "مطاردة القط والفأر",
  "Child Cast": "شخصيات طفولية",
  "Childhood Classic": "كلاسيكيات الطفولة",
  Censorship: "الرقابة",
  "Class Conflict": "الصراع الطبقي",
  Cohabitation: "السكن المشترك",
  College: "الجامعة",
  "Coming-of-Age": "النضج",
  Conspiracy: "المؤامرة",
  Cooking: "الطبخ",
  "Corporate Power": "نفوذ الشركات",
  "Crime Organization": "منظمة إجرامية",
  Curses: "اللعنات",
  Cyberpunk: "سايبربانك",
  "Dark Fantasy": "فانتازيا مظلمة",
  Demons: "الشياطين",
  Detective: "التحقيق البوليسي",
  Disability: "الإعاقة",
  "Detailed Worldbuilding": "بناء عالم مفصّل",
  Dragons: "التنانين",
  Dungeons: "الزنزانات",
  Dystopia: "ديستوبيا",
  Education: "التعليم",
  "Ensemble Cast": "بطولة جماعية",
  Environment: "البيئة",
  Episodic: "حلقات مستقلة",
  "Epic Fantasy": "فانتازيا ملحمية",
  Espionage: "التجسس",
  "Fairy Tales": "حكايات خرافية",
  Family: "العائلة",
  "Family Life": "الحياة العائلية",
  "Female Protagonist": "بطلة",
  Folklore: "الموروث الشعبي",
  Football: "كرة القدم",
  "Found Family": "العائلة المختارة",
  Friendship: "الصداقة",
  Fugitive: "مطارد",
  Gods: "الآلهة",
  Grief: "الفقد",
  Guns: "الأسلحة النارية",
  Healing: "التعافي",
  "Hidden Identity": "هوية مخفية",
  Identity: "الهوية",
  "Idol Industry": "صناعة الآيدول",
  Immortality: "الخلود",
  "Intergenerational Conflict": "صراع الأجيال",
  Invention: "الاختراع",
  Investigation: "التحقيق",
  "Island Setting": "بيئة جزيرية",
  Kaiju: "وحوش عملاقة",
  "Literary Classic": "كلاسيكيات أدبية",
  "Lost Civilization": "حضارة مفقودة",
  "Love Triangle": "مثلث عاطفي",
  Magic: "السحر",
  "Male Protagonist": "بطل ذكر",
  Manipulation: "التلاعب",
  Marriage: "الزواج",
  "Martial Arts": "فنون قتالية",
  "Maritime Setting": "بيئة بحرية",
  Medicine: "الطب",
  Memory: "الذاكرة",
  "Mental Health": "الصحة النفسية",
  "Mind Games": "ألعاب ذهنية",
  Military: "عسكري",
  Monsters: "الوحوش",
  "Moral Ambiguity": "غموض أخلاقي",
  Mortality: "الفناء",
  "Murder Mystery": "لغز جريمة قتل",
  Mythology: "الأساطير",
  "Natural Disaster": "كارثة طبيعية",
  Necromancy: "استحضار الموتى",
  Neuroscience: "علم الأعصاب",
  "Nonhuman Characters": "شخصيات غير بشرية",
  "Otaku Culture": "ثقافة الأوتاكو",
  "Overpowered Protagonist": "بطل فائق القوة",
  "Parallel Worlds": "عوالم متوازية",
  Parenthood: "الأبوّة والأمومة",
  "Peace and Nonviolence": "السلام واللاعنف",
  Philosophy: "الفلسفة",
  Pirates: "القراصنة",
  Police: "الشرطة",
  "Political Intrigue": "مكائد سياسية",
  "Post-Apocalyptic": "ما بعد الكارثة",
  Prejudice: "التحيّز",
  "Prehistoric Life": "حياة ما قبل التاريخ",
  Propaganda: "الدعاية السياسية",
  Racing: "السباقات",
  Rebellion: "التمرد",
  Redemption: "الخلاص",
  Regret: "الندم",
  Reincarnation: "التناسخ",
  Religion: "الدين",
  "Rescue Mission": "مهمة إنقاذ",
  Revenge: "الانتقام",
  Rivalry: "التنافس",
  Robots: "الروبوتات",
  "Royal Court": "البلاط الملكي",
  "Rural Setting": "بيئة ريفية",
  Samurai: "الساموراي",
  School: "المدرسة",
  "School Club": "نادٍ مدرسي",
  "Sibling Relationship": "علاقة الأشقاء",
  Slavery: "العبودية",
  "Slow Burn": "تطور بطيء",
  "Social Anxiety": "القلق الاجتماعي",
  "Special Abilities": "قدرات خاصة",
  Spirits: "الأرواح",
  Steampunk: "ستيمبانك",
  "Student Council": "مجلس الطلبة",
  Survival: "البقاء",
  Swordplay: "المبارزة بالسيوف",
  "Tabletop Role-Playing": "ألعاب تقمص الأدوار الطاولة",
  "Teen Cast": "شخصيات مراهقة",
  Technology: "التقنية",
  "Time Loop": "حلقة زمنية",
  "Time Travel": "السفر عبر الزمن",
  Totalitarianism: "الشمولية",
  Toys: "الألعاب",
  Training: "التدريب",
  "Transported to Another World": "الانتقال إلى عالم آخر",
  Travel: "السفر",
  "Undercover Mission": "مهمة سرية",
  Underdog: "شخصية مستضعفة",
  "Urban Setting": "بيئة حضرية",
  "Video Games": "ألعاب الفيديو",
  "Virtual Reality": "الواقع الافتراضي",
  "Virtual World": "عالم افتراضي",
  Vikings: "الفايكنغ",
  "Weird Fiction": "خيال غرائبي",
  Witches: "الساحرات",
  Workplace: "مكان العمل",
  Writing: "الكتابة",
}

export const creatorRoles = [
  "author",
  "writer",
  "director",
  "illustrator",
  "main-studio",
  "developer",
  "publisher",
  "composer",
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
export const audienceSchema = z.enum(audiences)
export const countrySchema = z.enum(countries)
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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "استخدم تاريخاً بصيغة YYYY-MM-DD.")
  .refine(isCalendarDate, "استخدم تاريخاً صحيحاً.")

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
export type Audience = z.infer<typeof audienceSchema>
export type Country = z.infer<typeof countrySchema>

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
  arabicTitle: z.string().nullable().default(null),
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

export const adminWorkTransportSchema = workSchema
  .omit({
    addedAt: true,
    catalogUpdatedAt: true,
    personalUpdatedAt: true,
    palette: true,
    relations: true,
    calculatedRating: true,
  })
  .extend({
    genres: z.array(genreSchema),
    tone: z.array(toneSchema),
    relations: z.array(workRelationInputSchema),
  })

export const adminWorkUpdateSchema = adminWorkTransportSchema.superRefine(
  (work, context) => {
    if (work.tags.length > 12) {
      context.addIssue({
        code: "too_big",
        maximum: 12,
        origin: "array",
        inclusive: true,
        path: ["tags"],
        message: "اختر 12 وسماً قابلاً لإعادة الاستخدام كحد أقصى.",
      })
    }
    if (work.curation?.status !== "verified") return
    if (work.genres.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["genres"],
        message: "تحتاج الأعمال الموثّقة إلى تصنيف واحد على الأقل.",
      })
    }
    if (work.tone.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["tone"],
        message: "تحتاج الأعمال الموثّقة إلى طابع واحد على الأقل.",
      })
    }
    if (work.audience === null) {
      context.addIssue({
        code: "custom",
        path: ["audience"],
        message: "تحتاج الأعمال الموثّقة إلى جمهور مستهدف.",
      })
    }
  }
)
export type AdminWorkUpdate = z.infer<typeof adminWorkUpdateSchema>

export const adminRecordChangeSchema = z.object({
  workId: z.string().min(1),
  work: adminWorkTransportSchema.optional(),
  structure: editableWorkStructureSchema.optional(),
})

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
