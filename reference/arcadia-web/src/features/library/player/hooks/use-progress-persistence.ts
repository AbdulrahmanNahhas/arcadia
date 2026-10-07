import { type RefObject, useCallback, useEffect, useRef } from "react";
import { updatePlaybackProgress } from "@/features/social/api";
import { PROGRESS_PERSIST_INTERVAL_MS } from "../constants";
import type { TickSnapshot } from "../types";

/**
 * Writes the playhead to `PUT /api/v1/me/playback`: every 20 s while playing, on pause, on
 * suspend/hide, and once more on unmount. Exposed as a stable ref-backed callback so the
 * streaming-start effect and the transport actions never need `duration` or the offset in their
 * dependency arrays — the stream must never restart because a duration update arrived.
 */
export function useProgressPersistence({
  enabled,
  installmentId,
  episodeId,
  tick,
  duration,
  subtitleOffsetMs,
}: {
  enabled: boolean;
  installmentId: string;
  episodeId: string | null;
  tick: RefObject<TickSnapshot>;
  duration: number;
  subtitleOffsetMs: number;
}) {
  /** Serialises writes so a slower old request cannot overwrite a newer tick. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<() => void>(() => {});

  useEffect(() => {
    latest.current = () => {
      const position = Math.round(tick.current.position);
      if (position <= 0) return;
      const total = tick.current.duration || duration;
      queue.current = queue.current
        .catch(() => undefined)
        .then(() =>
          updatePlaybackProgress({
            installmentId,
            episodeId,
            positionSeconds: position,
            durationSeconds: total > 0 ? Math.round(total) : null,
            subtitleOffsetMs,
          }),
        )
        .catch(() => undefined);
    };
  }, [installmentId, episodeId, duration, subtitleOffsetMs, tick]);

  const persist = useCallback(() => latest.current(), []);

  /** An explicit "start over": the saved row must say 0, not the position a restart left behind. */
  const reset = useCallback(async () => {
    const total = tick.current.duration || duration;
    await updatePlaybackProgress({
      installmentId,
      episodeId,
      positionSeconds: 0,
      durationSeconds: total > 0 ? Math.round(total) : null,
      subtitleOffsetMs,
    }).catch(() => undefined);
  }, [installmentId, episodeId, duration, subtitleOffsetMs, tick]);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(persist, PROGRESS_PERSIST_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, persist]);

  useEffect(() => {
    if (!enabled) return;
    const whenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", whenHidden);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", whenHidden);
    };
  }, [enabled, persist]);

  return { persist, reset };
}
