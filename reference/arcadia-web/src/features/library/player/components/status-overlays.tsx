import { ArrowLeftIcon, CheckCircleIcon, PlayIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { messageFor, type PlaybackFailure } from "../../playback-resolver";
import { AUTOPLAY_NEXT_COUNTDOWN_SECONDS } from "../constants";
import type { PlayerEpisode } from "../episodes";
import { formatEpisodeCode } from "../format";
import type { PlayerStatus } from "../types";

/**
 * Distinguishes *resolving metadata* from *buffering* from *stalled — no peers*. Collapsing these
 * into one spinner is exactly the failure the roadmap forbids: the family cannot tell a slow
 * start from a dead one.
 */
export function busyLabel(
  status: PlayerStatus,
  attempt: { index: number; total: number } | null,
  peers: number | null,
  local = false,
) {
  if (attempt) return `جارٍ تجربة المصدر ${attempt.index} من ${attempt.total}…`;
  if (local && status !== "buffering") return "جارٍ فتح الملف من هذا الجهاز…";
  if (status === "resolving") return "جارٍ العثور على مصدر للتشغيل…";
  if (status === "buffering") {
    return peers === 0 ? "لا يوجد أقران متصلون — التحميل متوقف." : "جارٍ التخزين المؤقت…";
  }
  return "جارٍ تجهيز المشغّل…";
}

/** The pre-first-frame badge: until mpv has a picture there is nothing behind it to obscure. */
export function LoadingBadge({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      <div
        data-video-overlay
        className="flex items-center gap-3 rounded-full bg-neutral-900 px-5 py-3 ring-1 ring-white/10"
      >
        <span className="size-2.5 animate-pulse rounded-full bg-white" />
        <p className="text-sm font-medium text-white">{label}</p>
      </div>
    </div>
  );
}

/**
 * The end card. With autoplay on and a next episode available it counts down and starts it
 * itself; any interaction with the card cancels the countdown, so a family member reaching for
 * "back" is never raced by the next episode starting underneath them.
 */
export function EndedOverlay({
  nextEpisode,
  autoplayNext,
  onPlayNext,
  onLeave,
}: {
  nextEpisode: PlayerEpisode | null;
  autoplayNext: boolean;
  onPlayNext: () => void;
  onLeave: () => void;
}) {
  const counting = autoplayNext && nextEpisode !== null;
  const [secondsLeft, setSecondsLeft] = useState(AUTOPLAY_NEXT_COUNTDOWN_SECONDS);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!counting || cancelled) return;
    if (secondsLeft <= 0) {
      onPlayNext();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((left) => left - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [counting, cancelled, secondsLeft, onPlayNext]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center p-4">
      <div
        data-video-overlay
        role="dialog"
        aria-modal="true"
        aria-label="اكتملت المشاهدة"
        onPointerDown={() => setCancelled(true)}
        onKeyDown={(event) => {
          setCancelled(true);
          if (event.key === "Escape" || event.key === "Backspace") onLeave();
          else clickOnEnter(event);
        }}
        className="pointer-events-auto w-full max-w-md rounded-3xl bg-neutral-900 p-7 text-center ring-1 ring-white/10"
      >
        <CheckCircleIcon className="mx-auto size-10 text-white" weight="fill" />
        <h1 className="mt-4 font-heading text-2xl font-semibold text-white">اكتملت المشاهدة</h1>
        {nextEpisode ? (
          <>
            <p className="mt-2 text-sm leading-6 text-white/70">
              التالي: {formatEpisodeCode(nextEpisode.seasonNumber, nextEpisode.episodeNumber)}
              {nextEpisode.episodeTitle ? ` — ${nextEpisode.episodeTitle}` : ""}
            </p>
            <Button
              className="mt-6 w-full"
              size="lg"
              data-player-control="play-next"
              autoFocus
              onClick={onPlayNext}
            >
              <PlayIcon weight="fill" data-icon="inline-start" />
              {counting && !cancelled
                ? `تشغيل الحلقة التالية (${secondsLeft})`
                : "تشغيل الحلقة التالية"}
            </Button>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-white/70">
            لا توجد حلقة تالية غير مُشاهدة ومتاحة لهذا العمل.
          </p>
        )}
        <Button
          className="mt-3 w-full"
          variant="outline"
          autoFocus={!nextEpisode}
          onClick={onLeave}
        >
          العودة إلى العمل
        </Button>
      </div>
    </div>
  );
}

export function FailureScreen({
  failure,
  detail,
  onBack,
}: {
  failure: PlaybackFailure;
  detail: string | null;
  onBack: () => void;
}) {
  return (
    <main
      className="fixed inset-0 grid place-items-center bg-background p-8"
      dir="rtl"
      onKeyDown={clickOnEnter}
    >
      <div className="max-w-md text-center">
        <WarningCircleIcon size={48} className="mx-auto text-muted-foreground" />
        <h1 className="mt-4 font-heading text-2xl font-semibold">تعذّر التشغيل</h1>
        <p className="mt-3 leading-8 text-muted-foreground">{detail ?? messageFor(failure)}</p>
        <Button className="mt-6" autoFocus onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start rotate-180" /> رجوع إلى تفاصيل العمل
        </Button>
      </div>
    </main>
  );
}

/**
 * The spatial-navigation engine (`SpatialNavigationRoot`) cancels Enter's native activation
 * window-wide, so a focused button on these screens is clicked here instead.
 */
function clickOnEnter(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || !(event.target instanceof HTMLElement)) return;
  event.preventDefault();
  event.target.click();
}
