import type { ContinueWatchingItem, TitleSummary } from "@arcadia/contracts";
import { useNavigate } from "@tanstack/react-router";
import { revealSpatialTarget, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import { cn } from "@/lib/utils";
import { displayTitleOf } from "./api";

/** What every Display card renders from — a catalog summary or a continue-watching row. */
export interface DisplayCardItem {
  id: string;
  title: string;
  subtitle?: string | null;
  posterPath: string | null;
  bannerPath?: string | null;
  /** 0–1 for continue-watching rows. */
  progress?: number | null;
  to: { titleId: string } | { installmentId: string; titleId: string; episodeId: string | null };
}

export function cardItemFromTitle(title: TitleSummary): DisplayCardItem {
  return {
    id: title.id,
    title: displayTitleOf(title),
    subtitle: title.releaseYear ? String(title.releaseYear) : null,
    posterPath: title.posterPath,
    bannerPath: title.bannerPath,
    to: { titleId: title.id },
  };
}

export function cardItemFromResume(row: ContinueWatchingItem): DisplayCardItem {
  return {
    id: `${row.installmentId}:${row.episodeId ?? ""}`,
    title: row.title,
    subtitle: row.episodeLabel ?? row.installmentTitle,
    posterPath: row.posterPath,
    bannerPath: row.bannerPath,
    progress: row.durationSeconds ? row.positionSeconds / row.durationSeconds : null,
    to: { installmentId: row.installmentId, titleId: row.titleId, episodeId: row.episodeId },
  };
}

/**
 * One poster (or banner) in a Display rail/grid. The engine focuses it; the CSS in styles.css
 * scales it and dims its siblings; Enter opens it. `onFocus` lets a page's hero follow the
 * selection. Nothing here has a hover state — there is no pointer on a TV.
 */
export function DisplayCard({
  item,
  focusKey,
  variant = "poster",
  onFocus,
}: {
  item: DisplayCardItem;
  focusKey: string;
  variant?: "poster" | "banner";
  onFocus?: (item: DisplayCardItem) => void;
}) {
  const navigate = useNavigate();
  const open = () => {
    if ("installmentId" in item.to) {
      void navigate({
        to: "/player/$installmentId",
        params: { installmentId: item.to.installmentId },
        search: { titleId: item.to.titleId, episodeId: item.to.episodeId, origin: "/" },
      });
    } else {
      void navigate({ to: "/titles/$titleId", params: { titleId: item.to.titleId } });
    }
  };
  const { ref, focused } = useSpatialFocusable<object, HTMLButtonElement>({
    focusKey,
    accessibilityLabel: item.title,
    onEnterPress: open,
    onFocus: ({ node }) => {
      revealSpatialTarget(node);
      onFocus?.(item);
    },
  });
  const art = variant === "banner" ? (item.bannerPath ?? item.posterPath) : item.posterPath;
  return (
    <button
      ref={ref}
      type="button"
      data-display-card
      data-spatial-focus-key={focusKey}
      data-focused={focused || undefined}
      onClick={open}
      className={cn(
        "group/display-card relative shrink-0 snap-start text-start outline-none",
        variant === "banner" ? "w-[26rem]" : "w-[13.5rem]",
      )}
      aria-label={item.title}
    >
      <div
        data-display-art
        className={cn(
          "relative overflow-hidden rounded-2xl bg-neutral-800",
          variant === "banner" ? "aspect-video" : "aspect-[2/3]",
        )}
      >
        {art ? (
          <img
            src={art}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
            width={variant === "banner" ? 416 : 216}
            height={variant === "banner" ? 234 : 324}
          />
        ) : (
          <div className="grid size-full place-items-center px-4 text-center text-base text-white/60">
            {item.title}
          </div>
        )}
        {item.progress !== null && item.progress !== undefined && (
          <div data-on-artwork className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.round(item.progress * 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2.5 px-1">
        <div
          className={cn(
            "truncate text-base font-semibold text-white transition-opacity",
            focused ? "opacity-100" : "opacity-80",
          )}
        >
          {item.title}
        </div>
        {item.subtitle && <div className="truncate text-sm text-white/50">{item.subtitle}</div>}
      </div>
    </button>
  );
}
