import type { SubtitleCandidate } from "@arcadia/contracts";
import { z } from "zod";
import { readEnvValue } from "./torrent-source";

/**
 * OpenSubtitles' REST v1 API (see `docs/player-torrent-roadmap.md`, Phase 2 "Subtitles") — the
 * newer key-based API, not the deprecated XML-RPC one. Same shape as `torrent-source.ts`: reads
 * its key from the environment, and a missing key or a failed request both degrade to `null`
 * rather than throwing, so a deployment with no key configured yet behaves exactly like the
 * addon's `source_not_configured` path instead of crashing the route.
 */

const defaultTimeoutMs = 8_000;
const apiBase = "https://api.opensubtitles.com/api/v1";

function readConfig() {
  const apiKey = readEnvValue("OPENSUBTITLES_API_KEY");
  if (!apiKey) return null;
  return {
    apiKey,
    userAgent: readEnvValue("OPENSUBTITLES_USER_AGENT") || "Arcadia v2",
    timeoutMs: defaultTimeoutMs,
  };
}

export function subtitleSourceConfigured() {
  return readConfig() !== null;
}

const rawSubtitleFileSchema = z.object({
  file_id: z.number().int(),
  file_name: z.string().nullish().catch(null),
});

const rawSubtitleAttributesSchema = z.object({
  language: z.string().catch("und"),
  release: z.string().nullish().catch(null),
  download_count: z.number().int().min(0).nullish().catch(null),
  moviehash_match: z.boolean().nullish().catch(null),
  files: z.array(rawSubtitleFileSchema).catch([]),
});

const rawSubtitleEntrySchema = z.object({
  attributes: rawSubtitleAttributesSchema,
});

const searchResponseSchema = z.object({
  data: z.array(rawSubtitleEntrySchema).catch([]),
});

/**
 * `moviehash` first (OpenSubtitles' most reliable match — the same hash algorithm Stremio addons
 * report as `behaviorHints.videoHash`), falling back to the catalog's IMDb id. A series episode
 * adds `parent_imdb_id`/`season_number`/`episode_number` instead of `imdb_id` directly, per
 * OpenSubtitles' own convention for episode-level subtitles.
 */
export interface SubtitleSearchInput {
  imdbId: string | null;
  season: number | null;
  episode: number | null;
  videoHash: string | null;
  videoSize: number | null;
  languages: string[];
}

export async function fetchSubtitleCandidates(
  input: SubtitleSearchInput,
): Promise<SubtitleCandidate[] | null> {
  const config = readConfig();
  if (!config) return null;
  if (!input.videoHash && !input.imdbId) return [];

  const params = new URLSearchParams();
  if (input.videoHash) params.set("moviehash", input.videoHash);
  if (input.imdbId) {
    if (input.season !== null && input.episode !== null) {
      params.set("parent_imdb_id", input.imdbId.replace(/^tt/, ""));
      params.set("season_number", String(input.season));
      params.set("episode_number", String(input.episode));
    } else {
      params.set("imdb_id", input.imdbId.replace(/^tt/, ""));
    }
  }
  if (input.languages.length) params.set("languages", input.languages.join(","));

  let body: unknown;
  try {
    const response = await fetch(`${apiBase}/subtitles?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Api-Key": config.apiKey,
        "User-Agent": config.userAgent,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      console.warn(`opensubtitles search answered ${response.status}`);
      return null;
    }
    body = await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`opensubtitles unreachable: ${reason}`);
    return null;
  }

  const parsed = searchResponseSchema.safeParse(body);
  if (!parsed.success) return null;

  // The `languages` query param above is a hint OpenSubtitles doesn't always honour strictly
  // (mistagged or multi-language entries slip through); re-checked here so the family only ever
  // sees exactly the languages that were actually asked for, never an unrequested extra.
  const allowedLanguages = new Set(input.languages.map((language) => language.toLowerCase()));
  const candidates = parsed.data.data.flatMap((entry) => {
    const file = entry.attributes.files[0];
    if (!file) return [];
    if (allowedLanguages.size && !allowedLanguages.has(entry.attributes.language.toLowerCase())) {
      return [];
    }
    const candidate: SubtitleCandidate = {
      fileId: file.file_id,
      fileName: file.file_name ?? null,
      language: entry.attributes.language,
      release: entry.attributes.release ?? null,
      downloadCount: entry.attributes.download_count ?? null,
      matchedBy: entry.attributes.moviehash_match ? "hash" : "imdb",
    };
    return [candidate];
  });

  // Arabic first — the family's own default — then hash matches (the accurate path per the
  // roadmap), then highest download count breaking ties. `candidates` was just built by this
  // function, so sorting it in place mutates nothing a caller can observe; `toSorted` needs a
  // newer lib target than this package compiles against (see the identical note on
  // `rankCandidates` in `torrent-source.ts`).
  // oxlint-disable-next-line unicorn/no-array-sort
  return candidates.sort((left, right) => {
    const byArabic = Number(right.language === "ar") - Number(left.language === "ar");
    if (byArabic) return byArabic;
    const byMatch = Number(right.matchedBy === "hash") - Number(left.matchedBy === "hash");
    if (byMatch) return byMatch;
    return (right.downloadCount ?? 0) - (left.downloadCount ?? 0);
  });
}

const downloadResponseSchema = z.object({
  link: z.string().url(),
  file_name: z.string().nullish().catch(null),
});

/**
 * OpenSubtitles' download is a two-step dance: `POST /download` with a `file_id` returns a
 * short-lived, quota-counted link, which is then fetched for the actual file bytes. Both steps
 * need the API key, so both happen here — the desktop shell never talks to OpenSubtitles
 * directly, matching how the torrent addon URL also never ships in the client.
 */
export async function downloadSubtitleFile(
  fileId: number,
): Promise<{ bytes: Uint8Array; fileName: string | null } | null> {
  const config = readConfig();
  if (!config) return null;

  try {
    const linkResponse = await fetch(`${apiBase}/download`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Api-Key": config.apiKey,
        "User-Agent": config.userAgent,
      },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!linkResponse.ok) {
      console.warn(`opensubtitles download-link answered ${linkResponse.status}`);
      return null;
    }
    const parsed = downloadResponseSchema.safeParse(await linkResponse.json());
    if (!parsed.success) return null;

    const fileResponse = await fetch(parsed.data.link, {
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!fileResponse.ok) return null;
    const raw = new Uint8Array(await fileResponse.arrayBuffer());
    return { bytes: sanitizeSubtitleBytes(raw), fileName: parsed.data.file_name ?? null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`opensubtitles download unreachable: ${reason}`);
    return null;
  }
}

/**
 * Some Arabic `.srt` files (commonly ones scraped or re-exported from a web page) carry literal
 * HTML named entities — `&rlm;`/`&lrm;` for the bidi marks, occasionally `&nbsp;`/`&amp;` too —
 * instead of the actual Unicode characters. `.srt`/`.vtt` are plain text, not HTML, so libass
 * renders them completely literally: the family sees the entity name printed in the caption. mpv
 * has no entity-decoding option to reach for, so this is fixed once, here, before the file ever
 * reaches the player.
 */
const subtitleHtmlEntities: ReadonlyArray<readonly [RegExp, string]> = [
  [/&rlm;/gi, "‏"],
  [/&lrm;/gi, "‎"],
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#39;/g, "'"],
];

export function sanitizeSubtitleBytes(bytes: Uint8Array): Uint8Array {
  let text = new TextDecoder("utf-8").decode(bytes);
  for (const [pattern, replacement] of subtitleHtmlEntities) {
    text = text.replace(pattern, replacement);
  }
  return new TextEncoder().encode(text);
}
