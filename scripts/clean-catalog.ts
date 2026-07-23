import { createHash } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import {
  externalLinks as externalLinksTable,
  terms,
  workTerms,
  works,
} from "@/db/schema"
import { normalizeTaxonomy } from "@/features/library/taxonomy"

type Metadata = Record<string, unknown> & {
  genres?: string[]
  tags?: string[]
  tone?: string[]
  externalLinks?: Array<{ provider: string; label: string; url: string }>
  releaseStart?: string | null
  releaseEnd?: string | null
  riskProfile?: {
    sexuality?: string
    fanService?: number | null
    behavioral?: string
    theology?: string
  } | null
}

type Override = {
  title?: string
  year?: number | null
  summary?: string
  releaseStart?: string | null
  releaseEnd?: string | null
  releaseWindow?: string
  genres?: string[]
  tags?: string[]
  tone?: string[]
  links?: Array<{ provider: string; label: string; url: string }>
  releaseStatus?: "announced" | "releasing" | "released" | "ended"
  sourceMaterial?: {
    type: string
    started: number | null
    finished: number | null
    serialization: string[]
    publication: string | null
  }
  provisional?: string
}

const reviewedAt = "2026-07-19"

const overrides = new Map<string, Override>([
  [
    "Gachiakuta",
    {
      summary:
        "Rudo, an orphan from a segregated slum, is falsely accused of murder and cast into the Pit, where he joins the Cleaners and learns to draw power from discarded objects.",
      tags: [
        "class-conflict",
        "false-accusation",
        "waste",
        "special-abilities",
      ],
      tone: ["Dark", "Intense", "Defiant"],
      links: [
        {
          provider: "official",
          label: "Official anime site",
          url: "https://gachiakuta-anime.com/en/",
        },
      ],
    },
  ],
  [
    "Genshin",
    {
      title: "Genshin Impact Animation Project",
      summary:
        "A long-term animation project from HoYoverse and ufotable based on the world of Genshin Impact. Its story format and release date have not yet been announced.",
      releaseWindow: "TBA",
      tags: [
        "game-adaptation",
        "elemental-magic",
        "adventure",
        "worldbuilding",
      ],
      tone: ["Adventurous", "Epic", "Atmospheric"],
      releaseStatus: "announced",
      provisional:
        "The project is active, but its format, date, and content guidance remain unannounced.",
    },
  ],
  [
    "Historie",
    {
      year: 2027,
      releaseWindow: "January 2027",
      releaseStatus: "announced",
      provisional:
        "Broadcast is announced for January 2027; content guidance is based on the published source material until release.",
    },
  ],
  [
    "Jaadugar: A Witch in Mongolia",
    {
      summary:
        "After losing her mother and homeland, the gifted Sitara is taken in by a scholarly family and pursues knowledge before becoming entangled with an empress and a shared desire for revenge.",
      tags: ["mongol-empire", "scholarship", "revenge", "historical-fiction"],
      tone: ["Historical", "Dramatic", "Epic"],
      links: [
        {
          provider: "official",
          label: "Official anime site",
          url: "https://anime-jaadugar.com/en/author/admin_jaadugar/",
        },
      ],
    },
  ],
  [
    "Lona",
    {
      title: "LONA",
      year: 2027,
      summary:
        "In the near future, researchers at the Laboratory of Optics and Neural Analysis investigate memories left in the brains of the dead as humanity faces attacks by people who should no longer be alive.",
      releaseWindow: "Spring 2027",
      tags: ["neuroscience", "memory", "researchers", "near-future"],
      tone: ["Mysterious", "Atmospheric", "Tense"],
      releaseStatus: "announced",
      links: [
        {
          provider: "official",
          label: "Official anime site",
          url: "https://lona-animation.com/",
        },
      ],
      provisional:
        "Premiere is announced for spring 2027; content guidance remains provisional until release.",
    },
  ],
  [
    "Ranking of Kings",
    {
      summary:
        "Bojji, a young deaf prince dismissed as powerless, dreams of becoming the world's greatest king and finds his first true friend in the shadow creature Kage.",
      tone: ["Heartfelt", "Hopeful", "Dark"],
    },
  ],
  [
    "The Bugle Call: Song of War",
    {
      year: 2027,
      summary:
        "Luca, a bugler marked by a supernatural branch and able to see the sound of his instrument, is drawn into a vast war where music can alter the battlefield.",
      releaseWindow: "2027",
      tags: ["war", "music", "special-abilities", "military"],
      tone: ["Epic", "Intense", "Dramatic"],
      releaseStatus: "announced",
      provisional:
        "Broadcast is announced for 2027; content guidance is based on the manga until the anime premieres.",
    },
  ],
  [
    "Solo Leveling",
    {
      sourceMaterial: {
        type: "Web novel",
        started: 2016,
        finished: 2018,
        serialization: ["KakaoPage"],
        publication: "D&C Media",
      },
    },
  ],
  [
    "Three Days of Happiness",
    {
      sourceMaterial: {
        type: "Novel",
        started: 2013,
        finished: 2013,
        serialization: [],
        publication: "MediaWorks Bunko",
      },
    },
  ],
  [
    "Vivy -Fluorite Eye's Song-",
    {
      summary:
        "Vivy, the first autonomous humanoid AI and a struggling singer, joins an AI from one hundred years in the future to rewrite key events and prevent a devastating war between humans and AI.",
      tone: ["Emotional", "Epic", "Bittersweet"],
      links: [
        {
          provider: "official",
          label: "Official series site",
          url: "https://vivy-anime.com/",
        },
      ],
    },
  ],
  [
    "Ghost (Provisional Title)",
    {
      title: "ghost (Working Title)",
      year: 2027,
      summary:
        "An original theatrical anime written and directed by Shingo Natsume and produced by MADHOUSE. Story details have not yet been disclosed.",
      releaseWindow: "2027",
      tags: ["original-anime", "supernatural", "theatrical-film"],
      tone: ["Atmospheric", "Mysterious"],
      releaseStatus: "announced",
      links: [
        {
          provider: "official",
          label: "MADHOUSE announcement",
          url: "https://madhouse.co.jp/news/m6mt9px9r3l77zvw/",
        },
      ],
      provisional:
        "The 2027 window is announced, but the final title, story, and content guidance remain undisclosed.",
    },
  ],
  [
    "Sword Art Online (Original Movie)",
    {
      title: "Sword Art Online the Movie: Integral Domain",
      year: 2028,
      summary:
        "A new original Sword Art Online theatrical story featuring Kirito and Asuna. Further story details have not yet been disclosed.",
      releaseWindow: "2028",
      tags: ["virtual-reality", "game-world", "swordplay", "original-story"],
      tone: ["Adventurous", "Intense", "Epic"],
      releaseStatus: "announced",
      provisional:
        "The title and 2028 window are announced; story specifics and final content guidance remain provisional.",
    },
  ],
  [
    "Takopi’s Original Sin: Thank You, See You Tomorrow",
    {
      summary:
        "A theatrical re-edit of all six episodes of Takopi's Original Sin with newly added scenes, following an alien who tries to bring happiness to a severely bullied child.",
      releaseWindow: "TBA",
      tags: ["bullying", "child-abuse", "time-travel", "tragedy"],
      tone: ["Dark", "Emotional", "Distressing"],
      releaseStatus: "announced",
      provisional:
        "The film is announced, but its theatrical date remains TBA.",
    },
  ],
  [
    "The Apothecary Diaries Movie",
    {
      title: "The Apothecary Diaries: The Late Consort’s Secret Treasure",
      year: 2026,
      summary:
        "Maomao and Jinshi investigate an original mystery involving the secret treasure of a late consort in a theatrical story written by series author Natsu Hyuga.",
      releaseStart: "2026-12-11",
      releaseEnd: "2026-12-11",
      tags: ["palace-intrigue", "medicine", "mystery", "poison"],
      tone: ["Investigative", "Atmospheric", "Dramatic"],
      releaseStatus: "announced",
      provisional:
        "Release date is verified; detailed content guidance will be finalized after the film premieres.",
    },
  ],
  [
    "WASTED CHEF",
    {
      summary:
        "A young chef searching for a lost flavor enters a strange world that has lost its sense of taste, beginning an adventure about food, memory, growth, and the meaning of value.",
      releaseWindow: "TBA",
      genres: ["Drama", "Sci-Fi", "Adventure"],
      tags: ["cooking", "memory", "original-anime", "post-apocalyptic"],
      tone: ["Inventive", "Emotional", "Adventurous"],
      releaseStatus: "announced",
      links: [
        {
          provider: "official",
          label: "Official project site",
          url: "https://kadokawa-animation.jp/wasted-chef/",
        },
      ],
      provisional:
        "The project is in production; its release date and final content guidance remain TBA.",
    },
  ],
])

const tagRules: Array<[RegExp, string[]]> = [
  [/^Cars(?: \d)?$/, ["cars", "racing", "friendship"]],
  [/^Coco$/, ["family", "music", "afterlife"]],
  [/^Despicable Me/, ["supervillains", "family", "minions"]],
  [/^Hotel Transylvania/, ["monsters", "family", "hotel"]],
  [/^How to Train Your Dragon/, ["dragons", "vikings", "friendship"]],
  [/^Ice Age/, ["prehistoric-animals", "found-family", "survival"]],
  [
    /^(The Incredibles|Incredibles 2)$/,
    ["superhero", "family", "secret-identity"],
  ],
  [/^Inside Out$/, ["emotions", "mental-health", "family"]],
  [/^Kung Fu Panda/, ["martial-arts", "animal-cast", "chosen-one"]],
  [/^Madagascar/, ["animal-cast", "friendship", "travel"]],
  [/^Minions/, ["minions", "supervillains", "slapstick"]],
  [/^Monsters/, ["monsters", "friendship", "workplace"]],
  [/^Next Gen$/, ["robots", "artificial-intelligence", "friendship"]],
  [/^Penguins of Madagascar$/, ["animal-cast", "spies", "teamwork"]],
  [/^Ratatouille$/, ["cooking", "paris", "ambition"]],
  [/^Rise of the Guardians$/, ["mythology", "childhood", "dreams"]],
  [
    /^Spider-Man: Into the Spider-Verse$/,
    ["superhero", "multiverse", "coming-of-age"],
  ],
  [/^The Angry Birds Movie/, ["birds", "rivalry", "island"]],
  [/^The Boss Baby/, ["family", "siblings", "corporate-satire"]],
  [/^The LEGO Movie$/, ["toys", "creativity", "chosen-one"]],
  [/^The Lion King$/, ["animal-cast", "royalty", "family"]],
  [/^The Secret Life of Pets/, ["animal-cast", "pets", "city-life"]],
  [/^Toy Story/, ["toys", "friendship", "growing-up"]],
  [/^Turbo$/, ["racing", "snails", "underdog"]],
  [/^Up$/, ["grief", "adventure", "friendship"]],
  [/^Zootopia$/, ["animal-cast", "detective", "prejudice"]],
  [/^Big Hero 6$/, ["superhero", "robots", "grief"]],
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

function inferredTags(title: string, summary: string) {
  const direct = tagRules.find(([pattern]) => pattern.test(title))?.[1] ?? []
  const text = summary.toLocaleLowerCase()
  const keywordRules: Array<[RegExp, string]> = [
    [/school|student|academy/, "school-life"],
    [/family|father|mother|brother|sister/, "family"],
    [/war|soldier|military/, "war"],
    [/robot|android|\bai\b/, "artificial-intelligence"],
    [/magic|witch|sorcer/, "magic"],
    [/detective|investigat|mystery/, "investigation"],
    [/sport|team|championship/, "competition"],
    [/friend/, "friendship"],
    [/king|queen|prince|princess|empire/, "royalty"],
    [/time|future|past/, "time"],
  ]
  return unique([
    ...direct,
    ...keywordRules
      .filter(([pattern]) => pattern.test(text))
      .map(([, tag]) => tag),
  ])
}

function fallbackTone(genres: string[]) {
  if (genres.includes("Horror")) return ["Dark", "Tense"]
  if (genres.includes("Comedy")) return ["Wholesome"]
  if (genres.includes("Thriller")) return ["Tense"]
  if (genres.includes("Action")) return ["Hype / Energetic"]
  if (genres.includes("Romance")) return ["Emotional"]
  if (genres.includes("Drama")) return ["Emotional"]
  if (genres.includes("Adventure")) return ["Hype / Energetic"]
  return ["Atmospheric"]
}

const rows = db.select().from(works).all()
const currentTermRows = db
  .select({
    workId: workTerms.workId,
    vocabulary: terms.vocabulary,
    name: terms.name,
  })
  .from(workTerms)
  .innerJoin(terms, eq(workTerms.termId, terms.id))
  .all()
const currentTermsByWork = new Map<string, Map<string, string[]>>()
for (const row of currentTermRows) {
  const vocabularies =
    currentTermsByWork.get(row.workId) ?? new Map<string, string[]>()
  const values = vocabularies.get(row.vocabulary) ?? []
  values.push(row.name)
  vocabularies.set(row.vocabulary, values)
  currentTermsByWork.set(row.workId, vocabularies)
}
const currentLinksByWork = new Map<
  string,
  Array<{ provider: string; label: string; url: string }>
>()
for (const link of db.select().from(externalLinksTable).all()) {
  if (link.ownerType !== "work") continue
  const values = currentLinksByWork.get(link.ownerId) ?? []
  values.push({ provider: link.provider, label: link.label, url: link.url })
  currentLinksByWork.set(link.ownerId, values)
}

db.transaction((tx) => {
  for (const work of rows) {
    const metadata = work.metadata as Metadata
    const currentTerms = currentTermsByWork.get(work.id)
    const override =
      overrides.get(work.canonicalTitle) ??
      [...overrides.values()].find(
        (candidate) => candidate.title === work.canonicalTitle
      )
    const initial = normalizeTaxonomy({
      genres: override?.genres ?? currentTerms?.get("genre") ?? [],
      tags: [...(currentTerms?.get("tag") ?? []), ...(override?.tags ?? [])],
      tone: [...(currentTerms?.get("tone") ?? []), ...(override?.tone ?? [])],
    })
    const finalTaxonomy = normalizeTaxonomy({
      genres: initial.genres,
      tags: [
        ...initial.tags,
        ...inferredTags(
          override?.title ?? work.canonicalTitle,
          override?.summary ?? work.summary
        ),
      ],
      tone: initial.tone,
    })
    const tags = finalTaxonomy.tags
    const tone = finalTaxonomy.tone.length
      ? finalTaxonomy.tone
      : fallbackTone(finalTaxonomy.genres)
    const externalLinks = new Map(
      [
        ...(currentLinksByWork.get(work.id) ?? []),
        ...(override?.links ?? []),
      ].map((link) => [link.url, link])
    )
    const releaseStart = override?.releaseStart ?? metadata.releaseStart ?? null
    const releaseEnd = override?.releaseEnd ?? metadata.releaseEnd ?? null
    const releaseYear = override?.year ?? work.releaseYear
    const releaseStatus =
      override?.releaseStatus ??
      (work.kind === "movie"
        ? work.status === "announced"
          ? "announced"
          : "released"
        : work.kind === "novel"
          ? releaseEnd
            ? "ended"
            : "released"
          : work.status)
    const provisional =
      override?.provisional ??
      (releaseStatus === "announced"
        ? "Release details and content guidance will be reviewed again when the work premieres."
        : null)

    const {
      genres: _genres,
      tags: _tags,
      tone: _tone,
      externalLinks: _externalLinks,
      ...preservedMetadata
    } = metadata
    tx.update(works)
      .set({
        canonicalTitle: override?.title ?? work.canonicalTitle,
        sortTitle: (override?.title ?? work.canonicalTitle).toLocaleLowerCase(),
        summary: override?.summary ?? work.summary,
        releaseYear,
        status: releaseStatus,
        metadata: {
          ...preservedMetadata,
          releaseStart,
          releaseEnd,
          releaseWindow:
            override?.releaseWindow ??
            (releaseYear ? String(releaseYear) : "TBA"),
          curation: {
            reviewedAt,
            status: provisional ? "provisional" : "verified",
            notes: provisional,
          },
          ...(override?.sourceMaterial
            ? { sourceMaterial: override.sourceMaterial }
            : {}),
        },
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(works.id, work.id))
      .run()

    const taxonomyTerms = tx
      .select({ id: terms.id })
      .from(terms)
      .where(inArray(terms.vocabulary, ["genre", "tag", "tone"]))
      .all()
    if (taxonomyTerms.length) {
      tx.delete(workTerms)
        .where(
          and(
            eq(workTerms.workId, work.id),
            inArray(
              workTerms.termId,
              taxonomyTerms.map(({ id }) => id)
            )
          )
        )
        .run()
    }
    const vocabularies: Array<[string, string[]]> = [
      ["genre", finalTaxonomy.genres],
      ["tag", tags],
      ["tone", tone],
    ]
    for (const [vocabulary, values] of vocabularies) {
      for (const name of values) {
        const termId = stableId("term", vocabulary, slug(name))
        tx.insert(terms)
          .values({ id: termId, vocabulary, name, slug: slug(name) })
          .onConflictDoNothing()
          .run()
        const term = tx
          .select({ id: terms.id })
          .from(terms)
          .where(
            and(eq(terms.vocabulary, vocabulary), eq(terms.slug, slug(name)))
          )
          .get()
        if (!term) throw new Error(`Could not persist ${vocabulary}/${name}`)
        tx.insert(workTerms)
          .values({
            workId: work.id,
            termId: term.id,
            source: "catalog-cleanup-v2",
          })
          .onConflictDoNothing()
          .run()
      }
    }

    tx.delete(externalLinksTable)
      .where(
        and(
          eq(externalLinksTable.ownerType, "work"),
          eq(externalLinksTable.ownerId, work.id)
        )
      )
      .run()
    for (const link of externalLinks.values()) {
      tx.insert(externalLinksTable)
        .values({
          id: stableId("link", work.id, link.url),
          ownerType: "work",
          ownerId: work.id,
          provider: link.provider,
          label: link.label,
          url: link.url,
        })
        .run()
    }
  }
})

console.log(`Cleaned and normalized ${rows.length} catalog records.`)
