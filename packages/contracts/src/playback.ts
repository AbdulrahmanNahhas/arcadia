import { z } from "zod";

/**
 * Playback source discovery — the API half of the local player (see
 * `docs/player-torrent-roadmap.md`, Phase 1.5). The API talks to the family's
 * Torrentio-compatible Stremio addon, parses and ranks what comes back, and hands the desktop
 * shell typed candidates. Nothing here describes playback *state*; that lives on
 * `upsertPlaybackInputSchema` in `index.ts`.
 */

/**
 * `torrent` candidates carry an `infoHash` the desktop shell turns into a magnet; `direct`
 * candidates carry a ready-to-play `url` instead. A debrid-configured addon returns the latter
 * (roadmap Phase 6), so the shape accommodates it now rather than being reworked later.
 */
export const streamCandidateKindSchema = z.enum(["torrent", "direct"]);

export const streamQualitySchema = z.enum([
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
  "cam",
  "unknown",
]);

export const streamCandidateSchema = z.object({
  /**
   * Stable within a response, and stable across responses for the same physical source:
   * `<infoHash>:<fileIdx>` for torrents, a sha256 prefix of the URL for direct sources. The
   * client uses it as a React key and to report which candidate failover landed on.
   */
  id: z.string(),
  kind: streamCandidateKindSchema,
  /** The addon's `name`, newlines collapsed to `" · "` — e.g. `"NahhasArcadia · 1080p"`. */
  label: z.string(),
  /** The addon's `description ?? title`, verbatim. Free text; already mined for the fields below. */
  description: z.string().nullable(),
  /** 40-char lowercase hex, or `null` on a `direct` candidate. */
  infoHash: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
  /**
   * Index of the video inside a multi-file torrent. `null` means the addon didn't say, and the
   * Stremio spec's rule applies: pick the largest file. Resolving that needs the torrent
   * metadata, so it happens in the desktop shell, not here.
   */
  fileIdx: z.number().int().min(0).nullable(),
  /** Direct playback URL on a `direct` candidate; `null` on a torrent one. */
  url: z.string().url().nullable(),
  /** `behaviorHints.filename` — the reliable name for subtitle matching (roadmap Phase 2). */
  filename: z.string().nullable(),
  /** `tracker:` entries from `sources`, cleaned; `dht:` entries are dropped (librqbit's DHT covers them). */
  trackers: z.array(z.string()),
  bingeGroup: z.string().nullable(),
  /** OpenSubtitles hash pair, when the addon supplies it. */
  videoSize: z.number().int().positive().nullable(),
  videoHash: z.string().nullable(),
  quality: streamQualitySchema,
  /** Vertical resolution behind `quality`, for ranking. `null` when quality is `cam`/`unknown`. */
  height: z.number().int().positive().nullable(),
  seeders: z.number().int().min(0).nullable(),
  sizeBytes: z.number().int().positive().nullable(),
  /** Indexer name parsed out of the description (`⚙️ YTS`). */
  provider: z.string().nullable(),
  /**
   * Whether the source looks English-audio. A heuristic over flag emoji and language words in
   * free text — the addon exposes no structured language field — and the primary ranking key.
   */
  isEnglish: z.boolean(),
  /** Every language `languages`-style detection found in the release's free text — flag emoji
   *  and language words, ISO 639-1 codes (`"en"`, `"ar"`, `"es"`, `"ja"`, …). Best-effort and
   *  frequently just `["en"]` by default (see `detectLanguages` in `torrent-source.ts`), since
   *  the addon has no structured field to read this from — shown to the family as a badge so they
   *  can pick a specific dub manually when auto-ranking doesn't happen to surface it first. */
  languages: z.array(z.string()),
});

/** Which id the addon was queried with, so the UI can explain a miss precisely. */
export const streamIdSourceSchema = z.enum([
  "installment.imdb",
  "installment.tmdb",
  "title.imdb",
  "title.tmdb",
]);

export const installmentStreamsSchema = z.object({
  installmentId: z.string().uuid(),
  titleId: z.string().uuid(),
  /** The Stremio id actually sent, e.g. `tt0133093` or `tmdb:603`. */
  streamId: z.string(),
  idSource: streamIdSourceSchema,
  /** Ranked best-first. Empty means the addon answered with no usable source. */
  candidates: z.array(streamCandidateSchema),
});

/**
 * Failure codes the player UI must be able to tell apart — the roadmap's "fail with a specific,
 * honest message, never a spinner that never resolves".
 */
export const streamErrorCodeSchema = z.enum([
  /** No such installment. */
  "not_found",
  /** The account cannot see this title; the hidden play button is not the access control. */
  "not_permitted",
  /** Neither the installment nor its title carries an id the addon accepts. */
  "no_identifier",
  /** A season resolved with no `episodeId` — playback needs one specific episode. */
  "unsupported_kind",
  /** The addon is unreachable, timed out, or answered with something unparseable. */
  "source_unavailable",
  /** No addon is configured in this deployment. */
  "source_not_configured",
]);

export const streamErrorSchema = z.object({
  code: streamErrorCodeSchema,
  message: z.string(),
});

/**
 * One OpenSubtitles search result (roadmap Phase 2 "Subtitles"). `fileId` is what
 * `POST /installments/{id}/subtitles/{fileId}/download` needs to fetch the actual file — the
 * search response never carries the file itself, only enough to let the family pick a language.
 */
export const subtitleCandidateSchema = z.object({
  fileId: z.number().int(),
  fileName: z.string().nullable(),
  /** ISO 639-1/2 code as OpenSubtitles reports it, e.g. `"en"`, `"ar"`. */
  language: z.string(),
  release: z.string().nullable(),
  downloadCount: z.number().int().min(0).nullable(),
  /** Whether this matched by `moviehash` (accurate) or only by IMDb id (best-effort). */
  matchedBy: z.enum(["hash", "imdb"]),
});

export const installmentSubtitlesSchema = z.object({
  installmentId: z.string().uuid(),
  titleId: z.string().uuid(),
  /** Ranked best-first: hash matches before id-only matches, then download count. */
  candidates: z.array(subtitleCandidateSchema),
});

export type StreamCandidate = z.infer<typeof streamCandidateSchema>;
export type SubtitleCandidate = z.infer<typeof subtitleCandidateSchema>;
export type InstallmentSubtitles = z.infer<typeof installmentSubtitlesSchema>;
export type StreamCandidateKind = z.infer<typeof streamCandidateKindSchema>;
export type StreamQuality = z.infer<typeof streamQualitySchema>;
export type StreamIdSource = z.infer<typeof streamIdSourceSchema>;
export type InstallmentStreams = z.infer<typeof installmentStreamsSchema>;
export type StreamErrorCode = z.infer<typeof streamErrorCodeSchema>;
export type StreamError = z.infer<typeof streamErrorSchema>;
