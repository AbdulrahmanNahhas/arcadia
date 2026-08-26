import type { InstallmentStreams, StreamErrorCode } from "@arcadia/contracts";
import { ApiError, apiFetch } from "@/lib/api";

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
 * Resolves what to play for one installment.
 *
 * Phase 1 has no local-file index to consult yet (`media_files` has no read path), so this goes
 * straight to the torrent source — but the shape is the chain, so Phase 3's local lookup and
 * Phase 5's Jellyfin lookup slot in ahead of it without touching any caller.
 */
export async function resolvePlayback(installmentId: string): Promise<PlaybackSource> {
  let streams: InstallmentStreams;
  try {
    streams = await apiFetch<InstallmentStreams>(`/api/v1/installments/${installmentId}/streams`);
  } catch (error) {
    if (error instanceof ApiError && error.code && isFailureCode(error.code)) {
      // The API already writes the family-facing sentence; the local table is the fallback for a
      // response that carried a code but no message.
      throw new PlaybackError(error.code, error.message || messageFor(error.code));
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
  no_identifier: "لا يحمل هذا الفيلم معرّف IMDb بعد، فتعذّر البحث عن مصادر تشغيله.",
  unsupported_kind: "تشغيل المسلسلات غير متاح بعد — الأفلام فقط في الوقت الحالي.",
  source_unavailable: "تعذّر الوصول إلى مصدر البث. حاول مرة أخرى بعد قليل.",
  source_not_configured: "لم يُضبط مصدر البث في هذا التثبيت.",
  no_streams: "لا توجد مصادر متاحة لهذا الفيلم حالياً.",
  not_desktop: "التشغيل متاح في تطبيق سطح المكتب فقط.",
  unknown: "تعذّر تجهيز التشغيل.",
} satisfies Record<PlaybackFailure, string>;

export function messageFor(failure: PlaybackFailure): string {
  return messages[failure];
}
