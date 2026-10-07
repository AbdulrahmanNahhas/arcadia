import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { ControlButton } from "./control-button";

/**
 * The phone layout's centred transport cluster — a big play/pause with ±10 s either side, the
 * shape every mobile streaming app uses because thumbs land in the middle of the screen, not on
 * a bottom rail. Hidden from `sm` up, where the bar's own transport group takes over.
 */
export function MobileTransport({
  paused,
  onTogglePlay,
  onSeekBackward,
  onSeekForward,
}: {
  paused: boolean;
  onTogglePlay: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
}) {
  return (
    <div
      dir="ltr"
      data-control-row="center"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-8 sm:hidden"
    >
      <div data-video-overlay className="pointer-events-auto rounded-full">
        <ControlButton
          label="رجوع ١٠ ثوانٍ"
          name="seek-back"
          onClick={onSeekBackward}
          className="size-14 bg-neutral-900 ring-1 ring-white/10"
        >
          <ArrowCounterClockwiseIcon size={26} />
        </ControlButton>
      </div>
      <div data-video-overlay className="pointer-events-auto rounded-full">
        <ControlButton
          label={paused ? "تشغيل" : "إيقاف مؤقت"}
          name="play"
          onClick={onTogglePlay}
          className="size-20 bg-white text-black hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black focus-visible:ring-4 focus-visible:ring-white/40"
        >
          {paused ? <PlayIcon weight="fill" size={34} /> : <PauseIcon weight="fill" size={34} />}
        </ControlButton>
      </div>
      <div data-video-overlay className="pointer-events-auto rounded-full">
        <ControlButton
          label="تقدّم ١٠ ثوانٍ"
          name="seek-forward"
          onClick={onSeekForward}
          className="size-14 bg-neutral-900 ring-1 ring-white/10"
        >
          <ArrowClockwiseIcon size={26} />
        </ControlButton>
      </div>
    </div>
  );
}
