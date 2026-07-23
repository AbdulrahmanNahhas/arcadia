import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { basename, extname, join, relative, resolve } from "node:path"
import { and, eq, like, or } from "drizzle-orm"
import { parse } from "yaml"
import { normalizeTaxonomy } from "../src/features/library/taxonomy"
import { db } from "../src/db/client"
import {
  assets,
  collectionItems,
  collections,
  entities,
  externalLinks,
  personalState,
  terms,
  workCredits,
  works,
  workTerms,
  workTitles,
} from "../src/db/schema"

type Frontmatter = Record<string, unknown>
type Link = {
  provider: string
  label: string
  url: string
  externalId?: string
}
type PreparedAsset = {
  assetType: "poster" | "banner" | "logo"
  relativePath: string
  mimeType: string
  checksum: string
  source: string
}
type PreparedWork = {
  id: string
  folder: "Tv" | "Movies"
  filePath: string
  relativeSourcePath: string
  data: Frontmatter
  title: string
  kind: "anime" | "series" | "movie"
  aliases: string[]
  studios: string[]
  producers: string[]
  genres: string[]
  tags: string[]
  audience: string[]
  tone: string[]
  country: string[]
  era: string[]
  sharedWith: string[]
  status: "planned" | "in-progress" | "completed" | "paused" | "dropped"
  releaseStart: string | null
  releaseEnd: string | null
  rating: number | null
  links: Link[]
  assets: PreparedAsset[]
}

const positionalArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--" && !argument.startsWith("--"))
const sourceRoot = resolve(
  positionalArguments.at(0) ??
    process.env.OBSIDIAN_ANIMATION_PATH ??
    "/home/aqua/Documents/Obsidian/database/Animation"
)
const vaultRoot = resolve(sourceRoot, "../..")
const outputRoot = resolve(process.cwd(), "public/media/library")
const skipDownloads = process.argv.includes("--skip-downloads")
const skipEnrichment = process.argv.includes("--skip-enrichment")
const now = Math.floor(Date.now() / 1000)

if (
  !existsSync(join(sourceRoot, "Tv")) ||
  !existsSync(join(sourceRoot, "Movies"))
) {
  throw new Error(`Animation folders were not found under ${sourceRoot}`)
}
mkdirSync(outputRoot, { recursive: true })

function stableId(prefix: string, value: string) {
  return `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 16)}`
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim() || null
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function booleanValue(value: unknown): boolean {
  return value === true || String(value).toLocaleLowerCase() === "true"
}

function wikilinkLabel(value: unknown): string | null {
  const raw = stringValue(value)
  if (!raw) return null
  const match = raw.match(/^\[\[(.*?)(?:\|([^\]]+))?\]\]$/)
  if (!match) return raw
  return (match.at(2) ?? basename(match.at(1) ?? "")).trim()
}

function list(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value]
  return [
    ...new Set(
      values.map(wikilinkLabel).filter((item): item is string => Boolean(item))
    ),
  ]
}

function dateValue(value: unknown): string | null {
  const raw = stringValue(value)
  if (!raw) return null
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] ?? null
}

function parseFrontmatter(filePath: string): Frontmatter {
  const source = readFileSync(filePath, "utf8")
  const match = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)
  if (!match) throw new Error(`Missing YAML frontmatter: ${filePath}`)
  return (parse(match[1]) ?? {}) as Frontmatter
}

function allFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...allFiles(path))
    else files.push(path)
  }
  return files
}

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
])
const imageIndex = new Map<string, string[]>()
const indexedImageFiles: string[] = []
for (const filePath of allFiles(vaultRoot)) {
  if (!imageExtensions.has(extname(filePath).toLocaleLowerCase())) continue
  indexedImageFiles.push(filePath)
  const key = basename(filePath).normalize("NFC").toLocaleLowerCase()
  imageIndex.set(key, [...(imageIndex.get(key) ?? []), filePath])
}

function referencedFile(value: unknown, assetType: string): string | null {
  const raw = stringValue(value)
  if (!raw || /^https?:\/\//i.test(raw)) return null
  const match = raw.match(/^\[\[(.*?)(?:\|[^\]]+)?\]\]$/)
  const target = (match?.[1] ?? raw).split("#")[0]
  const direct = resolve(vaultRoot, target)
  if (existsSync(direct)) return direct
  const matches =
    imageIndex.get(basename(target).normalize("NFC").toLocaleLowerCase()) ?? []
  if (matches.length < 2) return matches[0] ?? null
  const preferred = matches.find((item) => {
    const normalized = item.toLocaleLowerCase()
    return (
      normalized.includes(assetType) ||
      (assetType === "poster" && normalized.includes("poster"))
    )
  })
  return preferred ?? matches[0]
}

function likelyLocalFile(
  item: PreparedWork,
  assetType: PreparedAsset["assetType"]
) {
  const noteSlug = slug(basename(item.filePath, ".md"))
  const titleSlug = slug(item.title)
  const directoryHints =
    assetType === "poster"
      ? ["/posters/", "/poster/"]
      : [`/${assetType}s/`, `/${assetType}/`]
  const candidates = indexedImageFiles.filter((filePath) => {
    const normalizedPath = filePath.replaceAll("\\", "/").toLocaleLowerCase()
    if (!directoryHints.some((hint) => normalizedPath.includes(hint)))
      return false
    const fileSlug = slug(basename(filePath, extname(filePath)))
    return (
      fileSlug === noteSlug ||
      fileSlug === titleSlug ||
      (noteSlug.length > 5 && fileSlug.startsWith(noteSlug)) ||
      (titleSlug.length > 5 && fileSlug.startsWith(titleSlug))
    )
  })
  return candidates.sort((a, b) => a.length - b.length)[0] ?? null
}

function mimeFromExtension(extension: string) {
  const ext = extension.toLocaleLowerCase()
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  if (ext === ".avif") return "image/avif"
  return "image/png"
}

function extensionFromMime(mime: string, fallbackUrl: string) {
  if (mime.includes("jpeg")) return ".jpg"
  if (mime.includes("webp")) return ".webp"
  if (mime.includes("gif")) return ".gif"
  if (mime.includes("avif")) return ".avif"
  if (mime.includes("png")) return ".png"
  const fallback = extname(new URL(fallbackUrl).pathname).toLocaleLowerCase()
  return imageExtensions.has(fallback) ? fallback : ".jpg"
}

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

async function prepareAsset(
  item: PreparedWork,
  assetType: PreparedAsset["assetType"],
  value: unknown
): Promise<PreparedAsset | null> {
  const raw = stringValue(value)
  if (!raw) return null
  const local =
    referencedFile(value, assetType) ?? likelyLocalFile(item, assetType)
  if (local) {
    const extension = extname(local).toLocaleLowerCase() || ".jpg"
    const filename = `${item.id}-${assetType}${extension}`
    const destination = join(outputRoot, filename)
    copyFileSync(local, destination)
    const buffer = readFileSync(destination)
    return {
      assetType,
      relativePath: `/media/library/${filename}`,
      mimeType: mimeFromExtension(extension),
      checksum: checksum(buffer),
      source: relative(vaultRoot, local),
    }
  }
  if (!/^https?:\/\//i.test(raw) || skipDownloads) return null
  const existingFilename = readdirSync(outputRoot).find((name) =>
    name.startsWith(`${item.id}-${assetType}.`)
  )
  if (existingFilename) {
    const destination = join(outputRoot, existingFilename)
    const buffer = readFileSync(destination)
    return {
      assetType,
      relativePath: `/media/library/${existingFilename}`,
      mimeType: mimeFromExtension(extname(existingFilename)),
      checksum: checksum(buffer),
      source: raw,
    }
  }
  try {
    const response = await fetch(raw, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`)
    const mimeType =
      response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg"
    const extension = extensionFromMime(mimeType, raw)
    const filename = `${item.id}-${assetType}${extension}`
    const destination = join(outputRoot, filename)
    const buffer = Buffer.from(await response.arrayBuffer())
    writeFileSync(destination, buffer)
    return {
      assetType,
      relativePath: `/media/library/${filename}`,
      mimeType,
      checksum: checksum(buffer),
      source: raw,
    }
  } catch (error) {
    console.warn(
      `Could not localize ${assetType} for ${item.id}: ${String(error)}`
    )
    return null
  }
}

function normalizeStatus(data: Frontmatter): PreparedWork["status"] {
  const status = list(data.status)[0]?.toLocaleLowerCase() ?? ""
  if (status === "completed") return "completed"
  if (status === "watching") return "in-progress"
  if (status === "on hold") return "paused"
  if (status === "dropped") return "dropped"
  return "planned"
}

function risk(value: unknown): "none" | "low" | "medium" | "high" | "unknown" {
  const normalized = list(value)[0]?.toLocaleLowerCase()
  if (normalized === "none") return "none"
  if (normalized === "low") return "low"
  if (normalized === "moderate" || normalized === "medium") return "medium"
  if (normalized === "high") return "high"
  return "unknown"
}

function scoreBreakdown(data: Frontmatter) {
  const fields = [
    ["Characters", "characters"],
    ["Visuals", "visuals"],
    ["Story", "story"],
    ["World building", "worldBuilding"],
    ["Depth", "depth"],
    ["Originality", "originality"],
  ] as const
  const scores: Record<string, number> = {}
  for (const [label, key] of fields) {
    const value = numberValue(data[key])
    if (value !== null && value > 0) scores[label] = value
  }
  return scores
}

function ratingFor(data: Frontmatter, status: PreparedWork["status"]) {
  if (status === "planned") return null
  const scores = Object.values(scoreBreakdown(data))
  if (scores.length < 2) return null
  return (
    Math.round(
      (scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10
    ) / 10
  )
}

function link(
  provider: string,
  label: string,
  value: unknown,
  externalId?: unknown
): Link | null {
  const url = stringValue(value)
  if (!url || !/^https?:\/\//i.test(url)) return null
  return {
    provider,
    label,
    url,
    externalId: stringValue(externalId) ?? undefined,
  }
}

function uniqueLinks(links: Array<Link | null>) {
  return [
    ...new Map(
      links
        .filter((item): item is Link => Boolean(item))
        .map((item) => [item.url, item])
    ).values(),
  ]
}

async function enrichAniList(items: PreparedWork[]) {
  if (skipEnrichment) return
  const withIds = items.filter((item) => numberValue(item.data.anilistId))
  async function enrichBatch(batch: PreparedWork[]): Promise<void> {
    if (!batch.length) return
    const fields = batch
      .map(
        (item, index) =>
          `m${index}: Media(id: ${numberValue(item.data.anilistId)}, type: ANIME) { id idMal externalLinks { site url } }`
      )
      .join("\n")
    try {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ query: `query ArcadiaImport { ${fields} }` }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        if (batch.length > 1) {
          const middle = Math.ceil(batch.length / 2)
          await enrichBatch(batch.slice(0, middle))
          await enrichBatch(batch.slice(middle))
          return
        }
        console.warn(
          `AniList enrichment skipped for ${batch[0].title} (${numberValue(batch[0].data.anilistId)}): ${response.status}`
        )
        return
      }
      const payload = (await response.json()) as {
        data?: Record<
          string,
          {
            id: number
            idMal?: number
            externalLinks?: Array<{ site: string; url: string }>
          }
        >
      }
      batch.forEach((item, index) => {
        const media = payload.data?.[`m${index}`]
        if (!media) return
        const additions: Array<Link | null> = []
        if (media.idMal) {
          additions.push({
            provider: "mal",
            label: "MyAnimeList",
            url: `https://myanimelist.net/anime/${media.idMal}`,
            externalId: String(media.idMal),
          })
        }
        for (const external of media.externalLinks ?? []) {
          if (!external.url) continue
          additions.push({
            provider: slug(external.site) || "external",
            label: external.site,
            url: external.url,
          })
        }
        item.links = uniqueLinks([...item.links, ...additions])
      })
    } catch (error) {
      console.warn(
        `AniList link enrichment skipped for one batch: ${String(error)}`
      )
    }
  }
  for (let offset = 0; offset < withIds.length; offset += 30) {
    await enrichBatch(withIds.slice(offset, offset + 30))
  }
}

const noteFiles = (["Tv", "Movies"] as const).flatMap((folder) =>
  readdirSync(join(sourceRoot, folder))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({ folder, filePath: join(sourceRoot, folder, name) }))
)

const prepared: PreparedWork[] = noteFiles.map(({ folder, filePath }) => {
  const data = parseFrontmatter(filePath)
  const title = stringValue(data.title) ?? basename(filePath, ".md")
  const country = list(data.country)
  const kind =
    folder === "Movies"
      ? "movie"
      : country.includes("Japan")
        ? "anime"
        : "series"
  const short = stringValue(data.short)
  const arTitle = stringValue(data.arTitle)
  const aliases = [
    ...new Set(
      [short, arTitle].filter((item): item is string =>
        Boolean(item && item !== title)
      )
    ),
  ]
  const status = normalizeStatus(data)
  const taxonomy = normalizeTaxonomy({
    genres: list(data.genres),
    tags: list(data.tags),
    tone: list(data.tone),
  })
  const id = `obsidian-animation-${folder.toLocaleLowerCase()}-${slug(basename(filePath, ".md")) || stableId("work", filePath)}`
  return {
    id,
    folder,
    filePath,
    relativeSourcePath: relative(vaultRoot, filePath),
    data,
    title,
    kind,
    aliases,
    studios: list(data.studio),
    producers: list(data.producer),
    genres: taxonomy.genres,
    tags: taxonomy.tags,
    audience: list(data.audience),
    tone: taxonomy.tone,
    country,
    era: list(data.era),
    sharedWith: [
      ...new Set([
        ...list(data.shared),
        ...(booleanValue(data.withFamily) ? ["Family"] : []),
      ]),
    ],
    status,
    releaseStart: dateValue(data.startDate) ?? dateValue(data.releaseDate),
    releaseEnd:
      dateValue(data.endDate) ??
      (folder === "Movies" ? dateValue(data.releaseDate) : null),
    rating: ratingFor(data, status),
    links: uniqueLinks([
      link("anilist", "AniList", data.anilistUrl, data.anilistId),
      link("tmdb", "TMDB", data.tmdbUrl),
      link("wiki", "Wiki", data.wiki),
    ]),
    assets: [],
  }
})

await enrichAniList(prepared)

let cursor = 0
const workers = Array.from({ length: 8 }, async () => {
  while (cursor < prepared.length) {
    const item = prepared[cursor++]
    const nextAssets = await Promise.all([
      prepareAsset(item, "poster", item.data.image),
      prepareAsset(item, "banner", item.data.banner),
      prepareAsset(item, "logo", item.data.logo),
    ])
    item.assets = nextAssets.filter((asset): asset is PreparedAsset =>
      Boolean(asset)
    )
  }
})
await Promise.all(workers)

function epoch(date: string | null) {
  return date
    ? Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)
    : null
}

function releaseYear(item: PreparedWork) {
  const date = item.releaseStart ?? item.releaseEnd
  return date ? Number(date.slice(0, 4)) : null
}

db.transaction((tx) => {
  const oldIds = tx
    .select({ id: works.id })
    .from(works)
    .where(or(like(works.id, "demo-%"), like(works.id, "obsidian-animation-%")))
    .all()
    .map((row) => row.id)
  for (const id of oldIds) {
    tx.delete(assets)
      .where(and(eq(assets.ownerType, "work"), eq(assets.ownerId, id)))
      .run()
    tx.delete(externalLinks)
      .where(
        and(eq(externalLinks.ownerType, "work"), eq(externalLinks.ownerId, id))
      )
      .run()
    tx.delete(works).where(eq(works.id, id)).run()
  }

  prepared.forEach((item, position) => {
    const data = item.data
    const scores = scoreBreakdown(data)
    const sourceType = list(data.sourceType).at(0)
    const sourceStarted = numberValue(data.sourceStarted)
    const sourceFinished = numberValue(data.sourceFinished)
    const sourceSerialization = list(data.sourceSerialization)
    const sourcePublication = stringValue(data.sourceMagazine)
    const sourceMaterial =
      sourceType ||
      sourceStarted ||
      sourceFinished ||
      sourceSerialization.length ||
      sourcePublication
        ? {
            type: sourceType ?? "Unknown",
            started: sourceStarted,
            finished: sourceFinished,
            serialization: sourceSerialization,
            publication: sourcePublication,
          }
        : null
    const riskProfile = {
      sexuality: risk(data.SexualityRisk),
      fanService: numberValue(data.fanServiceLevel),
      behavioral: risk(data.BehavioralRisk),
      theology: risk(data.TheologyRisk),
    }
    const fileTime = Math.floor(statSync(item.filePath).mtimeMs / 1000)
    const objectiveStatus = booleanValue(data.upcoming)
      ? "announced"
      : item.releaseEnd
        ? "ended"
        : item.releaseStart
          ? "releasing"
          : "released"
    const subtitle = item.aliases.join(" · ")
    tx.insert(works)
      .values({
        id: item.id,
        kind: item.kind,
        canonicalTitle: item.title,
        sortTitle: item.title.toLocaleLowerCase(),
        summary: stringValue(data.summary) ?? "",
        releaseYear: releaseYear(item),
        originalReleaseAt: epoch(item.releaseStart),
        runtimeMinutes: numberValue(data.runtimeMinutes),
        episodeCount: null,
        chapterCount: null,
        status: objectiveStatus,
        metadata: {
          subtitle,
          sharedWith: item.sharedWith,
          contentWarnings: stringValue(data.contentWarnings),
          analysisNotes: stringValue(data.theologicalAnalysis),
          riskProfile,
          scoreBreakdown: scores,
          releaseStart: item.releaseStart,
          releaseEnd: item.releaseEnd,
          watchDates: {
            firstWatchedAt:
              dateValue(data.firstWatchedAt) ?? dateValue(data.watchedAt),
            lastWatchedAt:
              dateValue(data.lastWatchedAt) ?? dateValue(data.watchedAt),
            completedAt: dateValue(data.completedAt),
          },
          sourceMaterial,
          productionNotes: { producers: item.producers },
          palette: item.kind === "anime" ? "anime" : item.kind,
          category: stringValue(data.category),
          era: item.era,
          franchise: wikilinkLabel(data.franchise),
          bannerPosition: numberValue(data.banner_position),
          source: {
            type: "obsidian",
            path: item.relativeSourcePath,
            importedAt: now,
          },
        },
        createdAt: fileTime - position,
        updatedAt: now,
      })
      .run()
    tx.insert(personalState)
      .values({
        workId: item.id,
        status: item.status,
        rating: item.rating,
        favorite: booleanValue(data.favorite),
        progress: 0,
        progressTotal: null,
        progressUnit: "",
        completedAt: epoch(dateValue(data.completedAt)),
        privateMetadata: {
          sharedWith: item.sharedWith,
          firstWatchedAt:
            dateValue(data.firstWatchedAt) ?? dateValue(data.watchedAt),
          lastWatchedAt:
            dateValue(data.lastWatchedAt) ?? dateValue(data.watchedAt),
          isPrivate: booleanValue(data.private),
        },
        createdAt: fileTime,
        updatedAt: now,
      })
      .run()

    const titles: Array<{
      title: string
      type: string
      language: string | null
    }> = [{ title: item.title, type: "canonical", language: null }]
    for (const alias of item.aliases) {
      titles.push({
        title: alias,
        type: "alias",
        language: alias === stringValue(data.arTitle) ? "ar" : null,
      })
    }
    for (const title of titles) {
      tx.insert(workTitles)
        .values({
          id: stableId("title", `${item.id}:${title.title}`),
          workId: item.id,
          title: title.title,
          titleType: title.type,
          language: title.language,
          isPreferred: title.type === "canonical",
        })
        .run()
    }

    const vocabularies: Array<[string, string[]]> = [
      ["genre", item.genres],
      ["tag", item.tags],
      ["audience", item.audience],
      ["tone", item.tone],
      ["country", item.country],
      ["era", item.era],
    ]
    for (const [vocabulary, values] of vocabularies) {
      for (const name of values) {
        const termId = stableId(
          "term",
          `${vocabulary}:${name.toLocaleLowerCase()}`
        )
        tx.insert(terms)
          .values({
            id: termId,
            vocabulary,
            name,
            slug: slug(name) || stableId("slug", name),
          })
          .onConflictDoNothing()
          .run()
        tx.insert(workTerms)
          .values({ workId: item.id, termId, source: "obsidian" })
          .run()
      }
    }

    const credits: Array<[string, string, string]> = [
      ...item.studios.map(
        (name) => ["studio", name, "main-studio"] as [string, string, string]
      ),
    ]
    for (const [entityType, name, role] of credits) {
      const entityId = stableId(
        "entity",
        `${entityType}:${name.toLocaleLowerCase()}`
      )
      tx.insert(entities)
        .values({
          id: entityId,
          entityType,
          name,
          sortName: name.toLocaleLowerCase(),
        })
        .onConflictDoNothing()
        .run()
      tx.insert(workCredits).values({ workId: item.id, entityId, role }).run()
    }

    const franchise = wikilinkLabel(data.franchise)
    if (franchise) {
      const collectionId = stableId(
        "collection",
        `franchise:${franchise.toLocaleLowerCase()}`
      )
      tx.insert(collections)
        .values({
          id: collectionId,
          name: franchise,
          collectionType: "franchise",
        })
        .onConflictDoNothing()
        .run()
      tx.insert(collectionItems)
        .values({ collectionId, workId: item.id, position })
        .run()
    }

    for (const asset of item.assets) {
      tx.insert(assets)
        .values({
          id: stableId("asset", `${item.id}:${asset.assetType}`),
          ownerType: "work",
          ownerId: item.id,
          assetType: asset.assetType,
          relativePath: asset.relativePath,
          mimeType: asset.mimeType,
          checksum: asset.checksum,
          metadata: { source: asset.source },
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }
    for (const external of item.links) {
      tx.insert(externalLinks)
        .values({
          id: stableId("link", `${item.id}:${external.url}`),
          ownerType: "work",
          ownerId: item.id,
          provider: external.provider,
          label: external.label,
          url: external.url,
          externalId: external.externalId,
        })
        .run()
    }
  })
})

const counts = {
  works: prepared.length,
  anime: prepared.filter((item) => item.kind === "anime").length,
  animatedSeries: prepared.filter((item) => item.kind === "series").length,
  movies: prepared.filter((item) => item.kind === "movie").length,
  posters: prepared.filter((item) =>
    item.assets.some((asset) => asset.assetType === "poster")
  ).length,
  banners: prepared.filter((item) =>
    item.assets.some((asset) => asset.assetType === "banner")
  ).length,
  logos: prepared.filter((item) =>
    item.assets.some((asset) => asset.assetType === "logo")
  ).length,
  links: prepared.reduce((sum, item) => sum + item.links.length, 0),
}
console.log(JSON.stringify(counts, null, 2))
