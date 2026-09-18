import { type RefObject, useEffect } from "react";
import { formatTime } from "../format";
import type { TickSnapshot } from "../types";

export interface PlayheadNodes {
  scrubber: RefObject<HTMLDivElement | null>;
  playhead: RefObject<HTMLDivElement | null>;
  buffered: RefObject<HTMLDivElement | null>;
  elapsed: RefObject<HTMLSpanElement | null>;
  remaining: RefObject<HTMLSpanElement | null>;
}

/**
 * The scrubber's paint loop. Extrapolates the 4 Hz tick at display rate and writes straight to
 * the DOM through the caller's refs — nothing here touches React state, so the overlay never
 * re-renders while the film plays. That rule is load-bearing: a transparent WebKitGTK surface
 * repaints on every commit.
 */
export function usePlayheadPaint({
  tick,
  duration,
  nodes,
}: {
  tick: RefObject<TickSnapshot>;
  duration: number;
  nodes: PlayheadNodes;
}) {
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = requestAnimationFrame(paint);
      const snapshot = tick.current;
      const total = snapshot.duration || duration;
      const drift = snapshot.paused ? 0 : (performance.now() - snapshot.at) / 1000;
      // Clamped only when a duration is known: mpv reports none until it has parsed enough of
      // the container, and for a torrent-backed stream that can take a while.
      const raw = snapshot.position + drift;
      const position = total > 0 ? Math.min(raw, total) : raw;

      if (nodes.elapsed.current) nodes.elapsed.current.textContent = formatTime(position);
      if (total <= 0) return;
      if (nodes.remaining.current) {
        nodes.remaining.current.textContent = `-${formatTime(total - position)}`;
      }
      if (nodes.playhead.current) {
        nodes.playhead.current.style.width = `${(position / total) * 100}%`;
      }
      if (nodes.buffered.current) {
        const ahead = Math.min(position + snapshot.cacheSeconds, total);
        nodes.buffered.current.style.width = `${(ahead / total) * 100}%`;
      }
      nodes.scrubber.current?.setAttribute("aria-valuenow", String(Math.round(position)));
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [tick, duration, nodes]);
}
