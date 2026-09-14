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
    <div className="relative flex min-w-0 flex-col gap-2.5">
      <Link
        to="/player/$installmentId"
        params={{ installmentId: item.installmentId }}
        search={{
          titleId: item.titleId,
          episodeId: item.episodeId,
          origin,
        }}
        className="group/tile block rounded-2xl outline-none"
      >
        <div
          className={cn(
            "relative aspect-video overflow-hidden rounded-xl bg-muted",
            "ring-1 ring-border/70",
            "transition-[box-shadow,ring-color,transform] duration-300",
            variant === "rail" &&
              "group-hover/tile:-translate-y-1 group-hover/tile:scale-[1.02] group-hover/tile:shadow-inner group-hover/tile:shadow-foreground/15",
            "group-focus/tile:ring-2 group-focus/tile:ring-ring",
            "group-focus/tile:shadow-xl group-focus/tile:shadow-foreground/20",
            "motion-reduce:transition-none motion-reduce:transform-none",
          )}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover",
                "transition-transform duration-500",
                "group-hover/tile:scale-[1.045]",
                "motion-reduce:transition-none",
              )}
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-br from-primary/25 via-muted to-muted p-4">
              <span className="font-heading text-sm font-medium leading-5 text-foreground/90">
                {item.title}
              </span>
            </div>
          )}

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-background/85 via-background/20 to-transparent"
          />

          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center",
              "bg-background/20 opacity-0 backdrop-blur-[1px]",
              "transition-opacity duration-200",
              "group-hover/tile:opacity-100",
              "group-focus/tile:opacity-100",
              "motion-reduce:transition-none",
            )}
          >
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                "bg-background text-foreground",
                "ring-1 ring-border/80 shadow-xl shadow-foreground/20",
                "transition-transform duration-200",
                "group-hover/tile:scale-105",
                "group-focus/tile:scale-105",
                "motion-reduce:transition-none",
              )}
            >
              <PlayIcon weight="fill" className="ms-0.5 size-5" />
            </span>
          </div>

          {played ? (
            <span className="absolute inset-s-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/75 px-2.5 py-1 text-[0.6875rem] font-medium text-foreground ring-1 ring-border/70 backdrop-blur-md">
              <CheckCircleIcon weight="fill" className="size-3.5 text-primary" />
              مكتمل
            </span>
          ) : null}

          {percent !== null && !played ? (
            <div
              role="progressbar"
              aria-label={`شاهدت ${percent}٪`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="absolute inset-x-3 bottom-1.5 rounded-full h-1 overflow-hidden bg-background/70 ltr"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-sm font-semibold leading-5 text-foreground">
            {item.title}
          </div>

          {(item.episodeLabel ?? item.installmentTitle) !== item.title ? (
            <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
              {item.episodeLabel ?? item.installmentTitle}
            </p>
          ) : null}

          {status || footnote || (percent !== null && !played) ? (
            <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-5 tabular-nums">
              {status ? (
                <span
                  className={cn(
                    "truncate",
                    played ? "text-muted-foreground" : "font-medium text-primary",
                  )}
                >
                  {status}
                </span>
              ) : null}

              {percent !== null && !played ? (
                <>
                  {status ? (
                    <span aria-hidden className="shrink-0 text-muted-foreground/60">
                      ·
                    </span>
                  ) : null}

                  <span className="shrink-0 text-muted-foreground">{percent}٪</span>
                </>
              ) : null}

              {footnote ? (
                <>
                  {status || (percent !== null && !played) ? (
                    <span aria-hidden className="shrink-0 text-muted-foreground/60">
                      ·
                    </span>
                  ) : null}

                  <span className="min-w-0 truncate text-muted-foreground">{footnote}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {onRemove ? (
          <button
            type="button"
            aria-label={removeLabel ?? "حذف من السجل"}
            disabled={removing}
            onClick={onRemove}
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
              "text-muted-foreground opacity-0",
              "transition-[opacity,background-color,color] duration-150",
              "hover:bg-destructive/10 hover:text-destructive",
              "focus-visible:opacity-100 focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              "group-hover/tile:opacity-100",
              "disabled:pointer-events-none disabled:opacity-40",
              "motion-reduce:transition-none",
            )}
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
