import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ClockCounterClockwiseIcon,
  EyeSlashIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import { formatTime } from "../format";
import type { FeedbackEvent } from "../types";

/**
 * A large icon that flashes in the middle of the video and fades — the confirmation every desktop
 * player gives for play/pause and volume, so a shortcut isn't silent while the bar is hidden.
 * Only the badge circle carries `data-video-overlay`; the centring wrapper spans the window and
 * cutting a hole that size would remove the picture entirely.
 */
export function CenterFeedback({ event, nonce }: { event: FeedbackEvent | null; nonce: number }) {
  if (!event) return null;
  return (
    <div key={nonce} className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
      <div
        data-video-overlay
        className="flex size-24 animate-in flex-col items-center justify-center gap-1 rounded-full bg-neutral-900 text-white ring-1 ring-white/10 duration-150 fade-in-0 zoom-in-90"
      >
        <FeedbackIcon event={event} />
        <FeedbackCaption event={event} />
      </div>
    </div>
  );
}

function FeedbackIcon({ event }: { event: FeedbackEvent }) {
  switch (event.kind) {
    case "play":
      return <PlayIcon weight="fill" size={32} />;
    case "pause":
      return <PauseIcon weight="fill" size={32} />;
    case "seek":
      return event.deltaSeconds > 0 ? (
        <ArrowClockwiseIcon size={30} />
      ) : (
        <ArrowCounterClockwiseIcon size={30} />
      );
    case "volume":
      if (event.muted || event.value === 0) return <SpeakerSlashIcon size={32} />;
      return event.value < 50 ? <SpeakerLowIcon size={32} /> : <SpeakerHighIcon size={32} />;
    case "lock":
      if (event.mode === "hidden") return <EyeSlashIcon size={28} />;
      if (event.mode === "visible") return <LockSimpleIcon size={28} />;
      return <LockSimpleOpenIcon size={28} />;
    case "resume":
      return <ClockCounterClockwiseIcon size={32} />;
    default:
      return null;
  }
}

function FeedbackCaption({ event }: { event: FeedbackEvent }) {
  const caption =
    event.kind === "volume"
      ? event.muted
        ? "كتم"
        : `${event.value}%`
      : event.kind === "seek"
        ? `${event.deltaSeconds > 0 ? "+" : "−"}${Math.abs(event.deltaSeconds)}s`
        : event.kind === "resume"
          ? formatTime(event.positionSeconds)
          : null;
  if (!caption) return null;
  return <span className="font-mono text-xs tabular-nums text-white/70">{caption}</span>;
}
