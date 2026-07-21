import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { assets, works } from "@/db/schema"

const manga = [
  ["literature-manga-blue-box", "Blue Box"],
  ["literature-manga-witchriv", "WITCHRIV"],
  ["literature-manga-solo-leveling", "Solo Leveling"],
  ["literature-manga-three-days-of-happiness", "Three Days of Happiness"],
  ["literature-manga-ichi-the-witch", "Ichi the Witch"],
  ["literature-manga-centuria", "Centuria"],
] as const

const novels = [
  [
    "literature-novel-animal-farm",
    "https://covers.openlibrary.org/b/isbn/9780451526342-L.jpg",
  ],
  [
    "literature-novel-mistborn-era-1",
    "https://covers.openlibrary.org/b/isbn/9781250267177-L.jpg",
  ],
] as const

async function anilistCover(search: string) {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      query: `query ArcadiaCover($search: String!) {
        Media(search: $search, type: MANGA) {
          siteUrl
          title { english romaji }
          coverImage { extraLarge large }
        }
      }`,
      variables: { search },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`AniList ${response.status} for ${search}`)
  const payload = (await response.json()) as {
    data?: {
      Media?: {
        siteUrl: string
        title: { english?: string; romaji?: string }
        coverImage: { extraLarge?: string; large?: string }
      }
    }
  }
  const media = payload.data?.Media
  const url = media?.coverImage.extraLarge ?? media?.coverImage.large
  if (!media || !url) throw new Error(`No AniList cover found for ${search}`)
  console.log(
    `${search}: ${media.title.english ?? media.title.romaji ?? "matched"}`
  )
  return { url, siteUrl: media.siteUrl }
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("png")) return "png"
  if (mimeType.includes("webp")) return "webp"
  return "jpg"
}

async function saveCover(workId: string, url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Cover download failed: ${response.status}`)
  const mimeType =
    response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg"
  if (!mimeType.startsWith("image/")) throw new Error(`Not an image: ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 5_000)
    throw new Error(`Cover is unexpectedly small: ${url}`)
  const extension = extensionFor(mimeType)
  const filename = `${workId}-poster.${extension}`
  const directory = join(process.cwd(), "public", "media", "library")
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, filename), bytes)
  const relativePath = `/media/library/${filename}`
  const current = db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.ownerType, "work"),
        eq(assets.ownerId, workId),
        eq(assets.assetType, "poster")
      )
    )
    .get()
  const checksum = createHash("sha256").update(bytes).digest("hex")
  if (current) {
    db.update(assets)
      .set({
        relativePath,
        mimeType,
        checksum,
        metadata: { source: url, fetchedAt: new Date().toISOString() },
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(assets.id, current.id))
      .run()
  } else {
    db.insert(assets)
      .values({
        id: createHash("sha256")
          .update(`asset:${workId}:poster`)
          .digest("hex")
          .slice(0, 32),
        ownerType: "work",
        ownerId: workId,
        assetType: "poster",
        relativePath,
        mimeType,
        checksum,
        metadata: { source: url, fetchedAt: new Date().toISOString() },
      })
      .run()
  }
}

function addCatalogLink(workId: string, url: string) {
  const work = db.select().from(works).where(eq(works.id, workId)).get()
  if (!work) throw new Error(`Work not found: ${workId}`)
  const metadata = (work.metadata ?? {}) as Record<string, unknown> & {
    externalLinks?: Array<{ provider: string; label: string; url: string }>
  }
  const links = (metadata.externalLinks ?? []).filter(
    (link) => link.url !== "https://mangaplus.shueisha.co.jp/"
  )
  if (!links.some((link) => link.url === url)) {
    links.push({ provider: "anilist", label: "AniList", url })
  }
  db.update(works)
    .set({ metadata: { ...metadata, externalLinks: links } })
    .where(eq(works.id, workId))
    .run()
}

for (const [workId, title] of manga) {
  const catalog = await anilistCover(title)
  await saveCover(workId, catalog.url)
  addCatalogLink(workId, catalog.siteUrl)
}
for (const [workId, url] of novels) await saveCover(workId, url)

console.log(`Fetched ${manga.length + novels.length} literature covers.`)
