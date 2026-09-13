import type { ReleaseCalendarItem } from "@arcadia/contracts";
import { BellIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayFormat, installmentKindLabel, monthFormat } from "./shared";

/**
 * One dated release: the same 2:3 poster frame, ring, shadow, and hover lift as `WorkCard`'s
 * `poster` variant, with the release day/month and installment kind overlaid instead of the
 * rating/audience chips a released title would show. This is what lets a rail mix "already out"
 * and "not out yet" cards without one style reading as an afterthought next to the other — sizing
 * is entirely the caller's job (a `RailScroller` track or a CSS grid), never this component's own
 * width. The follow button only appears when `onToggleFollow` is given (the full calendar tab);
 * every lighter "what's next" preview just links straight to the title.
 */
export function ReleaseCard({
  item,
  onToggleFollow,
  pending = false,
}: {
  item: ReleaseCalendarItem;
  onToggleFollow?: () => void;
  pending?: boolean;
}) {
  const date = new Date(item.releaseDate);
  return (
    <div className="group/card flex min-w-0 flex-col gap-2.5">
      <Link to="/titles/$titleId" params={{ titleId: item.titleId }} className="block outline-none">
        <div
          className={cn(
            "relative aspect-2/3 overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-foreground/10",
            "transform-gpu transition-[transform,box-shadow] duration-300 motion-reduce:transition-none",
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.02] group-hover/card:shadow-2xl group-hover/card:shadow-black/40",
            "group-has-[:focus-visible]/card:ring-[3px] group-has-[:focus-visible]/card:ring-primary group-has-[:focus-visible]/card:ring-offset-2 group-has-[:focus-visible]/card:ring-offset-background",
          )}
        >
          {item.posterPath ? (
            <img
              src={item.posterPath}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-500 motion-reduce:transition-none",
                "group-hover/card:scale-[1.06]",
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
            className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-black/60 to-transparent"
          />
          <div
            data-on-artwork
            className="absolute start-2 top-2 flex flex-col items-center justify-center rounded-xl bg-black/70 px-2 py-1 leading-none text-white ring-1 ring-white/15"
          >
            <strong className="text-sm">{dayFormat.format(date)}</strong>
            <span className="mt-0.5 text-[10px]">{monthFormat.format(date)}</span>
          </div>
          <Badge
            variant="secondary"
            data-on-artwork
            className="absolute end-2 top-2 bg-black/65 text-white"
          >
            {installmentKindLabel[item.kind]}
          </Badge>
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
