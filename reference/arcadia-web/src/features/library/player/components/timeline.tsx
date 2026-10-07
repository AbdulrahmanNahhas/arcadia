import { type PointerEvent as ReactPointerEvent, type RefObject, useMemo, useRef } from "react";
import { formatTime } from "../format";
import { usePlayheadPaint } from "../hooks/use-playhead-paint";
import type { TickSnapshot } from "../types";

/**
 * The scrubber row: elapsed · bar · remaining. Deliberately LTR inside the RTL document — a
 * timeline is a spatial metaphor for time and reads left-to-right in every player the family has
 * used. The playhead/buffer/clock nodes are written by `usePlayheadPaint` through refs owned
 * here, so the row never re-renders during playback.
 *
 * Dragging previews the target without seeking every pixel; the seek is issued once on release
 * (or immediately on a plain click), since each seek is an IPC round trip into libmpv.
 */
export function Timeline({
  tick,
  duration,
  onSeekTo,
}: {
  tick: RefObject<TickSnapshot>;
  duration: number;
  onSeekTo: (seconds: number) => void;
}) {
  const scrubber = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const buffered = useRef<HTMLDivElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  const remaining = useRef<HTMLSpanElement>(null);
  const hoverLabel = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const nodes = useMemo(() => ({ scrubber, playhead, buffered, elapsed, remaining }), []);
  usePlayheadPaint({ tick, duration, nodes });

  const preview = (ratio: number) => {
    if (playhead.current) playhead.current.style.width = `${ratio * 100}%`;
  };
  const showHover = (ratio: number, visible: boolean) => {
    const label = hoverLabel.current;
    if (!label) return;
    label.style.opacity = visible && duration > 0 ? "1" : "0";
    label.style.left = `${ratio * 100}%`;
    label.textContent = formatTime(ratio * duration);
  };

  return (
    <div dir="ltr" data-control-row="timeline" className="flex items-center gap-3">
      <span
        ref={elapsed}
        className="w-14 shrink-0 text-end font-mono text-xs tabular-nums text-white/90"
      >
        0:00
      </span>
      <div
        ref={scrubber}
        role="slider"
        aria-label="موضع التشغيل"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={0}
        tabIndex={0}
        data-player-control="timeline"
        className="group relative flex h-8 flex-1 cursor-pointer touch-none items-center outline-none"
        onPointerDown={(event) => {
          if (duration <= 0) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          preview(ratioAt(event));
        }}
        onPointerMove={(event) => {
          const ratio = ratioAt(event);
          showHover(ratio, true);
          if (dragging.current) preview(ratio);
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
          onSeekTo(ratioAt(event) * duration);
        }}
        onPointerLeave={() => showHover(0, false)}
      >
        <div className="relative h-1 w-full rounded-full bg-white/20 transition-[height] duration-150 group-hover:h-1.5 group-focus-visible:h-1.5">
          <div
            ref={buffered}
            className="absolute inset-y-0 left-0 rounded-full bg-white/25"
            style={{ width: "0%" }}
          />
          <div
            ref={playhead}
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: "0%" }}
          >
            <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 scale-0 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.25)] transition-transform duration-150 group-hover:scale-100 group-focus-visible:scale-100" />
          </div>
        </div>
        <span
          ref={hoverLabel}
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-black opacity-0 transition-opacity"
        />
      </div>
      <span ref={remaining} className="w-14 shrink-0 font-mono text-xs tabular-nums text-white/60">
        {duration > 0 ? `-${formatTime(duration)}` : "--:--"}
      </span>
    </div>
  );
}

function ratioAt(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
}
