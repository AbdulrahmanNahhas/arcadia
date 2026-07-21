import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { normalizeTaxonomy } from "@/features/library/taxonomy"
import {
  entities,
  personalState,
  terms,
  workCredits,
  workRelations,
  workTerms,
  workTitles,
  works,
} from "@/db/schema"

type LiteratureWork = {
  id: string
  title: string
  aliases: string[]
  kind: "manga" | "novel"
  year: number
  status: "planned" | "in-progress" | "completed"
  summary: string
  creator: string
  credits: Array<{ name: string; role: string }>
  genres: string[]
  tags: string[]
  tone: string[]
  country: string[]
  releaseStart: string
  releaseEnd?: string
  publication: {
    format: string
    publisher: string
    imprint?: string
    serialization?: string[]
    demographic?: string
    contents?: string[]
  }
  links: Array<{ provider: string; label: string; url: string }>
  sourceMaterial?: {
    type: string
    started: number | null
    finished: number | null
    serialization: string[]
    publication: string | null
  }
  riskProfile?: {
    sexuality: "none" | "low" | "medium" | "high" | "unknown"
    fanService: number | null
    behavioral: "none" | "low" | "medium" | "high" | "unknown"
    theology: "none" | "low" | "medium" | "high" | "unknown"
  }
}

const literature: LiteratureWork[] = [
  {
    id: "literature-manga-blue-box",
    title: "Blue Box",
    aliases: ["Ao no Hako", "アオのハコ"],
    kind: "manga",
    year: 2021,
    status: "in-progress",
    summary:
      "Taiki Inomata, a badminton player, falls for basketball star Chinatsu Kano and works toward the national championships while their lives become unexpectedly intertwined.",
    creator: "Kouji Miura",
    credits: [{ name: "Kouji Miura", role: "writer-artist" }],
    genres: ["Romance", "Sports", "Coming-of-age"],
    tags: ["School life", "Badminton", "Basketball", "Slow burn"],
    tone: ["Warm", "Earnest", "Hopeful"],
    country: ["Japan"],
    releaseStart: "2021-04-12",
    publication: {
      format: "Manga",
      publisher: "Shueisha",
      imprint: "Jump Comics",
      serialization: ["Weekly Shōnen Jump"],
      demographic: "Shōnen",
    },
    links: [
      {
        provider: "MANGA Plus",
        label: "Official English release",
        url: "https://mangaplus.shueisha.co.jp/titles/100157",
      },
    ],
    riskProfile: {
      sexuality: "low",
      fanService: 1,
      behavioral: "low",
      theology: "none",
    },
  },
  {
    id: "literature-manga-witchriv",
    title: "WITCHRIV",
    aliases: ["ウィッチリブ"],
    kind: "manga",
    year: 2025,
    status: "in-progress",
    summary:
      "Nonna is a witch hiding in human society, where fear of magic and the search for her missing mother pull her into a dangerous journey.",
    creator: "Hakuri",
    credits: [{ name: "Hakuri", role: "writer-artist" }],
    genres: ["Fantasy", "Adventure", "Drama"],
    tags: ["Witches", "Identity", "Found family", "Journey"],
    tone: ["Atmospheric", "Emotional", "Adventurous"],
    country: ["Japan"],
    releaseStart: "2025-10-23",
    publication: {
      format: "Manga",
      publisher: "Shueisha",
      imprint: "Jump Comics",
      serialization: ["Shōnen Jump+"],
      demographic: "Shōnen",
    },
    links: [
      {
        provider: "Shōnen Jump+",
        label: "Official series page",
        url: "https://www.shonenjump.com/j/rensai/list/witchriv.html",
      },
    ],
    riskProfile: {
      sexuality: "none",
      fanService: 0,
      behavioral: "medium",
      theology: "medium",
    },
  },
  {
    id: "literature-manga-solo-leveling",
    title: "Solo Leveling",
    aliases: ["Na Honjaman Level Up", "나 혼자만 레벨업"],
    kind: "manga",
    year: 2018,
    status: "completed",
    summary:
      "The world's weakest hunter, Sung Jinwoo, receives a strange ability that lets him grow stronger alone after surviving a deadly dungeon.",
    creator: "Chugong · h-goon · DUBU (REDICE Studio)",
    credits: [
      { name: "Chugong", role: "original-author" },
      { name: "h-goon", role: "adaptation" },
      { name: "DUBU", role: "artist" },
    ],
    genres: ["Action", "Fantasy", "Adventure"],
    tags: ["Dungeons", "Hunters", "Power progression", "Necromancy"],
    tone: ["Intense", "Power fantasy", "Dark"],
    country: ["South Korea"],
    releaseStart: "2018-03-04",
    releaseEnd: "2021-12-29",
    publication: {
      format: "Korean webtoon",
      publisher: "D&C Media",
      serialization: ["KakaoPage"],
    },
    links: [
      {
        provider: "WEBTOON",
        label: "Official English release",
        url: "https://www.webtoons.com/en/action/solo-leveling/list?title_no=3912",
      },
    ],
    sourceMaterial: {
      type: "Web novel",
      started: 2016,
      finished: 2018,
      serialization: ["KakaoPage"],
      publication: "D&C Media",
    },
    riskProfile: {
      sexuality: "low",
      fanService: 1,
      behavioral: "high",
      theology: "medium",
    },
  },
  {
    id: "literature-manga-three-days-of-happiness",
    title: "Three Days of Happiness",
    aliases: [
      "I Sold My Life for Ten Thousand Yen per Year",
      "Mikkakan no Koufuku",
    ],
    kind: "manga",
    year: 2016,
    status: "planned",
    summary:
      "With little left to lose, Kusunoki sells most of his remaining lifespan and discovers that the value of a life cannot be measured in money.",
    creator: "Sugaru Miaki · Shouichi Taguchi",
    credits: [
      { name: "Sugaru Miaki", role: "original-author" },
      { name: "Shouichi Taguchi", role: "artist" },
    ],
    genres: ["Drama", "Romance", "Psychological"],
    tags: ["Mortality", "Regret", "Loneliness", "Life choices"],
    tone: ["Melancholic", "Reflective", "Bittersweet"],
    country: ["Japan"],
    releaseStart: "2016-08-10",
    releaseEnd: "2017-10-18",
    publication: {
      format: "Manga adaptation",
      publisher: "Shueisha",
      serialization: ["Shōnen Jump+"],
      demographic: "Seinen",
    },
    links: [
      {
        provider: "MANGA Plus",
        label: "Publisher",
        url: "https://mangaplus.shueisha.co.jp/",
      },
    ],
    sourceMaterial: {
      type: "Novel",
      started: 2013,
      finished: 2013,
      serialization: [],
      publication: "MediaWorks Bunko",
    },
    riskProfile: {
      sexuality: "low",
      fanService: 0,
      behavioral: "medium",
      theology: "low",
    },
  },
  {
    id: "literature-manga-ichi-the-witch",
    title: "Ichi the Witch",
    aliases: ["Madogiwa no Ichi", "魔男のイチ"],
    kind: "manga",
    year: 2024,
    status: "planned",
    summary:
      "In a world where only women can become witches, a boy named Ichi defeats a magical creature and becomes the first male witch.",
    creator: "Osamu Nishi · Shiro Usazaki",
    credits: [
      { name: "Osamu Nishi", role: "writer" },
      { name: "Shiro Usazaki", role: "artist" },
    ],
    genres: ["Fantasy", "Adventure", "Comedy"],
    tags: ["Magic", "Witches", "Creatures", "Gender roles"],
    tone: ["Playful", "Inventive", "Adventurous"],
    country: ["Japan"],
    releaseStart: "2024-09-09",
    publication: {
      format: "Manga",
      publisher: "Shueisha",
      imprint: "Jump Comics",
      serialization: ["Weekly Shōnen Jump"],
      demographic: "Shōnen",
    },
    links: [
      {
        provider: "MANGA Plus",
        label: "Official English release",
        url: "https://mangaplus.shueisha.co.jp/",
      },
    ],
    riskProfile: {
      sexuality: "low",
      fanService: 1,
      behavioral: "medium",
      theology: "high",
    },
  },
  {
    id: "literature-manga-centuria",
    title: "Centuria",
    aliases: ["Kenturia", "ケントゥリア"],
    kind: "manga",
    year: 2024,
    status: "planned",
    summary:
      "A stowaway escapes slavery with a group of refugees, only to receive a terrible blessing that binds his life to the lives of one hundred others.",
    creator: "Tohru Kuramori",
    credits: [{ name: "Tohru Kuramori", role: "writer-artist" }],
    genres: ["Dark fantasy", "Adventure", "Drama"],
    tags: ["Slavery", "Curses", "Found family", "Survival"],
    tone: ["Dark", "Emotional", "Epic"],
    country: ["Japan"],
    releaseStart: "2024-04-14",
    publication: {
      format: "Manga",
      publisher: "Shueisha",
      imprint: "Jump Comics",
      serialization: ["Shōnen Jump+"],
      demographic: "Shōnen",
    },
    links: [
      {
        provider: "MANGA Plus",
        label: "Official English release",
        url: "https://mangaplus.shueisha.co.jp/",
      },
    ],
    riskProfile: {
      sexuality: "medium",
      fanService: 0,
      behavioral: "high",
      theology: "medium",
    },
  },
  {
    id: "literature-novel-animal-farm",
    title: "Animal Farm",
    aliases: ["Animal Farm: A Fairy Story"],
    kind: "novel",
    year: 1945,
    status: "in-progress",
    summary:
      "Farm animals overthrow their human owner and attempt to build an equal society, only to see their revolution transformed into another system of oppression.",
    creator: "George Orwell",
    credits: [{ name: "George Orwell", role: "author" }],
    genres: ["Political satire", "Allegory", "Classics"],
    tags: ["Totalitarianism", "Revolution", "Power", "Propaganda"],
    tone: ["Satirical", "Bleak", "Sharp"],
    country: ["United Kingdom"],
    releaseStart: "1945-08-17",
    publication: {
      format: "Novel",
      publisher: "Secker & Warburg",
    },
    links: [
      {
        provider: "George Orwell Library",
        label: "Text and publication record",
        url: "https://www.orwellfoundation.com/the-orwell-foundation/orwell/books-by-orwell/animal-farm/",
      },
    ],
    riskProfile: {
      sexuality: "none",
      fanService: 0,
      behavioral: "medium",
      theology: "low",
    },
  },
  {
    id: "literature-novel-mistborn-era-1",
    title: "Mistborn Era 1",
    aliases: ["The Original Mistborn Trilogy", "Mistborn: The Final Empire"],
    kind: "novel",
    year: 2006,
    status: "in-progress",
    summary:
      "In an empire ruled by an immortal tyrant, a gifted thief and a broken crew attempt the impossible: steal hope back for a world buried beneath ash.",
    creator: "Brandon Sanderson",
    credits: [{ name: "Brandon Sanderson", role: "author" }],
    genres: ["Epic fantasy", "High fantasy", "Adventure"],
    tags: ["Heist", "Magic system", "Rebellion", "Found family"],
    tone: ["Epic", "Inventive", "Hopeful"],
    country: ["United States"],
    releaseStart: "2006-07-17",
    releaseEnd: "2008-10-14",
    publication: {
      format: "Novel trilogy",
      publisher: "Tor Books",
      contents: [
        "Mistborn: The Final Empire",
        "The Well of Ascension",
        "The Hero of Ages",
      ],
    },
    links: [
      {
        provider: "Brandon Sanderson",
        label: "Official series guide",
        url: "https://www.brandonsanderson.com/pages/mistborn-the-original-trilogy",
      },
    ],
    riskProfile: {
      sexuality: "low",
      fanService: 0,
      behavioral: "high",
      theology: "medium",
    },
  },
]

function stableId(...parts: string[]) {
  return createHash("sha256")
    .update(parts.join(":"), "utf8")
    .digest("hex")
    .slice(0, 32)
}

function slug(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
}

const now = Math.floor(Date.now() / 1000)

db.transaction((tx) => {
  for (const item of literature) {
    const taxonomy = normalizeTaxonomy(item)
    tx.insert(works)
      .values({
        id: item.id,
        kind: item.kind,
        canonicalTitle: item.title,
        sortTitle: item.title.toLocaleLowerCase(),
        summary: item.summary,
        releaseYear: item.year,
        originalReleaseAt: Math.floor(
          new Date(`${item.releaseStart}T00:00:00Z`).getTime() / 1000
        ),
        status: item.releaseEnd ? "ended" : "releasing",
        metadata: {
          subtitle: item.aliases.join(" · "),
          aliases: item.aliases,
          creator: item.creator,
          genres: taxonomy.genres,
          tags: taxonomy.tags,
          tone: taxonomy.tone,
          country: item.country,
          riskProfile: item.riskProfile ?? null,
          externalLinks: item.links,
          releaseStart: item.releaseStart,
          releaseEnd: item.releaseEnd ?? null,
          publication: {
            format: item.publication.format,
            publisher: item.publication.publisher,
            imprint: item.publication.imprint ?? null,
            serialization: item.publication.serialization ?? [],
            demographic: item.publication.demographic ?? null,
            contents: item.publication.contents ?? [],
          },
          sourceMaterial: item.sourceMaterial ?? null,
          palette: item.kind === "novel" ? "archive" : "night",
          source: { type: "arcadia-literature-seed", seededAt: now },
        },
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: works.id,
        set: {
          kind: item.kind,
          canonicalTitle: item.title,
          sortTitle: item.title.toLocaleLowerCase(),
          summary: item.summary,
          releaseYear: item.year,
          originalReleaseAt: Math.floor(
            new Date(`${item.releaseStart}T00:00:00Z`).getTime() / 1000
          ),
          status: item.releaseEnd ? "ended" : "releasing",
          metadata: {
            subtitle: item.aliases.join(" · "),
            aliases: item.aliases,
            creator: item.creator,
            genres: taxonomy.genres,
            tags: taxonomy.tags,
            tone: taxonomy.tone,
            country: item.country,
            riskProfile: item.riskProfile ?? null,
            externalLinks: item.links,
            releaseStart: item.releaseStart,
            releaseEnd: item.releaseEnd ?? null,
            publication: {
              format: item.publication.format,
              publisher: item.publication.publisher,
              imprint: item.publication.imprint ?? null,
              serialization: item.publication.serialization ?? [],
              demographic: item.publication.demographic ?? null,
              contents: item.publication.contents ?? [],
            },
            sourceMaterial: item.sourceMaterial ?? null,
            palette: item.kind === "novel" ? "archive" : "night",
            source: { type: "arcadia-literature-seed", seededAt: now },
          },
          updatedAt: now,
        },
      })
      .run()
    tx.insert(personalState)
      .values({ workId: item.id, status: item.status, updatedAt: now })
      .onConflictDoUpdate({
        target: personalState.workId,
        set: { status: item.status, updatedAt: now },
      })
      .run()

    tx.delete(workTitles).where(eq(workTitles.workId, item.id)).run()
    for (const [position, title] of [item.title, ...item.aliases].entries()) {
      tx.insert(workTitles)
        .values({
          id: stableId("title", item.id, title),
          workId: item.id,
          title,
          titleType: position === 0 ? "canonical" : "alias",
          isPreferred: position === 0,
        })
        .run()
    }

    tx.delete(workCredits).where(eq(workCredits.workId, item.id)).run()
    for (const credit of item.credits) {
      const sortName = credit.name.toLocaleLowerCase()
      const entity = tx
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.entityType, "person"),
            eq(entities.sortName, sortName)
          )
        )
        .get()
      const entityId = entity?.id ?? stableId("entity", "person", sortName)
      if (!entity) {
        tx.insert(entities)
          .values({
            id: entityId,
            entityType: "person",
            name: credit.name,
            sortName,
          })
          .run()
      }
      tx.insert(workCredits)
        .values({ workId: item.id, entityId, role: credit.role })
        .run()
    }

    const vocabularies: Array<[string, string[]]> = [
      ["genre", taxonomy.genres],
      ["tag", taxonomy.tags],
      ["tone", taxonomy.tone],
      ["country", item.country],
    ]
    for (const [vocabulary, values] of vocabularies) {
      for (const name of values) {
        const generatedTermId = stableId("term", vocabulary, slug(name))
        tx.insert(terms)
          .values({ id: generatedTermId, vocabulary, name, slug: slug(name) })
          .onConflictDoNothing()
          .run()
        const term = tx
          .select({ id: terms.id })
          .from(terms)
          .where(
            and(eq(terms.vocabulary, vocabulary), eq(terms.slug, slug(name)))
          )
          .get()
        if (!term)
          throw new Error(`Could not create term: ${vocabulary}/${name}`)
        tx.insert(workTerms)
          .values({
            workId: item.id,
            termId: term.id,
            source: "arcadia-literature-seed",
          })
          .onConflictDoNothing()
          .run()
      }
    }
  }

  const adaptations = [
    ["obsidian-animation-tv-blue-box", "literature-manga-blue-box"],
    ["obsidian-animation-tv-solo-leveling", "literature-manga-solo-leveling"],
  ] as const
  for (const [sourceWorkId, targetWorkId] of adaptations) {
    const sourceExists = tx
      .select()
      .from(works)
      .where(eq(works.id, sourceWorkId))
      .get()
    if (!sourceExists) continue
    tx.delete(workRelations)
      .where(
        and(
          eq(workRelations.sourceWorkId, sourceWorkId),
          eq(workRelations.targetWorkId, targetWorkId),
          eq(workRelations.relationType, "adaptation")
        )
      )
      .run()
    tx.insert(workRelations)
      .values({
        id: stableId("relation", sourceWorkId, targetWorkId, "adaptation"),
        sourceWorkId,
        targetWorkId,
        relationType: "adaptation",
        notes: "",
      })
      .run()
  }
})

console.log(`Seeded ${literature.length} literature records.`)
