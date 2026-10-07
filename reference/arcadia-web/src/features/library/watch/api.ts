import type { WatchStreams } from "@arcadia/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { messageFor, PlaybackError, type PlaybackSource } from "../playback-resolver";

/** What the watch hub plays: an IMDb id, plus season/episode for a series. */
export interface WatchTarget {
  imdbId: string;
  season: number | null;
  episode: number | null;
}

const imdbPattern = /tt\d{7,10}/i;

/**
 * Accepts what people paste: a bare `tt0133093`, an IMDb URL (`https://www.imdb.com/title/
 * tt0133093/…`), or the digits alone. Returns the normalised id or `null`.
 */
export function parseImdbInput(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(imdbPattern);
  if (match) return match[0].toLowerCase();
  if (/^\d{7,10}$/.test(trimmed)) return `tt${trimmed}`;
  return null;
}

export function watchLabel(target: WatchTarget) {
  return target.season !== null && target.episode !== null
    ? `${target.imdbId} · الموسم ${target.season} · الحلقة ${target.episode}`
    : target.imdbId;
}

/** A blank uuid — the watch hub has no installment/title to report; the schema wants uuids. */
const nullUuid = "00000000-0000-0000-0000-000000000000";

const failureCodes = new Set([
  "not_found",
  "not_permitted",
  "no_identifier",
  "unsupported_kind",
  "source_unavailable",
  "source_not_configured",
]);

/** The watch hub's resolver: same failure vocabulary as `resolvePlayback`, no local step. */
export async function resolveWatchPlayback(target: WatchTarget): Promise<PlaybackSource> {
  const params = new URLSearchParams({ imdbId: target.imdbId });
  if (target.season !== null) params.set("season", String(target.season));
  if (target.episode !== null) params.set("episode", String(target.episode));
  let streams: WatchStreams;
  try {
    streams = await apiFetch<WatchStreams>(`/api/v1/watch/streams?${params.toString()}`, {
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code && failureCodes.has(error.code)) {
      // SAFETY: membership in `failureCodes` was just checked, and that set holds exactly the
      // `StreamErrorCode` values `PlaybackFailure` includes.
      const failure = error.code as Parameters<typeof messageFor>[0];
      throw new PlaybackError(failure, error.message || messageFor(failure));
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new PlaybackError("upstream_timeout", messageFor("upstream_timeout"));
    }
    if (error instanceof TypeError) {
      throw new PlaybackError("server_unreachable", messageFor("server_unreachable"));
    }
    throw new PlaybackError("unknown", messageFor("unknown"));
  }
  if (streams.candidates.length === 0) {
    throw new PlaybackError("no_streams", "لا توجد مصادر لهذا المعرّف حالياً.");
  }
  const kind = streams.candidates.every((candidate) => candidate.kind === "direct")
    ? "debrid"
    : "torrent";
  return {
    kind,
    streams: {
      installmentId: nullUuid,
      titleId: nullUuid,
      streamId: streams.streamId,
      idSource: "installment.imdb",
      candidates: streams.candidates,
    },
  };
}
