import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { assets, entities, workContributors } from "../src/db/schema";

type JikanProducer = {
  mal_id?: number;
  url: string;
  name: string;
  source_provider?: "MyAnimeList" | "Wikipedia";
  titles?: Array<{ type?: string; title?: string }>;
  images?: {
    jpg?: { image_url?: string | null; large_image_url?: string | null };
    webp?: { image_url?: string | null; large_image_url?: string | null };
  };
  favorites?: number;
  about?: string | null;
  established?: string | null;
};

const force = process.argv.includes("--force");
const requestedLimit = Number(
  process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1],
);
const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : Infinity;
const outputDirectory = join(process.cwd(), "public", "media", "entities");
let jikanAvailable = true;
const wikipediaTitles: Record<string, string> = {
  "CoMix Wave": "CoMix Wave Films",
  Illumination: "Illumination (company)",
  Pierrot: "Studio Pierrot",
  Titmouse: "Titmouse, Inc.",
};

function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slug(value: string) {
  return normalizedName(value).replace(/\s+/g, "-") || "studio";
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Remote source returned ${response.status}`);
      }
      lastError = new Error(`Remote source returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await wait(attempt * 1_500);
  }
  throw lastError instanceof Error ? lastError : new Error("Remote source request failed");
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
      "user-agent": "Arcadia personal catalog image importer",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`MyAnimeList returned ${response.status}`);
  return response.text();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function findProducerOnMal(name: string): Promise<JikanProducer | null> {
  const searchHtml = await fetchText(
    `https://myanimelist.net/company?q=${encodeURIComponent(name)}`,
  );
  const matches = [
    ...searchHtml.matchAll(
      /<a href="(\/anime\/producer\/(\d+)\/[^"]+)"><img[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]+)"/g,
    ),
  ];
  const target = normalizedName(name);
  const match = matches.find(
    (candidate) => normalizedName(decodeHtml(candidate[4] ?? "")) === target,
  );
  if (!match?.[1] || !match[2]) return null;

  const url = `https://myanimelist.net${match[1]}`;
  const profileHtml = await fetchText(url);
  const image = profileHtml.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? match[3];
  const established = profileHtml
    .match(/<span class="dark_text">Established:<\/span>\s*([^<\n]+)/)?.[1]
    ?.trim();
  const favoritesText = profileHtml
    .match(/<span class="dark_text">Member Favorites:<\/span>\s*([\d,]+)/)?.[1]
    ?.replace(/,/g, "");
  const favorites = favoritesText ? Number(favoritesText) : undefined;
  return {
    mal_id: Number(match[2]),
    url,
    name,
    source_provider: "MyAnimeList",
    images: { jpg: { large_image_url: image ? decodeHtml(image) : null } },
    established: established || null,
    favorites: Number.isFinite(favorites) ? favorites : undefined,
  };
}

async function findStudioOnWikipedia(name: string): Promise<JikanProducer | null> {
  const title = wikipediaTitles[name] ?? name;
  const payload = await fetchJson<{
    query?: {
      pages?: Record<string, { title?: string; fullurl?: string; thumbnail?: { source?: string } }>;
    };
  }>(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages%7Cinfo&inprop=url&pithumbsize=600&titles=${encodeURIComponent(title)}&origin=*`,
  );
  const page = Object.values(payload.query?.pages ?? {}).find(({ fullurl, thumbnail }) =>
    Boolean(fullurl && thumbnail?.source),
  );
  if (!page?.fullurl || !page.thumbnail?.source) return null;
  return {
    url: page.fullurl,
    name,
    source_provider: "Wikipedia",
    images: { jpg: { large_image_url: page.thumbnail.source } },
  };
}

async function findProducer(name: string, malId?: number) {
  if (jikanAvailable)
    try {
      if (malId) {
        const payload = await fetchJson<{ data?: JikanProducer }>(
          `https://api.jikan.moe/v4/producers/${malId}/full`,
        );
        return payload.data ?? null;
      }

      const payload = await fetchJson<{ data?: JikanProducer[] }>(
        `https://api.jikan.moe/v4/producers?q=${encodeURIComponent(name)}&limit=10`,
      );
      const target = normalizedName(name);
      const match =
        payload.data?.find((candidate) => {
          const names = [
            candidate.name,
            ...(candidate.titles ?? []).map(({ title }) => title ?? ""),
          ];
          return names.some((candidateName) => normalizedName(candidateName) === target);
        }) ?? null;
      if (match) return match;
    } catch (error) {
      jikanAvailable = false;
      console.warn(
        `Jikan unavailable; using MyAnimeList directly (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  return (await findProducerOnMal(name)) ?? findStudioOnWikipedia(name);
}

function imageUrl(producer: JikanProducer) {
  return (
    producer.images?.webp?.large_image_url ??
    producer.images?.webp?.image_url ??
    producer.images?.jpg?.large_image_url ??
    producer.images?.jpg?.image_url ??
    null
  );
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

async function saveImage(entity: typeof entities.$inferSelect, producer: JikanProducer) {
  const source = imageUrl(producer);
  if (!source) return false;
  const response = await fetch(source, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`image returned ${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) throw new Error("response was not an image");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1_000) throw new Error("image was unexpectedly small");

  mkdirSync(outputDirectory, { recursive: true });
  const filename = `studio-${slug(entity.name)}.${extensionFor(mimeType)}`;
  writeFileSync(join(outputDirectory, filename), bytes);
  const relativePath = `/media/entities/${filename}`;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const existing = db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.ownerType, "entity"),
        eq(assets.ownerId, entity.id),
        eq(assets.assetType, "profile"),
      ),
    )
    .get();
  const values = {
    relativePath,
    mimeType,
    checksum,
    metadata: {
      source,
      provider: producer.source_provider ?? "MyAnimeList via Jikan",
      fetchedAt: new Date().toISOString(),
    },
    updatedAt: Math.floor(Date.now() / 1_000),
  };
  if (existing) {
    db.update(assets).set(values).where(eq(assets.id, existing.id)).run();
  } else {
    db.insert(assets)
      .values({
        id: createHash("sha256").update(`asset:${entity.id}:profile`).digest("hex").slice(0, 32),
        ownerType: "entity",
        ownerId: entity.id,
        assetType: "profile",
        ...values,
      })
      .run();
  }
  return true;
}

const studios = db
  .select({ entity: entities })
  .from(entities)
  .innerJoin(workContributors, eq(workContributors.entityId, entities.id))
  .where(eq(workContributors.role, "animation-studio"))
  .orderBy(asc(entities.sortName))
  .all()
  .map(({ entity }) => entity)
  .filter((entity, index, values) => values.findIndex(({ id }) => id === entity.id) === index)
  .filter((entity) => {
    if (force) return true;
    return !db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.ownerType, "entity"),
          eq(assets.ownerId, entity.id),
          eq(assets.assetType, "profile"),
        ),
      )
      .get();
  })
  .slice(0, limit);

let fetched = 0;
let unmatched = 0;
let failed = 0;
for (const [index, entity] of studios.entries()) {
  try {
    const metadata = entity.metadata as Record<string, unknown>;
    const producer = await findProducer(
      entity.name,
      typeof metadata.malId === "number" ? metadata.malId : undefined,
    );
    if (!producer) {
      unmatched += 1;
      console.log(`[${index + 1}/${studios.length}] no exact MAL match: ${entity.name}`);
      await wait(1_000);
      continue;
    }
    const alternativeNames = [
      ...(Array.isArray(metadata.alternativeNames) ? metadata.alternativeNames : []),
      ...(producer.titles ?? []).map(({ title }) => title),
    ].filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
    const nextMetadata = {
      ...metadata,
      ...(producer.mal_id ? { malId: producer.mal_id } : {}),
      sourceUrl: producer.url,
      sourceProvider: producer.source_provider ?? "MyAnimeList",
      establishedAt: producer.established ?? null,
      favorites: producer.favorites ?? null,
      alternativeNames: [...new Set(alternativeNames)].filter((name) => name !== entity.name),
      source: producer.source_provider ?? "MyAnimeList via Jikan",
    };
    const saved = await saveImage(entity, producer);
    db.update(entities)
      .set({
        description: entity.description || producer.about?.trim() || "",
        metadata: nextMetadata,
        updatedAt: Math.floor(Date.now() / 1_000),
      })
      .where(eq(entities.id, entity.id))
      .run();
    fetched += saved ? 1 : 0;
    console.log(`[${index + 1}/${studios.length}] ${saved ? "saved" : "metadata"}: ${entity.name}`);
  } catch (error) {
    failed += 1;
    console.error(
      `[${index + 1}/${studios.length}] failed: ${entity.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await wait(1_000);
}

console.log(
  `Studio image sync complete: ${fetched} images, ${unmatched} unmatched, ${failed} failed.`,
);
