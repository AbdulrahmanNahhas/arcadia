import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ClockCounterClockwiseIcon,
  CornersInIcon,
  CornersOutIcon,
  DotsThreeIcon,
  GaugeIcon,
  ListNumbersIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
  StackIcon,
  SubtitlesIcon,
} from "@phosphor-icons/react";
import type { RefObject } from "react";
import type { PlayerActions } from "../hooks/use-player-actions";
import type { PanelKind, TickSnapshot } from "../types";
import { ControlButton } from "./control-button";
import { Timeline } from "./timeline";
import { VolumeControl } from "./volume-control";

export interface ControlBarProps {
  paused: boolean;
  duration: number;
  actions: PlayerActions;
  tick: RefObject<TickSnapshot>;
  /** Which secondary panels the bar offers; a family profile may have tracks locked. */
  showTracks: boolean;
  showEpisodes: boolean;
  hasNextEpisode: boolean;
  sourceCount: number;
  onOpenPanel: (panel: PanelKind) => void;
  onPlayNext: () => void;
}

/**
 * The bottom bar: timeline on top, transport on the left, panels and fullscreen on the right —
 * the layout every family member already knows from Netflix. One opaque rounded panel, one
 * cut-out. Laid out LTR like the timeline it frames; labels stay Arabic.
 */
export function ControlBar({
  paused,
  duration,
  actions,
  tick,
  showTracks,
  showEpisodes,
  hasNextEpisode,
  sourceCount,
  onOpenPanel,
  onPlayNext,
}: ControlBarProps) {
  return (
    <footer
      dir="ltr"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-5 sm:pb-5"
    >
      <div
        data-video-overlay
        className="pointer-events-auto rounded-2xl bg-neutral-900 px-3 pt-2 pb-2 ring-1 ring-white/10 sm:px-4"
      >
        <Timeline
          tick={tick}
          duration={duration}
          onSeekTo={(seconds) => void actions.seekTo(seconds)}
        />

        <div data-control-row="actions" className="mt-1 flex items-center justify-between gap-2">
          <div className="hidden items-center gap-0.5 sm:flex">
            <ControlButton
              label={paused ? "تشغيل" : "إيقاف مؤقت"}
              hint="Space"
              name="play"
              onClick={() => void actions.togglePlay()}
              className="size-11 bg-white text-black hover:bg-white/90 hover:text-black focus-visible:bg-white focus-visible:text-black focus-visible:ring-4 focus-visible:ring-white/40"
            >
              {paused ? (
                <PlayIcon weight="fill" size={22} />
              ) : (
                <PauseIcon weight="fill" size={22} />
              )}
            </ControlButton>
            <ControlButton
              label="رجوع ١٠ ثوانٍ"
              hint="←"
              name="seek-back"
              onClick={() => void actions.seekBackward()}
            >
              <ArrowCounterClockwiseIcon size={22} />
            </ControlButton>
            <ControlButton
              label="تقدّم ١٠ ثوانٍ"
              hint="→"
              name="seek-forward"
              onClick={() => void actions.seekForward()}
            >
              <ArrowClockwiseIcon size={22} />
            </ControlButton>
            <VolumeControl
              muted={actions.muted}
              volume={actions.volume}
              onToggleMute={() => void actions.toggleMute()}
              onSetVolume={(volume) => void actions.changeVolume(volume)}
            />
            <ControlButton
              label="ابدأ من البداية"
              name="restart"
              onClick={() => void actions.restart()}
              className="hidden lg:grid"
            >
              <ClockCounterClockwiseIcon size={22} />
            </ControlButton>
          </div>

          <div className="flex w-full items-center justify-between gap-0.5 sm:w-auto sm:justify-end">
            {hasNextEpisode && (
              <ControlButton label="الحلقة التالية" hint="N" name="next" onClick={onPlayNext}>
                <SkipForwardIcon weight="fill" size={22} />
              </ControlButton>
            )}
            {showEpisodes && (
              <ControlButton
                label="الحلقات"
                hint="E"
                name="episodes"
                onClick={() => onOpenPanel("episodes")}
              >
                <ListNumbersIcon size={22} />
              </ControlButton>
            )}
            {showTracks && (
              <ControlButton
                label="الصوت والترجمة"
                hint="C"
                name="tracks"
                onClick={() => onOpenPanel("tracks")}
              >
                <SubtitlesIcon size={22} />
              </ControlButton>
            )}
            <ControlButton
              label="سرعة التشغيل"
              name="speed"
              active={actions.speed !== 1}
              onClick={() => onOpenPanel("speed")}
              className="hidden sm:grid"
            >
              {actions.speed === 1 ? (
                <GaugeIcon size={22} />
              ) : (
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {actions.speed}×
                </span>
              )}
            </ControlButton>
            <ControlButton
              label={`مصدر التشغيل · ${sourceCount}`}
              name="source"
              onClick={() => onOpenPanel("source")}
              className="hidden sm:grid"
            >
              <StackIcon size={22} />
            </ControlButton>
            <ControlButton
              label={actions.fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
              hint="F"
              name="fullscreen"
              onClick={() => void actions.toggleFullscreen()}
              className="hidden sm:grid"
            >
              {actions.fullscreen ? <CornersInIcon size={22} /> : <CornersOutIcon size={22} />}
            </ControlButton>
            <ControlButton
              label="المزيد"
              name="more"
              onClick={() => onOpenPanel("more")}
              className="sm:hidden"
            >
              <DotsThreeIcon weight="bold" size={24} />
            </ControlButton>
          </div>
        </div>
      </div>
    </footer>
  );
}
