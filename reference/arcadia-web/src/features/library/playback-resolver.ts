import type { InstallmentStreams, StreamErrorCode } from "@arcadia/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { isDesktopShell } from "./desktop-player";

/**
 * The resolver boundary the roadmap fixes in Phase 1 so later sources are additive:
 * `local → torrent` today, `local → jellyfin → debrid → torrent` later. Everything past this
 * point in the player only sees a `PlaybackSource`, never where it came from.
 */
export type PlaybackSourceKind = "local" | "jellyfin" | "torrent" | "debrid";

export interface PlaybackSource {
  kind: PlaybackSourceKind;
  /** Ranked candidates for a torrent source; a single ready URL for the others. */
  streams: InstallmentStreams;
  /** Absolute path of the kept download when `kind` is `local`; mpv opens it directly. */
  localPath?: string;
}

/** Answers "does this device hold a finished download of this unit?" — a path, or `null`. */
export type LocalLookup = (
  installmentId: string,
  episodeId: string | null,
) => Promise<string | null>;

/** The desktop registry (`src-tauri/src/downloads`); always `null` in a browser. */
export const desktopLocalLookup: LocalLookup = async (installmentId, episodeId) => {
  if (!isDesktopShell()) return null;
  const { desktopDownloads } = await import("./downloads/api");
  const item = await desktopDownloads.find(installmentId, episodeId).catch(() => null);
  return item?.path ?? null;
};

/** For callers that must reach the network even when a local copy exists (starting a download). */
export const noLocalLookup: LocalLookup = async () => null;

export interface PlaybackTargetCandidate {
  watched: boolean;
  positionSeconds: number;
  updatedAt: string;
}

export type PlaybackTargetDecision<T extends PlaybackTargetCandidate> = {
  target: T;
  mode: "resume" | "next" | "replay";
};

/**
 * One ordering rule for every "play" entry point: resume the most recently active unfinished
 * unit, otherwise start the first unwatched unit in catalog order, otherwise offer the first unit
 * again. Callers filter unavailable units before invoking this rule.
 */
export function selectPlaybackTarget<T extends PlaybackTargetCandidate>(
  candidates: readonly T[],
): PlaybackTargetDecision<T> | null {
  if (candidates.length === 0) return null;

  let latestResume: T | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.watched || candidate.positionSeconds <= 0) continue;
    const timestamp = Date.parse(candidate.updatedAt) || 0;
    if (latestResume && timestamp <= latestTimestamp) continue;
    latestResume = candidate;
    latestTimestamp = timestamp;
  }
  if (latestResume) return { target: latestResume, mode: "resume" };

  const next = candidates.find((candidate) => !candidate.watched);
  if (next) return { target: next, mode: "next" };

  const first = candidates[0];
  return first ? { target: first, mode: "replay" } : null;
}

/**
 * Why playback could not start, in a form the UI turns into one specific Arabic sentence. This is
 * the roadmap's "no id / no streams / no peers, never a spinner that never resolves" — the
 * `StreamErrorCode` values come straight from the API, and the two below are added client-side.
 */
export type PlaybackFailure =
  | StreamErrorCode
  /** The addon answered, and had nothing. */
  | "no_streams"
  /** Not running inside the desktop shell. */
  | "not_desktop"
  /** Arcadia's API cannot be reached from this device. */
  | "server_unreachable"
  /** The source did not answer within the playback-resolution deadline. */
  | "upstream_timeout"
  | "unknown";

export class PlaybackError extends Error {
  readonly failure: PlaybackFailure;

  constructor(failure: PlaybackFailure, message: string) {
    super(message);
    this.name = "PlaybackError";
    this.failure = failure;
  }
}

const failureCodes: readonly StreamErrorCode[] = [
  "not_found",
  "not_permitted",
  "no_identifier",
  "unsupported_kind",
  "source_unavailable",
  "source_not_configured",
];

function isFailureCode(code: string): code is StreamErrorCode {
  return failureCodes.some((known) => known === code);
}

/**
 * Resolves what to play for one installment: a kept download on this device first, then the
 * torrent/debrid candidates the API ranks. The shape is the chain, so Phase 5's Jellyfin lookup
 * slots in between without touching any caller.
 */
export async function resolvePlayback(
  installmentId: string,
  episodeId?: string | null,
  cachedStreams?: InstallmentStreams | null,
  findLocal: LocalLookup = desktopLocalLookup,
): Promise<PlaybackSource> {
  const localPath = await findLocal(installmentId, episodeId ?? null);
  if (localPath) {
    return {
      kind: "local",
      localPath,
      streams: {
        installmentId,
        titleId: "",
        streamId: "",
        idSource: "installment.imdb",
        candidates: [],
      },
    };
  }
  if (cachedStreams?.candidates.length) {
    return { kind: "torrent", streams: cachedStreams };
  }

  let streams: InstallmentStreams;
  try {
    const query = episodeId ? `?episodeId=${episodeId}` : "";
    streams = await apiFetch<InstallmentStreams>(
      `/api/v1/installments/${installmentId}/streams${query}`,
      { signal: AbortSignal.timeout(12_000) },
    );
  } catch (error) {
    if (error instanceof ApiError && error.code && isFailureCode(error.code)) {
      // The API already writes the family-facing sentence; the local table is the fallback for a
      // response that carried a code but no message.
      throw new PlaybackError(error.code, error.message || messageFor(error.code));
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
    throw new PlaybackError("no_streams", "لا توجد مصادر متاحة لهذا الفيلم حالياً.");
  }
  // A debrid-configured addon hands back ready URLs rather than info hashes; the transfer layer
  // already treats those as playable without starting a torrent.
  const kind = streams.candidates.every((candidate) => candidate.kind === "direct")
    ? "debrid"
    : "torrent";
  return { kind, streams };
}

const messages = {
  not_found: "لم يُعثر على هذا الفيلم.",
  not_permitted: "هذا العمل خارج نطاق ملفك.",
  no_identifier: "تعذّر تحديد مصدر التشغيل — لا يحمل هذا العمل معرّف IMDb كافياً بعد.",
  unsupported_kind: "لم يُحدَّد رقم الحلقة.",
  source_unavailable: "تعذّر الوصول إلى مصدر البث. حاول مرة أخرى بعد قليل.",
  source_not_configured: "لم يُضبط مصدر البث في هذا التثبيت.",
  no_streams: "لا توجد مصادر متاحة لهذا الفيلم حالياً.",
  not_desktop: "التشغيل متاح في تطبيق سطح المكتب فقط.",
  server_unreachable: "تعذّر الاتصال بخادم العائلة. تحقق من الشبكة وعنوان الخادم.",
  upstream_timeout: "استغرق مصدر البث وقتاً أطول من المتوقع. حاول مجدداً.",
  unknown: "تعذّر تجهيز التشغيل.",
} satisfies Record<PlaybackFailure, string>;

export function messageFor(failure: PlaybackFailure): string {
  return messages[failure];
}
