import type { ReleaseCalendarItem } from "@arcadia/contracts";
import { BellIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayFormat, installmentKindLabel, monthFormat } from "./shared";

/**
 * One dated release: the same 2:3 poster frame, ring, shadow, and hover lift as `PlaybackTile` —
 * one card design language across the archive instead of a bespoke recipe per surface — with the
 * release day/month and installment kind overlaid as glass chips instead of the rating/audience
 * chips a released title would show. This is what lets a rail mix "already out" and "not out yet"
 * cards without one style reading as an afterthought next to the other. `className` sets sizing —
 * a `RailScroller` track's auto-columns, or a plain width in a wrapping grid — never this
 * component's own call, so the same card fits a scrolling shelf and a wrapped calendar grid alike.
 * The follow button only appears when `onToggleFollow` is given (the full calendar tab); every
 * lighter "what's next" preview just links straight to the title.
 */
export function ReleaseCard({
  item,
  onToggleFollow,
  pending = false,
  className,
}: {
  item: ReleaseCalendarItem;
  onToggleFollow?: () => void;
  pending?: boolean;
  className?: string;
}) {
  const date = new Date(item.releaseDate);
  return (
    <div className={cn("group/card flex min-w-0 flex-col gap-2.5", className)}>
      <Link to="/titles/$titleId" params={{ titleId: item.titleId }} className="block outline-none">
        <div
          className={cn(
            "relative aspect-2/3 overflow-hidden rounded-2xl bg-muted",
            "ring-1 ring-border/70",
            "transition-all duration-300",
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.02] group-hover/card:shadow-xl group-hover/card:shadow-foreground/15",
            "group-focus-within/card:ring-2 group-focus-within/card:ring-ring",
            "group-focus-within/card:shadow-xl group-focus-within/card:shadow-foreground/20",
            "motion-reduce:transition-none motion-reduce:transform-none",
          )}
        >
          {item.posterPath ? (
            <img
              src={item.posterPath}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover",
                "transition-transform duration-500",
                "group-hover/card:scale-[1.045]",
                "motion-reduce:transition-none",
              )}
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-br from-primary/25 via-muted to-muted p-3">
              <span className="font-heading text-sm leading-6 text-foreground/90">
                {item.title}
              </span>
            </div>
          )}

          <div
            data-on-artwork
            className="absolute inset-s-2 top-2 flex flex-col items-center justify-center rounded-xl bg-background/80 px-2 py-1 leading-none text-foreground ring-1 ring-border/70 backdrop-blur-md"
          >
            <strong className="text-sm">{dayFormat.format(date)}</strong>
            <span className="mt-0.5 text-[10px] text-muted-foreground">
              {monthFormat.format(date)}
            </span>
          </div>
          <span
            data-on-artwork
            className="absolute inset-e-2 top-2 inline-flex items-center rounded-full bg-background/75 px-2.5 py-1 text-[0.6875rem] font-medium text-foreground ring-1 ring-border/70 backdrop-blur-md"
          >
            {installmentKindLabel[item.kind]}
          </span>
        </div>
      </Link>

      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <h3 className="truncate font-heading text-sm font-semibold text-foreground sm:text-[0.9375rem]">
          {item.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{item.installmentTitle}</p>
      </div>

      {onToggleFollow ? (
        <Button
          size="sm"
          variant={item.followed ? "secondary" : "outline"}
          disabled={pending}
          onClick={onToggleFollow}
        >
          {item.followed ? <CheckCircleIcon /> : <BellIcon />}
          {item.followed ? "تتابعه" : "تابع العمل"}
        </Button>
      ) : null}
    </div>
  );
}
