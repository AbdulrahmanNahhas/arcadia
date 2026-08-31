import type { StreamCandidate, SubtitleCandidate } from "@arcadia/contracts";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  BroadcastIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  ClosedCaptioningIcon,
  CornersInIcon,
  CornersOutIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EyeSlashIcon,
  GaugeIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  MinusIcon,
  PauseIcon,
  PictureInPictureIcon,
  PlayIcon,
  PlusIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  SpeakerSlashIcon,
  StackIcon,
  WarningCircleIcon,
  WaveformIcon,
} from "@phosphor-icons/react";
import type { ReactNode, RefObject } from "react";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  desktopPlayer,
  knownLanguageTracks,
  listPlayerTracks,
  type PlayerTrack,
} from "./desktop-player";
import { downloadInstallmentSubtitle, getInstallmentSubtitles } from "./subtitle-resolver";

/**
 * The transport bar.
 *
 * Deliberately LTR: the timeline is a spatial metaphor for time and should remain
 * left-to-right, while labels and menus remain Arabic.
 *
 * The playhead, buffered range and elapsed clock are written directly through refs
 * by the parent's requestAnimationFrame loop, so the transport itself does not
 * re-render every frame.
 */

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export interface PlayerControlsProps {
  /** Back-to-the-work navigation lives here because the video surface covers the top of the window. */
  onBack: () => void;
  softwareDecode: boolean;
  buffering: boolean;
  bufferingLabel: string;
  paused: boolean;
  muted: boolean;
  volume: number;
  duration: number;
  fullscreen: boolean;
  speed: number;
  candidates: StreamCandidate[];
  activeCandidateId: string | null;
  scrubberRef: RefObject<HTMLDivElement | null>;
  playheadRef: RefObject<HTMLDivElement | null>;
  bufferedRef: RefObject<HTMLDivElement | null>;
  elapsedRef: RefObject<HTMLSpanElement | null>;
  /**
   * A second node showing the same clock, for the `sm:hidden` mobile layout below. It needs its
   * own ref rather than sharing `elapsedRef`: both spans stay mounted at every breakpoint (only
   * hidden via CSS), and when two DOM nodes are given the identical `RefObject`, React resolves
   * `.current` to whichever commits last — which left the *visible* desktop clock frozen at its
   * static JSX text while the hidden mobile span silently received every update instead.
   */
  mobileElapsedRef: RefObject<HTMLSpanElement | null>;
  onTogglePlay: () => void;
  onSeekBy: (delta: number) => void;
  onScrub: (event: React.PointerEvent<HTMLDivElement>) => void;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
  onSetSpeed: (speed: number) => void;
  onToggleFullscreen: () => void;
  installmentId: string;
  episodeId: string | null;
  /** Account preferences gating the subtitle/audio menus (roadmap Phase 2). */
  subtitleMode: "off" | "allowed";
  canSwitchTracks: boolean;
  subtitleOffsetMs: number;
  onSetSubtitleOffsetMs: (ms: number) => void;
}

export function PlayerControls({
  onBack,
  softwareDecode,
  buffering,
  bufferingLabel,
  paused,
  muted,
  volume,
  duration,
  fullscreen,
  speed,
  candidates,
  activeCandidateId,
  scrubberRef,
  playheadRef,
  bufferedRef,
  elapsedRef,
  mobileElapsedRef,
  onTogglePlay,
  onSeekBy,
  onScrub,
  onToggleMute,
  onSetVolume,
  onSetSpeed,
  onToggleFullscreen,
  installmentId,
  episodeId,
  subtitleMode,
  canSwitchTracks,
  subtitleOffsetMs,
  onSetSubtitleOffsetMs,
}: PlayerControlsProps) {
  const activeVideoHash =
    candidates.find((candidate) => candidate.id === activeCandidateId)?.videoHash ?? null;
  return (
    <>
      {/* `rounded-full` on the wrapper, not just the button: the cut-out follows the *marked*
          element's radius, so a square wrapper would leave black corners around a round button. */}
      <div
        data-video-overlay
        className="pointer-events-auto absolute left-4 top-4 z-50 rounded-full"
      >
        <ControlButton
          label="رجوع إلى تفاصيل العمل"
          hint="Esc"
          onClick={onBack}
          className="size-10 rounded-full border border-white/15 bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white active:scale-95"
        >
          <ArrowLeftIcon size={19} />
        </ControlButton>
      </div>

      <footer
        dir="ltr"
        className="ltr! absolute bottom-0 w-full! z-10 mt-auto! pointer-events-auto! rounded-2xl bg-transparent px-3 pb-3 pt-10 sm:px-5 sm:pb-5 sm:pt-12"
      >
        <div
          data-video-overlay
          className="pointer-events-auto rounded-2xl bg-neutral-900 p-2 ring-1 ring-white/10"
        >
          {/* Scrubber / Timeline */}
          <div className="px-1 pt-0.5 sm:px-2">
            <Timeline
              duration={duration}
              scrubberRef={scrubberRef}
              playheadRef={playheadRef}
              bufferedRef={bufferedRef}
              onScrub={onScrub}
            />
          </div>

          {/* Main Controls */}
          <div className="mt-1 flex items-center justify-between gap-2">
            {/* Left / Primary Control Group */}
            <div className="flex min-w-0 items-center gap-1.5 rounded-xl p-1">
              {/* Seek Pill */}
              <div className="flex h-11 items-center rounded-full border border-white/15 bg-neutral-900 px-1 ring-1 ring-white/10">
                <ControlButton label="رجوع ١٠ ثوانٍ" hint="Left" onClick={() => onSeekBy(-10)}>
                  <ArrowCounterClockwiseIcon size={19} />
                </ControlButton>
                {/* Play/Pause Pill */}
                <ControlButton
                  label={paused ? "تشغيل" : "إيقاف مؤقت"}
                  hint="Space"
                  onClick={onTogglePlay}
                  className="
                    size-12 rounded-full
                    bg-white text-black
                    hover:bg-white/90 hover:text-black
                    focus-visible:bg-white focus-visible:text-black
                    active:scale-95
                  "
                >
                  {paused ? (
                    <PlayIcon weight="fill" size={21} />
                  ) : (
                    <PauseIcon weight="fill" size={21} />
                  )}
                </ControlButton>
                <ControlButton label="تقدّم ١٠ ثوانٍ" hint="Right" onClick={() => onSeekBy(10)}>
                  <ArrowClockwiseIcon size={19} />
                </ControlButton>
              </div>

              {/* Volume Pill */}
              <div className="flex h-11 items-center rounded-full border border-white/15 bg-neutral-900 px-1 ring-1 ring-white/10">
                <VolumeControl
                  muted={muted}
                  volume={volume}
                  onToggleMute={onToggleMute}
                  onSetVolume={onSetVolume}
                />
              </div>

              {/* Time Counter Pill */}
              <div className="flex h-11 items-center rounded-full border border-white/15 bg-neutral-900 px-3 ring-1 ring-white/10">
                <span
                  className="font-mono text-sm font-medium tabular-nums text-white"
                  ref={elapsedRef}
                >
                  0:00
                </span>
                <span className="mx-1.5 text-white/25">/</span>
                <span className="font-mono text-sm tabular-nums text-white/45">
                  {duration > 0 ? formatTime(duration) : "--:--"}
                </span>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center">
                {buffering && (
                  <span className="ms-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-2.5 py-1 text-[11px] text-white/70">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative size-2 rounded-full bg-primary" />
                    </span>
                    <span className="hidden sm:inline">{bufferingLabel}</span>
                    <span className="sm:hidden">جارٍ التحميل</span>
                  </span>
                )}

                {softwareDecode && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="ms-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-100/70">
                          <WarningCircleIcon size={13} />
                          <span className="hidden sm:inline">بالمعالج</span>
                        </span>
                      }
                    >
                      <WarningCircleIcon size={13} />
                      <span className="hidden sm:inline">بالمعالج</span>
                    </TooltipTrigger>

                    <TooltipContent>
                      لم يُفعَّل فك الترميز بكرت الشاشة — التشغيل يعتمد على المعالج
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Right / Secondary Actions Pill */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* 1. Settings Pill (Playback Speed & Source) */}
              <div className="flex h-11 items-center gap-1 rounded-full border border-white/15 bg-neutral-900 p-1 ring-1 ring-white/10">
                <div className="hidden items-center gap-1 sm:flex">
                  <SpeedMenu speed={speed} onSetSpeed={onSetSpeed} />
                  <SourceMenu candidates={candidates} activeCandidateId={activeCandidateId} />
                </div>

                {/* Mobile Compact Menu */}
                <div className="sm:hidden">
                  <MoreMenu
                    speed={speed}
                    candidates={candidates}
                    activeCandidateId={activeCandidateId}
                    onSetSpeed={onSetSpeed}
                    installmentId={installmentId}
                    episodeId={episodeId}
                    subtitleMode={subtitleMode}
                    canSwitchTracks={canSwitchTracks}
                    subtitleOffsetMs={subtitleOffsetMs}
                    onSetSubtitleOffsetMs={onSetSubtitleOffsetMs}
                  />
                </div>
              </div>

              {/* 2. Media & Features Pill (Tracks, Utilities, Casting) */}
              <div className="hidden h-11 items-center gap-1 rounded-full border border-white/15 bg-neutral-900 p-1 ring-1 ring-white/10 lg:flex">
                {/* Media Tracks Group */}
                {subtitleMode !== "off" && (
                  <SubtitleMenu
                    installmentId={installmentId}
                    episodeId={episodeId}
                    videoHash={activeVideoHash}
                    offsetMs={subtitleOffsetMs}
                    onSetOffsetMs={onSetSubtitleOffsetMs}
                  />
                )}

                {canSwitchTracks && <AudioTrackMenu />}

                {/* Subtle divider for extra utilities on XL screens */}
                <div className="hidden h-4 w-px bg-white/15 xl:block mx-0.5" />

                {/* Display & Offline Tools Group */}
                <div className="hidden items-center gap-1 xl:flex">
                  <ComingSoon label="نافذة عائمة" phase="تصل مع النافذة العائمة">
                    <PictureInPictureIcon size={19} />
                  </ComingSoon>

                  <ComingSoon label="البث إلى التلفاز" phase="يصل مع Chromecast">
                    <BroadcastIcon size={19} />
                  </ComingSoon>

                  <ComingSoon label="تنزيل للمشاهدة دون اتصال" phase="يصل مع التنزيل المحلي">
                    <DownloadSimpleIcon size={19} />
                  </ComingSoon>
                </div>
              </div>

              {/* 3. Standalone Fullscreen Button (Symmetrical to Play/Pause button) */}
              <ControlButton
                label={fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
                hint="F"
                onClick={onToggleFullscreen}
                className="
                  size-11 rounded-full
                  border border-white/15 bg-neutral-900 text-white
                  ring-1 ring-white/10
                  hover:bg-neutral-800 hover:text-white
                  active:scale-95
                "
              >
                {fullscreen ? <CornersInIcon size={19} /> : <CornersOutIcon size={19} />}
              </ControlButton>
            </div>
          </div>

          {/* Mobile Time Bar Fallback */}
          <div className="mt-1 flex items-center justify-between px-2 sm:hidden">
            <div className="flex items-center rounded-lg bg-white/5 px-2.5 py-1">
              <span className="font-mono text-[11px] font-medium tabular-nums text-white">
                <span ref={mobileElapsedRef}>0:00</span>
              </span>
              <span className="mx-1.5 text-white/25">/</span>
              <span className="font-mono text-[11px] tabular-nums text-white/45">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

/** Whether the bar auto-hides normally, is pinned visible, or is forced hidden. See `h` in player-page.tsx. */
export type UiLockMode = "auto" | "visible" | "hidden";

/** A momentary confirmation of an action that just happened, shown centred over the picture. */
export type FeedbackEvent =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "volume"; value: number; muted: boolean }
  | { kind: "lock"; mode: UiLockMode }
  | { kind: "resume"; positionSeconds: number };

/**
 * A large icon that flashes in the middle of the video and fades away — the same confirmation
 * every desktop player gives for play/pause and volume, so a toggle triggered by a shortcut isn't
 * silent when the bar itself is hidden. Rendered as a `data-video-overlay` circle exactly like the
 * back button: the cut-out is measured from this element, so it needs no special-casing in the
 * surface layer.
 *
 * `nonce` is supplied by the caller (a counter bumped once per triggered event) rather than
 * generated in here: this component has to stay pure, and telling two same-kind events apart —
 * so a second play/pause press restarts the fade instead of being swallowed by React reusing the
 * still-mounted element — needs an id decided at the moment the event happened, not at render.
 */
export function CenterFeedback({ event, nonce }: { event: FeedbackEvent | null; nonce: number }) {
  if (!event) return null;
  return (
    <div
      key={nonce}
      // Not itself marked `data-video-overlay`: this wrapper spans the whole window (it is what
      // centres the badge), and cutting a hole the size of the window would remove the video
      // entirely. Only the badge circle below needs — and gets — its own cut-out.
      className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
    >
      <div
        data-video-overlay
        className="animate-in fade-in-0 zoom-in-90 flex size-24 flex-col items-center justify-center gap-1 rounded-full bg-neutral-900 text-white ring-1 ring-white/10 duration-150"
      >
        <FeedbackIcon event={event} />
        {event.kind === "volume" && (
          <span className="font-mono text-xs tabular-nums text-white/70">
            {event.muted ? "كتم" : `${event.value}%`}
          </span>
        )}
        {event.kind === "resume" && (
          <span className="font-mono text-xs tabular-nums text-white/70">
            {formatTime(event.positionSeconds)}
          </span>
        )}
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

function Timeline({
  duration,
  scrubberRef,
  playheadRef,
  bufferedRef,
  onScrub,
}: Pick<
  PlayerControlsProps,
  "duration" | "scrubberRef" | "playheadRef" | "bufferedRef" | "onScrub"
>) {
  return (
    <div
      ref={scrubberRef}
      onPointerDown={onScrub}
      role="slider"
      aria-label="موضع التشغيل"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={0}
      tabIndex={0}
      className="
        group relative flex h-7 cursor-pointer items-center
        focus-visible:outline-none
      "
    >
      <div
        className="
          relative h-1.5 w-full rounded-full
          bg-white/15
          transition-[height] duration-150
          group-hover:h-2
          group-focus-visible:h-2
        "
      >
        <div
          ref={bufferedRef}
          className="absolute inset-y-0 left-0 rounded-full bg-white/25"
          style={{ width: "0%" }}
        />

        <div
          ref={playheadRef}
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: "0%" }}
        >
          <span
            className="
              absolute -right-2 top-1/2 size-4
              -translate-y-1/2
              rounded-full
              bg-white
              ring-2 ring-white/25
              opacity-0
              transition-opacity duration-150
              group-hover:opacity-100
              group-focus-visible:opacity-100
            "
          />
        </div>
      </div>
    </div>
  );
}

function VolumeControl({
  muted,
  volume,
  onToggleMute,
  onSetVolume,
}: Pick<PlayerControlsProps, "muted" | "volume" | "onToggleMute" | "onSetVolume">) {
  const Icon =
    muted || volume === 0 ? SpeakerSlashIcon : volume < 50 ? SpeakerLowIcon : SpeakerHighIcon;

  return (
    <div className="group/volume flex h-full ltr! items-center">
      <ControlButton
        label={muted ? "إلغاء الكتم" : "كتم الصوت"}
        hint="M · Up/Down"
        onClick={onToggleMute}
      >
        <Icon size={19} />
      </ControlButton>

      <div
        className="
          flex h-full
          w-0 items-center
          overflow-hidden
          opacity-0
          transition-[width,opacity,margin]
          duration-200
          ease-out
          group-hover/volume:mx-1.5
          group-hover/volume:w-20
          group-hover/volume:opacity-100
          group-focus-within/volume:ms-1.5
          group-focus-within/volume:w-20
          group-focus-within/volume:opacity-100
        "
      >
        <Slider
          value={[muted ? 0 : volume]}
          min={0}
          max={100}
          step={1}
          // Base UI hands back an array for a multi-thumb slider and a number for a single one;
          // this slider has one thumb, so the first entry is the volume either way.
          onValueChange={(value) => onSetVolume(Array.isArray(value) ? (value[0] ?? 0) : value)}
          aria-label="مستوى الصوت"
          className="
            ltr!
            w-full
            **:data-[slot=slider-track]:bg-muted
            **:data-[slot=slider-range]:bg-foreground
            **:data-[slot=slider-thumb]:border-border
            **:data-[slot=slider-thumb]:bg-foreground
          "
        />
      </div>
    </div>
  );
}

function SpeedMenu({ speed, onSetSpeed }: { speed: number; onSetSpeed: (speed: number) => void }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              className={cn(controlButtonClass, speed !== 1 && "text-primary")}
              aria-label="سرعة التشغيل"
            />
          }
        >
          <div className="flex items-center gap-1">
            <GaugeIcon size={18} />
            {speed !== 1 && <span className="text-[11px] font-medium text-primary">{speed}×</span>}
          </div>
        </TooltipTrigger>

        <TooltipContent>سرعة التشغيل</TooltipContent>
      </Tooltip>

      <PopoverContent dir="rtl" className="w-48 p-1.5" sideOffset={10}>
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">سرعة التشغيل</p>
        </div>

        <div className="space-y-0.5">
          {PLAYBACK_SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSetSpeed(option)}
              className="
                flex w-full items-center justify-between
                rounded-lg
                px-3 py-2
                text-sm
                transition-colors
                hover:bg-accent/70
              "
            >
              <span>{option === 1 ? "عادية" : `${option}×`}</span>

              {speed === option && <CheckIcon size={15} className="text-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Every code `detectLanguages` (`apps/api/.../torrent-source.ts`) can produce, labelled in
 *  Arabic for the source picker's language badges — a superset of the audio/subtitle pickers'
 *  own curated four, since a badge is just informational, not a menu the family picks from. */
const SOURCE_LANGUAGE_LABELS: Record<string, string> = {
  en: "الإنجليزية",
  ar: "العربية",
  ja: "اليابانية",
  es: "الإسبانية",
  ru: "الروسية",
  fr: "الفرنسية",
  de: "الألمانية",
  it: "الإيطالية",
  hi: "الهندية",
  ta: "التاميلية",
  te: "التيلوغوية",
  ko: "الكورية",
  pt: "البرتغالية",
  tr: "التركية",
  pl: "البولندية",
  nl: "الهولندية",
  zh: "الصينية",
  fa: "الفارسية",
};

function SourceMenu({
  candidates,
  activeCandidateId,
}: {
  candidates: StreamCandidate[];
  activeCandidateId: string | null;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger className={controlButtonClass} aria-label="مصدر التشغيل" />}
        >
          <StackIcon size={19} />
        </TooltipTrigger>

        <TooltipContent>مصدر التشغيل</TooltipContent>
      </Tooltip>

      <PopoverContent dir="rtl" className="w-96 p-1.5 sm:w-125" sideOffset={10}>
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">المصادر المتاحة</p>

          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
            {candidates.length}
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {candidates.map((candidate) => {
            const active = candidate.id === activeCandidateId;

            return (
              <div
                key={candidate.id}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  "hover:bg-accent/70",
                  active && "bg-primary/10",
                )}
              >
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                  <CheckIcon size={15} className={cn("text-primary", !active && "invisible")} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={candidate.filename ?? candidate.label}
                  >
                    {candidate.filename ?? candidate.label}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/70">
                      {candidate.quality}
                    </span>

                    {candidate.languages.map((language) => (
                      <span
                        key={language}
                        className="rounded bg-primary/15 px-1.5 py-0.5 text-primary"
                      >
                        {SOURCE_LANGUAGE_LABELS[language] ?? language}
                      </span>
                    ))}

                    {candidate.seeders !== null && (
                      <span className="text-muted-foreground">{candidate.seeders} مصدر</span>
                    )}

                    {candidate.sizeBytes !== null && (
                      <span className="text-muted-foreground">
                        {formatBytes(candidate.sizeBytes)}
                      </span>
                    )}

                    {candidate.provider && (
                      <span className="text-muted-foreground">{candidate.provider}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-1 border-t border-white/8 px-2 pt-2 text-[11px] leading-5 text-muted-foreground">
          تبديل المصدر يدوياً يصل في مرحلة لاحقة.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** `sub-delay` moves in whole seconds at the edges of its range, but the family wants finer
 *  control near zero — 100 ms steps read as "nudge", matching every other player's convention. */
const SUBTITLE_OFFSET_STEP_MS = 100;

/**
 * Subtitles (roadmap Phase 2): embedded tracks from mpv's own `track-list`, OpenSubtitles search
 * results to download, and the live `sub-delay` offset — all in one popover rather than three,
 * since a family member reaching for "الترجمات" wants whichever of the three actually gets them a
 * caption, not three separately-labelled dead ends.
 */
function SubtitleMenu({
  installmentId,
  episodeId,
  videoHash,
  offsetMs,
  onSetOffsetMs,
}: {
  installmentId: string;
  episodeId: string | null;
  videoHash: string | null;
  offsetMs: number;
  onSetOffsetMs: (ms: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<PlayerTrack[]>([]);
  const [candidates, setCandidates] = useState<SubtitleCandidate[] | null>(null);
  const [applyingFileId, setApplyingFileId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    void listPlayerTracks("sub").then(setTracks);
    if (candidates !== null) return;
    void getInstallmentSubtitles(installmentId, {
      episodeId: episodeId ?? undefined,
      videoHash: videoHash ?? undefined,
    })
      .then((result) => setCandidates(result.candidates))
      .catch(() => setCandidates([]));
  }, [open, installmentId, episodeId, videoHash, candidates]);

  const applyCandidate = async (candidate: SubtitleCandidate) => {
    setApplyingFileId(candidate.fileId);
    try {
      const file = await downloadInstallmentSubtitle(installmentId, candidate.fileId);
      await desktopPlayer.loadSubtitle(file.bytes, candidate.fileName ?? file.filename);
      setTracks(await listPlayerTracks("sub"));
    } catch {
      // Best-effort: the popover just stays as it was, nothing to load.
    } finally {
      setApplyingFileId(null);
    }
  };

  // Re-reads the track list after every selection, not just on open: without this the checkmark
  // freezes on whatever was selected when the popover last opened, which is what made switching
  // *back* to a track look broken (the button still looked selected, or looked unselected, no
  // matter what was actually playing).
  const selectSubtitleTrack = async (id: string) => {
    await desktopPlayer.setProperty("sid", id).catch(() => undefined);
    setTracks(await listPlayerTracks("sub"));
  };

  const knownTracks = knownLanguageTracks(tracks, "sub");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger className={controlButtonClass} aria-label="الترجمات" />}
        >
          <ClosedCaptioningIcon size={19} />
        </TooltipTrigger>
        <TooltipContent>الترجمات</TooltipContent>
      </Tooltip>

      <PopoverContent dir="rtl" className="w-80 p-1.5" sideOffset={10}>
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">مسارات الترجمة في الملف</p>
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => void selectSubtitleTrack("no")}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/70"
          >
            <span>بلا ترجمة</span>
            {tracks.every((track) => !track.selected) && (
              <CheckIcon size={15} className="text-primary" />
            )}
          </button>
          {knownTracks.length === 0 && tracks.length > 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              لا توجد مسارات ترجمة عربية أو إنجليزية في هذا الملف.
            </p>
          )}
          {knownTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => void selectSubtitleTrack(track.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/70"
            >
              <span className="truncate">{track.label}</span>
              {track.selected && <CheckIcon size={15} className="text-primary" />}
            </button>
          ))}
        </div>

        <div className="mt-1 border-t border-white/8 px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">تنزيل ترجمة</p>
        </div>
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {candidates === null && (
            <p className="px-3 py-2 text-xs text-muted-foreground">جارٍ البحث…</p>
          )}
          {candidates?.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              لا توجد ترجمات متاحة لهذا العمل.
            </p>
          )}
          {candidates?.map((candidate) => (
            <button
              key={candidate.fileId}
              type="button"
              disabled={applyingFileId !== null}
              onClick={() => void applyCandidate(candidate)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-accent/70 disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{candidate.fileName ?? candidate.language}</span>
                <span className="text-[11px] text-muted-foreground">
                  {candidate.language} ·{" "}
                  {candidate.matchedBy === "hash" ? "مطابقة دقيقة" : "مطابقة بالمعرّف"}
                </span>
              </span>
              {applyingFileId === candidate.fileId && (
                <span className="text-[11px] text-muted-foreground">جارٍ التنزيل…</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/8 px-2 pt-2">
          <span className="text-xs font-medium text-muted-foreground">توقيت الترجمة</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="تأخير الترجمة"
              onClick={() => onSetOffsetMs(offsetMs - SUBTITLE_OFFSET_STEP_MS)}
              className={cn(controlButtonClass, "size-7")}
            >
              <MinusIcon size={13} />
            </button>
            <span className="w-14 text-center font-mono text-xs tabular-nums">
              {(offsetMs / 1000).toFixed(1)}s
            </span>
            <button
              type="button"
              aria-label="تقديم الترجمة"
              onClick={() => onSetOffsetMs(offsetMs + SUBTITLE_OFFSET_STEP_MS)}
              className={cn(controlButtonClass, "size-7")}
            >
              <PlusIcon size={13} />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Embedded audio tracks (roadmap Phase 2's "Tracks"), narrowed to the curated language set (see
 * {@link knownLanguageTracks}) — every track shown is clickable, none permanently disabled.
 */
function AudioTrackMenu() {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<PlayerTrack[]>([]);

  useEffect(() => {
    if (!open) return;
    void listPlayerTracks("audio").then(setTracks);
  }, [open]);

  const selectAudioTrack = async (id: string) => {
    await desktopPlayer.setProperty("aid", id).catch(() => undefined);
    setTracks(await listPlayerTracks("audio"));
  };

  const knownTracks = knownLanguageTracks(tracks, "audio");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger className={controlButtonClass} aria-label="المسار الصوتي" />}
        >
          <WaveformIcon size={19} />
        </TooltipTrigger>
        <TooltipContent>المسار الصوتي</TooltipContent>
      </Tooltip>

      <PopoverContent dir="rtl" className="w-64 p-1.5" sideOffset={10}>
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">المسارات الصوتية في الملف</p>
        </div>
        <div className="space-y-0.5">
          {tracks.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              مسار صوتي واحد فقط في هذا الملف.
            </p>
          )}
          {tracks.length > 0 && knownTracks.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              لا توجد مسارات صوتية بالعربية أو الإنجليزية أو اليابانية أو الإسبانية في هذا الملف.
            </p>
          )}
          {knownTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => void selectAudioTrack(track.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/70"
            >
              <span className="truncate">{track.label}</span>
              {track.selected && <CheckIcon size={15} className="text-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MoreMenu({
  speed,
  candidates,
  activeCandidateId,
  onSetSpeed,
  installmentId,
  episodeId,
  subtitleMode,
  canSwitchTracks,
  subtitleOffsetMs,
  onSetSubtitleOffsetMs,
}: {
  speed: number;
  candidates: StreamCandidate[];
  activeCandidateId: string | null;
  onSetSpeed: (speed: number) => void;
  installmentId: string;
  episodeId: string | null;
  subtitleMode: "off" | "allowed";
  canSwitchTracks: boolean;
  subtitleOffsetMs: number;
  onSetSubtitleOffsetMs: (ms: number) => void;
}) {
  const activeVideoHash =
    candidates.find((candidate) => candidate.id === activeCandidateId)?.videoHash ?? null;
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger className={controlButtonClass} aria-label="المزيد" />}
        >
          <DotsThreeIcon size={21} weight="bold" />
        </TooltipTrigger>
      </Tooltip>

      <PopoverContent dir="rtl" className="w-60 p-2" sideOffset={10}>
        <div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">المزيد</div>

        <div className="flex flex-col gap-1">
          <MobileMenuItem
            icon={<GaugeIcon size={18} />}
            label={`سرعة التشغيل${speed !== 1 ? ` · ${speed}×` : ""}`}
          >
            <SpeedMenu speed={speed} onSetSpeed={onSetSpeed} />
          </MobileMenuItem>

          <MobileMenuItem
            icon={<StackIcon size={18} />}
            label={`مصدر التشغيل · ${candidates.length}`}
          >
            <SourceMenu candidates={candidates} activeCandidateId={activeCandidateId} />
          </MobileMenuItem>

          {subtitleMode !== "off" && (
            <MobileMenuItem icon={<ClosedCaptioningIcon size={18} />} label="الترجمات">
              <SubtitleMenu
                installmentId={installmentId}
                episodeId={episodeId}
                videoHash={activeVideoHash}
                offsetMs={subtitleOffsetMs}
                onSetOffsetMs={onSetSubtitleOffsetMs}
              />
            </MobileMenuItem>
          )}

          {canSwitchTracks && (
            <MobileMenuItem icon={<WaveformIcon size={18} />} label="المسار الصوتي">
              <AudioTrackMenu />
            </MobileMenuItem>
          )}

          <MobileMenuItem
            icon={<DownloadSimpleIcon size={18} />}
            label="التنزيل دون اتصال"
            disabled
          />

          <MobileMenuItem icon={<PictureInPictureIcon size={18} />} label="نافذة عائمة" disabled />

          <MobileMenuItem icon={<BroadcastIcon size={18} />} label="البث إلى التلفاز" disabled />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MobileMenuItem({
  icon,
  label,
  children,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  if (children) {
    return (
      <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent/60">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/70">{icon}</span>
          <span>{label}</span>
        </div>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className="
        flex w-full items-center gap-2
        rounded-lg
        px-2.5 py-2
        text-right text-sm
        text-white/70
        transition-colors
        hover:bg-accent/60
        hover:text-white
        disabled:pointer-events-none
        disabled:opacity-30
      "
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const controlButtonClass = `
  grid size-9 shrink-0 place-items-center
  rounded-full
  text-foreground/80
  transition-all duration-150
  hover:bg-accent/50
  hover:text-foreground
  active:scale-95
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-foreground/40
  disabled:pointer-events-none
  disabled:opacity-30
`;

function ControlButton({
  label,
  hint,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(controlButtonClass, className)}
          />
        }
      >
        {children}
      </TooltipTrigger>

      <TooltipContent>
        {label}
        {hint && <span className="ms-2 text-muted-foreground">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A control whose slot exists now so the bar's layout can remain stable,
 * but whose implementation has not landed yet.
 */
function ComingSoon({
  label,
  phase,
  children,
}: {
  label: string;
  phase: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" disabled aria-label={label} className={controlButtonClass} />}
      >
        {children}
      </TooltipTrigger>

      <TooltipContent>
        {label} — {phase}
      </TooltipContent>
    </Tooltip>
  );
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const padded = `${minutes.toString().padStart(hours ? 2 : 1, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;

  return hours ? `${hours}:${padded}` : padded;
}

function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3;

  return gb >= 1 ? `${gb.toFixed(2)} غ.ب` : `${Math.round(bytes / 1024 ** 2)} م.ب`;
}
