import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import {
  entities,
  externalLinks,
  terms,
  workCredits,
  works,
  workSeasons,
  workTerms,
  workTitles,
  workUnits,
} from "@/db/schema"
import type { Genre, Tone, WorkCredit } from "@/features/library/model"

type Link = {
  provider: string
  label: string
  url: string
  externalId?: string
}

type UnitSpec = {
  key: string
  type: "episode" | "chapter" | "volume"
  number: number
  position: number
  /** Optional enrichment only. Number and position are the canonical identity. */
  title?: string
  runtimeMinutes?: number
  pageCount?: number
}

type SeasonSpec = {
  key: string
  title: string
  number: number
  position: number
  releaseAt?: number
  runtimeMinutes?: number
  announcedUnitCount?: number
  units: UnitSpec[]
}

type GoldWork = {
  id: string
  title: string
  aliases: Array<{
    title: string
    titleType: "alias" | "localized" | "original"
    language?: string
    script?: string
  }>
  kind: "anime" | "manga" | "novel"
  year: number
  releaseStatus: "announced" | "releasing" | "released" | "ended" | "unknown"
  summary: string
  originalReleaseAt: number
  runtimeMinutes?: number
  pageCount?: number
  episodeCount?: number
  chapterCount?: number
  metadata: Record<string, unknown>
  genres: Genre[]
  tones: Tone[]
  tags: string[]
  audiences: string[]
  countries: string[]
  credits: Array<Omit<WorkCredit, "entityId">>
  links: Link[]
  seasons?: SeasonSpec[]
  units?: UnitSpec[]
}

const epoch = (date: string) =>
  Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)
const numberedUnits = (count: number, type: UnitSpec["type"]): UnitSpec[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `${type}-${index + 1}`,
    type,
    number: index + 1,
    position: index,
  }))

const sharedCuration = {
  reviewedAt: "2026-07-23",
  status: "verified",
  notes:
    "Reference-quality normalized record; factual fields verified against canonical catalog sources.",
} as const

const goldWorks: GoldWork[] = [
  {
    id: "obsidian-animation-tv-frieren-beyond-journeys-end",
    title: "Frieren: Beyond Journey's End",
    aliases: [
      {
        title: "葬送のフリーレン",
        titleType: "original",
        language: "ja",
        script: "Jpan",
      },
      {
        title: "Sōsō no Furīren",
        titleType: "alias",
        language: "ja-Latn",
        script: "Latn",
      },
    ],
    kind: "anime",
    year: 2023,
    releaseStatus: "releasing",
    summary:
      "Decades after defeating the Demon King, the near-immortal elven mage Frieren retraces the heroes' journey. Traveling with a new generation, she slowly learns how brief human lives give memory, grief, and companionship their meaning.",
    originalReleaseAt: epoch("2023-09-29"),
    episodeCount: 38,
    genres: ["Adventure", "Drama", "Fantasy"],
    tones: ["Reflective", "Emotional", "Atmospheric", "Epic", "Wholesome"],
    tags: [
      "after-the-quest",
      "immortality",
      "grief",
      "memory",
      "found-family",
      "magic",
      "journey",
      "elves",
      "manga-adaptation",
    ],
    audiences: ["Teen"],
    countries: ["Japan"],
    credits: [
      {
        name: "Kanehito Yamada",
        entityType: "person",
        role: "creator",
      },
      {
        name: "Tsukasa Abe",
        entityType: "person",
        role: "creator",
      },
      {
        name: "Keiichirō Saitō",
        entityType: "person",
        role: "director",
      },
      {
        name: "Tomoya Kitagawa",
        entityType: "person",
        role: "director",
      },
      {
        name: "Madhouse",
        entityType: "studio",
        role: "main-studio",
      },
    ],
    links: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/anime/154587/Sousou-no-Frieren/",
        externalId: "154587",
      },
      {
        provider: "myanimelist",
        label: "MyAnimeList",
        url: "https://myanimelist.net/anime/52991/Sousou_no_Frieren",
        externalId: "52991",
      },
      {
        provider: "imdb",
        label: "IMDb",
        url: "https://www.imdb.com/title/tt22248376/",
        externalId: "tt22248376",
      },
      {
        provider: "official",
        label: "Official site",
        url: "https://frieren-anime.jp/",
      },
      {
        provider: "wikipedia",
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Frieren_(TV_series)",
      },
    ],
    metadata: {
      subtitle:
        "A quiet fantasy about time, memory, and learning to know people",
      releaseStart: "2023-09-29",
      releaseEnd: null,
      sourceMaterial: {
        type: "manga",
        started: 2020,
        finished: null,
        serialization: ["Weekly Shōnen Sunday"],
        publication: "Shogakukan",
      },
      publication: null,
      contentWarnings:
        "Fantasy violence, death, grief, demons, and occasional frightening imagery.",
      analysisNotes:
        "The story is structured as a post-adventure journey: episodic encounters repeatedly reframe earlier memories rather than escalating through a conventional quest alone.",
      riskProfile: {
        sexuality: "low",
        fanService: 1,
        behavioral: "low",
        theology: "medium",
      },
      curation: sharedCuration,
    },
    seasons: [
      {
        key: "season-1",
        title: "Season 1",
        number: 1,
        position: 0,
        releaseAt: epoch("2023-09-29"),
        units: numberedUnits(28, "episode"),
      },
      {
        key: "season-2",
        title: "Season 2",
        number: 2,
        position: 1,
        releaseAt: epoch("2026-01-16"),
        units: numberedUnits(10, "episode"),
      },
      {
        key: "season-3",
        title: "Season 3",
        number: 3,
        position: 2,
        releaseAt: epoch("2027-10-01"),
        units: [],
      },
    ],
  },
  {
    id: "obsidian-animation-tv-attack-on-titan",
    title: "Attack on Titan",
    aliases: [
      {
        title: "進撃の巨人",
        titleType: "original",
        language: "ja",
        script: "Jpan",
      },
      {
        title: "Shingeki no Kyojin",
        titleType: "alias",
        language: "ja-Latn",
        script: "Latn",
      },
    ],
    kind: "anime",
    year: 2013,
    releaseStatus: "ended",
    summary:
      "Humanity survives behind enormous walls until a catastrophic breach sends Eren Yeager into a war against the Titans. The struggle expands into a political and moral conflict over inherited violence, freedom, identity, and the history hidden beyond the walls.",
    originalReleaseAt: epoch("2013-04-07"),
    episodeCount: 94,
    genres: [
      "Action",
      "Drama",
      "Fantasy",
      "Horror",
      "Military",
      "Mystery",
      "Political",
      "Psychological",
      "Thriller",
    ],
    tones: ["Dark", "Tense", "Epic", "Emotional", "Reflective"],
    tags: [
      "war",
      "dystopia",
      "survival",
      "body-horror",
      "moral-ambiguity",
      "revenge",
      "conspiracy",
      "post-apocalyptic",
      "ensemble-cast",
      "manga-adaptation",
    ],
    audiences: ["Mature"],
    countries: ["Japan"],
    credits: [
      {
        name: "Hajime Isayama",
        entityType: "person",
        role: "creator",
      },
      {
        name: "Tetsurō Araki",
        entityType: "person",
        role: "director",
      },
      {
        name: "Masashi Koizuka",
        entityType: "person",
        role: "director",
      },
      {
        name: "Yuichirō Hayashi",
        entityType: "person",
        role: "director",
      },
      {
        name: "Wit Studio",
        entityType: "studio",
        role: "main-studio",
      },
      {
        name: "MAPPA",
        entityType: "studio",
        role: "main-studio",
      },
    ],
    links: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/anime/16498/Shingeki-no-Kyojin/",
        externalId: "16498",
      },
      {
        provider: "myanimelist",
        label: "MyAnimeList",
        url: "https://myanimelist.net/anime/16498/Shingeki_no_Kyojin",
        externalId: "16498",
      },
      {
        provider: "imdb",
        label: "IMDb",
        url: "https://www.imdb.com/title/tt2560140/",
        externalId: "tt2560140",
      },
      {
        provider: "official",
        label: "Official site",
        url: "https://shingeki.tv/",
      },
      {
        provider: "wikipedia",
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Attack_on_Titan_(TV_series)",
      },
    ],
    metadata: {
      subtitle:
        "A war epic about freedom, inherited violence, and the stories nations tell",
      releaseStart: "2013-04-07",
      releaseEnd: "2023-11-05",
      sourceMaterial: {
        type: "manga",
        started: 2009,
        finished: 2021,
        serialization: ["Bessatsu Shōnen Magazine"],
        publication: "Kodansha",
      },
      publication: null,
      contentWarnings:
        "Graphic violence, body horror, mass death, genocide, warfare, torture, child endangerment, and suicide.",
      analysisNotes:
        "The series deliberately changes genre and political scale across its seasons; later revelations recast the apparent monster-survival premise as a cycle of nationalism and retaliatory violence.",
      riskProfile: {
        sexuality: "low",
        fanService: 1,
        behavioral: "high",
        theology: "medium",
      },
      curation: sharedCuration,
    },
    seasons: [
      {
        key: "season-1",
        title: "Season 1",
        number: 1,
        position: 0,
        releaseAt: epoch("2013-04-07"),
        units: numberedUnits(25, "episode"),
      },
      {
        key: "season-2",
        title: "Season 2",
        number: 2,
        position: 1,
        releaseAt: epoch("2017-04-01"),
        units: numberedUnits(12, "episode"),
      },
      {
        key: "season-3",
        title: "Season 3",
        number: 3,
        position: 2,
        releaseAt: epoch("2018-07-23"),
        units: numberedUnits(22, "episode"),
      },
      {
        key: "final-season",
        title: "The Final Season",
        number: 4,
        position: 3,
        releaseAt: epoch("2020-12-07"),
        units: numberedUnits(35, "episode"),
      },
    ],
  },
  {
    id: "83bc45c9-4ebc-4650-a726-02450352f506",
    title: "Yumi and the Nightmare Painter",
    aliases: [],
    kind: "novel",
    year: 2023,
    releaseStatus: "released",
    summary:
      "Yumi, a spirit-calling virtuoso bound by duty, and Painter, a lonely artist who protects his city from nightmares, abruptly begin exchanging places. To restore their lives, they must master each other's art and confront the hidden system connecting their worlds.",
    originalReleaseAt: epoch("2023-07-01"),
    pageCount: 480,
    chapterCount: 43,
    genres: ["Fantasy", "Romance", "Sci-Fi"],
    tones: ["Wholesome", "Emotional", "Reflective", "Atmospheric", "Epic"],
    tags: [
      "cosmere",
      "identity-exchange",
      "spirits",
      "art",
      "nightmares",
      "dual-worlds",
      "slow-burn",
      "standalone",
    ],
    audiences: ["Adult"],
    countries: ["United States"],
    credits: [
      {
        name: "Brandon Sanderson",
        entityType: "person",
        role: "author",
      },
      {
        name: "Dragonsteel Entertainment",
        entityType: "publisher",
        role: "publisher",
      },
    ],
    links: [
      {
        provider: "goodreads",
        label: "Goodreads",
        url: "https://www.goodreads.com/book/show/60726999-yumi-and-the-nightmare-painter",
        externalId: "60726999",
      },
      {
        provider: "official",
        label: "Official author page",
        url: "https://www.brandonsanderson.com/blogs/blog/tagged/yumi-and-the-nightmare-painter",
      },
      {
        provider: "wikipedia",
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Yumi_and_the_Nightmare_Painter",
      },
    ],
    metadata: {
      subtitle:
        "A Cosmere standalone about art, duty, and two lives out of place",
      releaseStart: "2023-07-01",
      releaseEnd: "2023-07-01",
      sourceMaterial: null,
      publication: {
        format: "Novel",
        publisher: "Dragonsteel Entertainment",
        imprint: null,
        serialization: [],
        contents: ["41 chapters", "2 epilogues"],
      },
      contentWarnings:
        "Nightmare imagery, emotional manipulation, isolation, death, and restrictive religious authority.",
      analysisNotes:
        "A self-contained Cosmere novel. Its paired magic systems treat disciplined artistic practice as both plot mechanism and a language for intimacy.",
      riskProfile: {
        sexuality: "low",
        fanService: 1,
        behavioral: "medium",
        theology: "medium",
      },
      curation: sharedCuration,
    },
    units: [
      ...numberedUnits(41, "chapter"),
      {
        key: "epilogue-1",
        type: "chapter",
        number: 42,
        position: 41,
        title: "Epilogue I",
      },
      {
        key: "epilogue-2",
        type: "chapter",
        number: 43,
        position: 42,
        title: "Epilogue II",
      },
    ],
  },
  {
    id: "5f659e22-3491-40f9-87c0-5a8950925001",
    title: "Nineteen Eighty-Four",
    aliases: [{ title: "1984", titleType: "alias", language: "en" }],
    kind: "novel",
    year: 1949,
    releaseStatus: "released",
    summary:
      "In Oceania, where the Party controls language, history, and even private thought, Winston Smith quietly resists by keeping a forbidden diary. His search for truth and intimacy becomes a confrontation with a state designed to make objective reality impossible.",
    originalReleaseAt: epoch("1949-06-08"),
    pageCount: 328,
    chapterCount: 24,
    genres: ["Drama", "Political", "Psychological", "Sci-Fi", "Thriller"],
    tones: ["Dark", "Tense", "Reflective"],
    tags: [
      "dystopia",
      "totalitarianism",
      "surveillance",
      "propaganda",
      "censorship",
      "language",
      "authoritarianism",
      "classic",
    ],
    audiences: ["Adult"],
    countries: ["United Kingdom"],
    credits: [
      {
        name: "George Orwell",
        entityType: "person",
        role: "author",
      },
      {
        name: "Secker & Warburg",
        entityType: "publisher",
        role: "publisher",
      },
    ],
    links: [
      {
        provider: "goodreads",
        label: "Goodreads",
        url: "https://www.goodreads.com/book/show/5470.1984",
        externalId: "5470",
      },
      {
        provider: "official",
        label: "Penguin",
        url: "https://www.penguin.co.uk/books/57013/nineteen-eighty-four-by-orwell-george/9780241341650",
      },
      {
        provider: "wikipedia",
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Nineteen_Eighty-Four",
      },
    ],
    metadata: {
      subtitle: "A dystopian novel about power, language, memory, and truth",
      releaseStart: "1949-06-08",
      releaseEnd: "1949-06-08",
      sourceMaterial: null,
      publication: {
        format: "Novel",
        publisher: "Secker & Warburg",
        imprint: null,
        serialization: [],
        contents: ["Part One", "Part Two", "Part Three"],
      },
      contentWarnings:
        "Torture, psychological abuse, state violence, surveillance, sexual coercion, execution references, and hopelessness.",
      analysisNotes:
        "The novel's central mechanism is epistemic control: Newspeak, historical revision, and doublethink show political power operating by narrowing what can be said, remembered, and finally believed.",
      riskProfile: {
        sexuality: "medium",
        fanService: 0,
        behavioral: "high",
        theology: "low",
      },
      curation: sharedCuration,
    },
    seasons: [
      {
        key: "part-1",
        title: "Part One",
        number: 1,
        position: 0,
        units: numberedUnits(8, "chapter"),
      },
      {
        key: "part-2",
        title: "Part Two",
        number: 2,
        position: 1,
        units: numberedUnits(10, "chapter"),
      },
      {
        key: "part-3",
        title: "Part Three",
        number: 3,
        position: 2,
        units: numberedUnits(6, "chapter"),
      },
    ],
  },
  {
    id: "literature-manga-blue-box",
    title: "Blue Box",
    aliases: [
      {
        title: "アオのハコ",
        titleType: "original",
        language: "ja",
        script: "Jpan",
      },
      {
        title: "Ao no Hako",
        titleType: "alias",
        language: "ja-Latn",
        script: "Latn",
      },
    ],
    kind: "manga",
    year: 2021,
    releaseStatus: "ended",
    summary:
      "Badminton player Taiki Inomata admires basketball star Chinatsu Kano from across their shared school gym. When circumstances bring them under the same roof, his athletic ambitions and first love develop together through daily practice, setbacks, and quiet acts of support.",
    originalReleaseAt: epoch("2021-04-12"),
    chapterCount: 250,
    genres: ["Drama", "Romance", "Slice of Life", "Sports"],
    tones: ["Wholesome", "Emotional", "Reflective"],
    tags: [
      "badminton",
      "basketball",
      "school-life",
      "coming-of-age",
      "slow-burn",
      "cohabitation",
      "competition",
    ],
    audiences: ["Teen"],
    countries: ["Japan"],
    credits: [
      {
        name: "Kouji Miura",
        entityType: "person",
        role: "author",
      },
      {
        name: "Shueisha",
        entityType: "publisher",
        role: "publisher",
      },
    ],
    links: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/manga/132182/Ao-no-Hako/",
        externalId: "132182",
      },
      {
        provider: "myanimelist",
        label: "MyAnimeList",
        url: "https://myanimelist.net/manga/135545/Ao_no_Hako",
        externalId: "135545",
      },
      {
        provider: "official",
        label: "VIZ",
        url: "https://www.viz.com/blue-box",
      },
      {
        provider: "wikipedia",
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Blue_Box_(manga)",
      },
    ],
    metadata: {
      subtitle:
        "A school sports romance built on practice, patience, and proximity",
      releaseStart: "2021-04-12",
      releaseEnd: "2026-07-13",
      sourceMaterial: null,
      publication: {
        format: "Manga",
        publisher: "Shueisha",
        imprint: "Jump Comics",
        serialization: ["Weekly Shōnen Jump"],
        contents: ["250 chapters", "28 volumes"],
      },
      contentWarnings:
        "Romantic disappointment, competitive pressure, injury, and mild adolescent jealousy.",
      analysisNotes:
        "Athletic progress and romantic progress share the same rhythm: repetition, incremental improvement, and the willingness to keep showing up.",
      riskProfile: {
        sexuality: "low",
        fanService: 1,
        behavioral: "low",
        theology: "none",
      },
      curation: sharedCuration,
    },
    units: numberedUnits(250, "chapter"),
  },
  {
    id: "literature-manga-three-days-of-happiness",
    title: "Three Days of Happiness",
    aliases: [
      {
        title: "寿命を買い取ってもらった。一年につき、一万円で。",
        titleType: "original",
        language: "ja",
        script: "Jpan",
      },
      {
        title: "I Sold My Life for Ten Thousand Yen per Year",
        titleType: "alias",
        language: "en",
      },
      {
        title: "Jumyō o Kaitotte Moratta. Ichinen ni Tsuki, Ichimanen de.",
        titleType: "alias",
        language: "ja-Latn",
        script: "Latn",
      },
    ],
    kind: "manga",
    year: 2016,
    releaseStatus: "ended",
    summary:
      "Twenty-year-old Kusunoki sells nearly all of his remaining lifespan and is left with only three months. Watched by the observer Miyagi, he begins to reconsider the value of time, connection, and a life he had assumed was already beyond repair.",
    originalReleaseAt: epoch("2016-08-10"),
    chapterCount: 18,
    genres: ["Drama", "Psychological", "Romance", "Supernatural"],
    tones: ["Bittersweet", "Reflective", "Emotional", "Dark"],
    tags: [
      "mortality",
      "loneliness",
      "regret",
      "limited-lifespan",
      "existentialism",
      "life-value",
      "manga-adaptation",
    ],
    audiences: ["Mature"],
    countries: ["Japan"],
    credits: [
      {
        name: "Sugaru Miaki",
        entityType: "person",
        role: "creator",
      },
      {
        name: "Shouichi Taguchi",
        entityType: "person",
        role: "author",
      },
      {
        name: "Shueisha",
        entityType: "publisher",
        role: "publisher",
      },
    ],
    links: [
      {
        provider: "anilist",
        label: "AniList",
        url: "https://anilist.co/manga/98361/Mikkakan-no-Koufuku/",
        externalId: "98361",
      },
      {
        provider: "myanimelist",
        label: "MyAnimeList",
        url: "https://myanimelist.net/manga/100448/Jumyou_wo_Kaitotte_Moratta_Ichinen_ni_Tsuki_Ichimanen_de",
        externalId: "100448",
      },
      {
        provider: "wikipedia",
        label: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Three_Days_of_Happiness",
      },
    ],
    metadata: {
      subtitle: "A brief existential romance about what makes a life valuable",
      releaseStart: "2016-08-10",
      releaseEnd: "2017-10-25",
      sourceMaterial: {
        type: "novel",
        started: 2013,
        finished: 2013,
        serialization: [],
        publication: "ASCII Media Works",
      },
      publication: {
        format: "Manga",
        publisher: "Shueisha",
        imprint: "Jump Comics+",
        serialization: ["Shōnen Jump+"],
        contents: ["18 chapters", "3 volumes"],
      },
      contentWarnings:
        "Suicidal ideation, depression, poverty, death, terminal lifespan, emotional abuse, and existential despair.",
      analysisNotes:
        "The speculative transaction gives the story a literal price for lifespan, then steadily separates market value from lived value through attention, sacrifice, and companionship.",
      riskProfile: {
        sexuality: "low",
        fanService: 0,
        behavioral: "high",
        theology: "low",
      },
      curation: sharedCuration,
    },
    units: numberedUnits(18, "chapter"),
  },
]

function slug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function stableId(...parts: string[]) {
  return `gold-${parts.map(slug).join("-")}`
}

function curateWork(spec: GoldWork) {
  const current = db.select().from(works).where(eq(works.id, spec.id)).get()
  if (!current) throw new Error(`Required work not found: ${spec.id}`)
  const now = Math.floor(Date.now() / 1000)
  const currentMetadata = current.metadata

  db.transaction((tx) => {
    tx.update(works)
      .set({
        kind: spec.kind,
        canonicalTitle: spec.title,
        sortTitle: spec.title.toLocaleLowerCase(),
        summary: spec.summary,
        releaseYear: spec.year,
        originalReleaseAt: spec.originalReleaseAt,
        runtimeMinutes: spec.runtimeMinutes ?? null,
        pageCount: spec.pageCount ?? null,
        episodeCount: spec.episodeCount ?? null,
        chapterCount: spec.chapterCount ?? null,
        status: spec.releaseStatus,
        metadata: {
          ...spec.metadata,
          palette: currentMetadata.palette,
          sharedWith: currentMetadata.sharedWith ?? [],
          scoreBreakdown: currentMetadata.scoreBreakdown ?? {},
          watchDates: currentMetadata.watchDates ?? null,
        },
        updatedAt: now,
      })
      .where(eq(works.id, spec.id))
      .run()

    tx.delete(workTitles).where(eq(workTitles.workId, spec.id)).run()
    tx.insert(workTitles)
      .values({
        id: stableId(spec.id, "title", "canonical"),
        workId: spec.id,
        title: spec.title,
        titleType: "canonical",
        isPreferred: true,
      })
      .run()
    for (const [index, alias] of spec.aliases.entries()) {
      tx.insert(workTitles)
        .values({
          id: stableId(spec.id, "title", String(index)),
          workId: spec.id,
          title: alias.title,
          titleType: alias.titleType,
          language: alias.language,
          script: alias.script,
        })
        .run()
    }

    const vocabularies = ["genre", "tone", "tag", "audience", "country"]
    const existingTerms = tx
      .select({ id: terms.id })
      .from(terms)
      .where(inArray(terms.vocabulary, vocabularies))
      .all()
    if (existingTerms.length > 0) {
      tx.delete(workTerms)
        .where(
          and(
            eq(workTerms.workId, spec.id),
            inArray(
              workTerms.termId,
              existingTerms.map(({ id }) => id)
            )
          )
        )
        .run()
    }
    for (const [vocabulary, values] of Object.entries({
      genre: spec.genres,
      tone: spec.tones,
      tag: spec.tags,
      audience: spec.audiences,
      country: spec.countries,
    })) {
      for (const name of values) {
        const termSlug = slug(name)
        let term = tx
          .select()
          .from(terms)
          .where(
            and(eq(terms.vocabulary, vocabulary), eq(terms.slug, termSlug))
          )
          .get()
        if (!term) {
          const id = stableId("term", vocabulary, termSlug)
          tx.insert(terms)
            .values({ id, vocabulary, name, slug: termSlug })
            .run()
          term = tx.select().from(terms).where(eq(terms.id, id)).get()
        }
        if (!term)
          throw new Error(`Could not create term ${vocabulary}:${name}`)
        tx.insert(workTerms)
          .values({
            workId: spec.id,
            termId: term.id,
            source: "curated",
          })
          .run()
      }
    }

    tx.delete(workCredits).where(eq(workCredits.workId, spec.id)).run()
    for (const [position, credit] of spec.credits.entries()) {
      const entityType =
        credit.role === "main-studio"
          ? "studio"
          : credit.role === "publisher"
            ? "publisher"
            : credit.entityType
      const sortName = credit.name.trim().toLocaleLowerCase()
      let entity = tx
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.entityType, entityType),
            eq(entities.sortName, sortName)
          )
        )
        .get()
      if (!entity) {
        const id = stableId("entity", entityType, credit.name)
        tx.insert(entities)
          .values({
            id,
            entityType,
            name: credit.name,
            sortName,
          })
          .run()
        entity = tx.select().from(entities).where(eq(entities.id, id)).get()
      }
      if (!entity) throw new Error(`Could not create entity ${credit.name}`)
      tx.insert(workCredits)
        .values({
          workId: spec.id,
          entityId: entity.id,
          role: credit.role,
          position,
        })
        .run()
    }

    tx.delete(externalLinks)
      .where(
        and(
          eq(externalLinks.ownerType, "work"),
          eq(externalLinks.ownerId, spec.id)
        )
      )
      .run()
    for (const link of spec.links) {
      tx.insert(externalLinks)
        .values({
          id: stableId(spec.id, "link", link.provider),
          ownerType: "work",
          ownerId: spec.id,
          ...link,
        })
        .run()
    }

    for (const season of spec.seasons ?? []) {
      const seasonId = stableId(spec.id, season.key)
      const calculatedRuntime =
        season.runtimeMinutes ??
        season.units.reduce((sum, unit) => sum + (unit.runtimeMinutes ?? 0), 0)
      const calculatedUnitCount =
        season.announcedUnitCount ?? season.units.length
      tx.insert(workSeasons)
        .values({
          id: seasonId,
          workId: spec.id,
          title: season.title,
          seasonNumber: season.number,
          position: season.position,
          runtimeMinutes: calculatedRuntime || null,
          unitCount: calculatedUnitCount || null,
          releaseAt: season.releaseAt,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: workSeasons.id,
          set: {
            title: season.title,
            seasonNumber: season.number,
            position: season.position,
            runtimeMinutes: calculatedRuntime || null,
            unitCount: calculatedUnitCount || null,
            releaseAt: season.releaseAt,
            updatedAt: now,
          },
        })
        .run()
      for (const unit of season.units) {
        upsertUnit(
          tx,
          spec.id,
          seasonId,
          `${season.key}-${unit.key}`,
          unit,
          now
        )
      }
    }
    for (const unit of spec.units ?? []) {
      upsertUnit(tx, spec.id, null, unit.key, unit, now)
    }
  })
}

function upsertUnit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workId: string,
  seasonId: string | null,
  key: string,
  unit: UnitSpec,
  now: number
) {
  const id = stableId(workId, key)
  const values = {
    id,
    workId,
    seasonId,
    unitType: unit.type,
    title: unit.title ?? null,
    unitNumber: unit.number,
    position: unit.position,
    runtimeMinutes: unit.runtimeMinutes ?? null,
    pageCount: unit.pageCount ?? null,
    createdAt: now,
    updatedAt: now,
  }
  tx.insert(workUnits)
    .values(values)
    .onConflictDoUpdate({
      target: workUnits.id,
      set: {
        seasonId,
        unitType: unit.type,
        title: unit.title ?? null,
        unitNumber: unit.number,
        position: unit.position,
        runtimeMinutes: unit.runtimeMinutes ?? null,
        pageCount: unit.pageCount ?? null,
        updatedAt: now,
      },
    })
    .run()
}

for (const spec of goldWorks) curateWork(spec)

console.log(
  `Curated ${goldWorks.length} gold-standard records: ${goldWorks
    .map(({ title }) => title)
    .join(", ")}`
)
