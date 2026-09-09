import type { ContinueWatchingItem } from "@arcadia/contracts";
import { CheckCircleIcon, PlayIcon, TrashIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { remainingLabel, watchPercent } from "./shared";

/**
 * The single tile every "you were watching this" surface uses — the history grid, the overview's
 * resume row, and the up-next row. One component so those three surfaces stop being three
 * different-looking answers to the same question.
 *
 * Landscape, not a poster: a 16:9 frame is what leaves the progress bar a full tile-width to run
 * along and the metadata line room for a real "يتبقى ..." reading, which is the whole point of a
 * resume surface. `bannerPath` is the intended art; `posterPath` is the fallback, cropped to the
 * same frame so a title with no banner still lines up in the grid instead of breaking the row.
 */
export function PlaybackTile({
  item,
  played = false,
  variant = "grid",
  footnote,
  onRemove,
  removing = false,
  removeLabel,
}: {
  item: ContinueWatchingItem;
  played?: boolean;
  /** `rail` adds the lift-and-shadow treatment every home-page shelf card shares, so a resume
   *  card sitting in a `RailScroller` reads as one of the shelves around it. */
  variant?: "grid" | "rail";
  footnote?: string;
  onRemove?: () => void;
  removing?: boolean;
  removeLabel?: string;
}) {
  const origin = useLocation({ select: (location) => location.href });
  const percent = watchPercent(item.positionSeconds, item.durationSeconds);
  const started = item.positionSeconds > 0;
  /* An "up next" card has never been played, so it gets no status line at all — claiming
   * "بدأته" for something the account has not started would be a plain lie. */
  const status = played
    ? "شوهد بالكامل"
    : started
      ? (remainingLabel(item.positionSeconds, item.durationSeconds) ?? "بدأته")
      : null;
  const artwork = item.bannerPath ?? item.posterPath;
  return (
    <div className="group/tile relative flex min-w-0 flex-col gap-2.5">
      <Link
        to="/player/$installmentId"
        params={{ installmentId: item.installmentId }}
        search={{ titleId: item.titleId, episodeId: item.episodeId, origin }}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className={cn(
            "relative aspect-video overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10",
            variant === "rail" &&
              "shadow-md shadow-black/20 transform-gpu transition-[transform,box-shadow] duration-300 group-hover/tile:-translate-y-1 group-hover/tile:scale-[1.02] group-hover/tile:shadow-2xl group-hover/tile:shadow-black/40 motion-reduce:transition-none",
          )}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 group-hover/tile:scale-[1.04] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-br from-primary/25 via-muted to-muted p-3">
              <span className="font-heading text-sm leading-6 text-foreground/90">
                {item.title}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100 motion-reduce:transition-none">
            <span className="flex size-12 items-center justify-center rounded-full bg-white text-black shadow-lg">
              <PlayIcon weight="fill" className="size-5" />
            </span>
          </div>
          {played ? (
            <span className="absolute top-2 inset-s-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[0.6875rem] font-medium text-white ring-1 ring-white/15">
              <CheckCircleIcon weight="fill" className="size-3.5" />
              مكتمل
            </span>
          ) : null}
          {/* The progress bar sits on the art's bottom edge at a real, readable weight — the point
           *  of this surface is telling how far in you are at a glance, so it is not a hairline. */}
          {percent !== null && !played ? (
            <div
              role="progressbar"
              aria-label={`شاهدت ${percent}٪`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="absolute inset-x-0 bottom-0 h-1.5 bg-black/55"
            >
              <div
                className="h-full rounded-e-full bg-primary"
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex min-w-0 items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <Link
            to="/titles/$titleId"
            params={{ titleId: item.titleId }}
            className="block truncate font-heading text-sm font-semibold hover:text-primary"
          >
            {item.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {item.episodeLabel ?? item.installmentTitle}
          </p>
          {status || footnote ? (
            <p
              className={cn(
                "mt-0.5 truncate text-xs tabular-nums",
                played || !status ? "text-muted-foreground" : "font-medium text-primary",
              )}
            >
              {status}
              {status && percent !== null && !played ? (
                <span className="text-muted-foreground"> · {percent}٪</span>
              ) : null}
              {footnote ? (
                <span className="text-muted-foreground">
                  {status ? " · " : ""}
                  {footnote}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {onRemove ? (
          <button
            type="button"
            aria-label={removeLabel ?? "حذف من السجل"}
            disabled={removing}
            onClick={onRemove}
            className="-me-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/tile:opacity-100 disabled:opacity-40"
          >
            <TrashIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Placeholder in the exact shape of `PlaybackTile` — 16:9 frame, then three metadata lines — so
 *  data arriving swaps in without the grid reflowing around it. */
export function PlaybackTileSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="جارٍ تحميل المتابعات"
      className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-count placeholder, never reordered
        <div key={index} className="flex flex-col gap-2.5">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}
