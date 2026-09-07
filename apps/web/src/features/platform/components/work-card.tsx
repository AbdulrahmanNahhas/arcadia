import {
  BookOpenIcon,
  FilmSlateIcon,
  GameControllerIcon,
  PlayIcon,
  SparkleIcon,
  StarIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { archiveKeys, getContinueWatching } from "@/features/archive/api";
import type { Work } from "@/features/library/model";
import { revealSpatialTarget, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import { cn } from "@/lib/utils";
import { WorkCardActions } from "./work-card-actions";

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

export const kindLabel = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  game: "لعبة",
  novel: "رواية",
  manga: "مانغا",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصوّرة",
} satisfies Record<Work["kind"], string>;

const kindIcon = {
  movie: FilmSlateIcon,
  series: TelevisionSimpleIcon,
  anime: SparkleIcon,
  game: GameControllerIcon,
  novel: BookOpenIcon,
  manga: BookOpenIcon,
  comic: BookOpenIcon,
  "visual-novel": BookOpenIcon,
} satisfies Record<Work["kind"], typeof StarIcon>;

/** Splits a work into what to show as the eyebrow vs. the headline title. */
function getTitleInfo(work: Work) {
  const officialTitle = work.arabicTitle || work.title;
  const displayTitle = work.installmentTitle || officialTitle;
  const parentTitle =
    work.installmentTitle && work.installmentTitle !== officialTitle ? officialTitle : null;
  return { officialTitle, displayTitle, parentTitle };
}

function getDurationText(work: Work) {
  if (work.episodeCount !== null && work.episodeCount >= 1) return `${work.episodeCount} حلقة`;
  if (work.kind === "movie" && work.runtimeMinutes && work.runtimeMinutes >= 1)
    return `${work.runtimeMinutes} دقيقة`;
  return null;
}

// How many repeated key-down events (the browser's own auto-repeat while a key stays held, not a
// timer we run ourselves) count as "held", not "tapped". A keyboard/remote's first auto-repeat
// normally lands well past the OS's initial ~500ms repeat delay, so requiring at least one repeat
// before treating Enter as a hold keeps a normal tap from ever mis-firing as a hold.
const LONG_PRESS_REPEAT_THRESHOLD = 2;

/**
 * A card is one focusable with two actions, not two overlapping ones: Enter/OK opens the title
 * (unchanged), and *holding* Enter/OK opens the same card-action menu the visible "⋮" button does.
 * Arrow-key navigation into a small button stacked on top of the card it belongs to was exactly
 * the "hard to focus" problem this replaces — the spatial-nav engine's distance math assumes
 * non-overlapping targets, so a button nested inside another focusable's bounds was never
 * reliably reachable by direction. Holding Enter needs no geometry at all: it works the same on a
 * keyboard, a remote, and (for mouse/touch users) the button is still there and still clickable.
 */
function useWorkCardSpatialNavigation(work: Work, focusKey?: string, onOpenActions?: () => void) {
  const pressCount = useRef(0);
  return useSpatialFocusable<object, HTMLAnchorElement>({
    focusKey,
    accessibilityLabel: work.arabicTitle || work.installmentTitle || work.title,
    onEnterPress: () => {
      pressCount.current += 1;
    },
    onEnterRelease: () => {
      const held = pressCount.current >= LONG_PRESS_REPEAT_THRESHOLD;
      pressCount.current = 0;
      if (held) {
        onOpenActions?.();
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLAnchorElement) activeElement.click();
    },
    onFocus: ({ node }) => revealSpatialTarget(node),
  });
}

/* ----------------------------------------------------------------------- */
/* Shared building blocks                                                   */
/* ----------------------------------------------------------------------- */

/** Small translucent pill used for the rating / audience badges over artwork. */
function Pill({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15",
        className,
      )}
      {...props}
    />
  );
}

function Dot() {
  return <span aria-hidden="true">·</span>;
}

/** Parent title (kicker) + headline title, used identically across every variant. */
function TitleBlock({
  parentTitle,
  title,
  size = "base",
  className,
  titleClassName,
}: {
  parentTitle: string | null;
  title: string;
  size?: "sm" | "base";
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {parentTitle && (
        <p className="mb-0.5 flex items-center gap-1 truncate text-xs! font-medium text-muted-foreground/75">
          {/*<StackIcon className="size-3 shrink-0" weight="bold" />*/}
          <span className="truncate">{parentTitle}</span>
        </p>
      )}
      <h3
        className={cn(
          "truncate font-heading font-semibold text-foreground mt-1",
          size === "sm" ? "text-sm" : "text-sm sm:text-base",
          "transition-colors duration-300",
          EASE,
          titleClassName,
        )}
      >
        {title}
      </h3>
    </div>
  );
}

function MetaRow({
  work,
  showDuration = true,
  showStudio = true,
  className,
}: {
  work: Work;
  showDuration?: boolean;
  showStudio?: boolean;
  className?: string;
}) {
  const KindIcon = kindIcon[work.kind];
  const duration = getDurationText(work);
  const studio = work.animationStudios?.[0]?.name || work.creator || null;

  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", className)}>
      <span>{work.year ?? "—"}</span>
      <Dot />
      <span className="flex shrink-0 items-center gap-1">
        <KindIcon className="size-3" />
        {kindLabel[work.kind]}
      </span>
      {showDuration && duration && (
        <>
          <Dot />
          <span className="truncate">{duration}</span>
        </>
      )}
      {showStudio && studio && (
        <>
          <Dot />
          <span className="truncate">{studio}</span>
        </>
      )}
    </p>
  );
}

/**
 * Rating badge over the artwork's top-end corner (opposite the card-action trigger, which owns
 * the top-start corner — see `WorkCard`). No longer shows audience: it sat in the same corner as
 * the action trigger and cluttered every card's most-used corner for a value already visible on
 * the title page itself.
 * `mode="hover"` keeps the artwork completely clean at rest and only reveals the badge on
 * hover/focus — used on the banner variant so the full image reads uninterrupted until the user
 * actually engages with the card.
 */
function TopBadges({ work, mode = "always" }: { work: Work; mode?: "always" | "hover" }) {
  if (work.calculatedRating === null) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-e-2.5 top-2.5 z-10",
        mode === "hover" &&
          cn(
            "opacity-0 transition-opacity duration-200 motion-reduce:transition-none",
            EASE,
            "group-hover/card:opacity-100 group-data-[focused=true]/card:opacity-100",
          ),
      )}
    >
      <Pill className="font-semibold">
        <StarIcon weight="fill" className="size-3 text-amber-300" />
        {work.calculatedRating.toFixed(1)}
      </Pill>
    </div>
  );
}

/** Dark wash that fades in on hover so the play glyph and badges stay legible. */
function HoverScrim() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 motion-reduce:transition-none",
        EASE,
        "group-hover/card:bg-black/35 group-data-[focused=true]/card:bg-black/35",
      )}
    />
  );
}

/** Centered play affordance that scales/fades in on hover. */
function PlayGlyph({
  circleClassName = "size-14",
  iconClassName = "size-6",
}: {
  circleClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div
        aria-hidden="true"
        className={cn(
          circleClassName,
          "flex scale-75 items-center justify-center rounded-full border-2 border-border bg-background/80 text-foreground shadow-lg",
          "opacity-0 transition-[transform,opacity] duration-200 motion-reduce:transition-none",
          EASE,
          "group-hover/card:scale-100 group-hover/card:opacity-100 group-data-[focused=true]/card:scale-100 group-data-[focused=true]/card:opacity-100",
        )}
      >
        <PlayIcon weight="fill" className={cn(iconClassName, "translate-x-0")} />
      </div>
    </div>
  );
}

/**
 * The shared resume decision, surfaced on a catalog card: a thin progress bar along the bottom of
 * the artwork when this title has real in-progress playback. Sourced from `getContinueWatching`
 * (the same bulk, per-account query My Space's continue-watching row already fetches) so every
 * card asking for it dedupes into the one request TanStack Query already has cached — never one
 * request per card. Honors "determinate progress only when duration is known" (`v0.3-roadmap.md`):
 * an unknown duration shows a plain "started" mark rather than a invented percentage.
 */
function useResumeProgress(titleId: string) {
  const { data } = useQuery({
    queryKey: archiveKeys.continueWatching,
    queryFn: getContinueWatching,
    staleTime: 30_000,
  });
  const item = data?.inProgress.find((entry) => entry.titleId === titleId);
  if (!item) return null;
  return {
    progress:
      item.durationSeconds && item.positionSeconds > 0
        ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
        : null,
  };
}

function ResumeIndicator({ titleId }: { titleId: string }) {
  const resume = useResumeProgress(titleId);
  if (!resume) return null;

  if (resume.progress === null) {
    // Same hover/focus reveal as `TopBadges` — an unknown-duration "started" mark is still a text
    // badge, not the thin edge-of-frame bar below, so it follows the same "clean at rest" rule
    // the poster/banner artwork already holds everything else to.
    return (
      <Pill className="pointer-events-none absolute inset-s-2.5 bottom-2.5 z-10 bg-primary/90 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-data-[focused=true]/card:opacity-100 motion-reduce:transition-none">
        بدأت المشاهدة
      </Pill>
    );
  }

  return (
    <div
      role="progressbar"
      aria-label={`تقدّم المشاهدة ${resume.progress}٪`}
      aria-valuenow={resume.progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-black/40"
    >
      <div className="h-full bg-primary" style={{ width: `${resume.progress}%` }} />
    </div>
  );
}

function FallbackArt({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex size-full bg-linear-to-br from-primary/25 via-muted to-muted p-4",
        compact ? "items-center justify-center text-center" : "items-end",
      )}
    >
      <span className="font-heading text-sm leading-6 text-foreground/90">{title}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Variants                                                                  */
/* ----------------------------------------------------------------------- */

function PosterCard({
  work,
  className,
  spatialFocusKey,
  onOpenActions,
}: {
  work: Work;
  className?: string;
  spatialFocusKey?: string;
  onOpenActions?: () => void;
}) {
  const { displayTitle, parentTitle } = getTitleInfo(work);
  const { ref, focused } = useWorkCardSpatialNavigation(work, spatialFocusKey, onOpenActions);

  return (
    <Link
      ref={ref}
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      data-spatial-managed
      data-spatial-focus-key={spatialFocusKey}
      data-focused={focused || undefined}
      className={cn(
        "group/card block max-w-100 min-w-0 rounded-2xl outline-none",
        "focus-visible:outline-none",
        className,
      )}
    >
      <article>
        <div
          className={cn(
            "relative aspect-2/3 transform-gpu overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-white/10",
            "transition-[transform,box-shadow] duration-200 motion-reduce:transform-none motion-reduce:transition-none",
            EASE,
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.02]",
            "group-data-[focused=true]/card:-translate-y-1 group-data-[focused=true]/card:scale-[0.99] group-data-[focused=true]/card:ring-[3px] group-data-[focused=true]/card:ring-primary group-data-[focused=true]/card:shadow-xl",
          )}
        >
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <FallbackArt title={displayTitle} />
          )}
          <HoverScrim />
          <PlayGlyph />
          <TopBadges work={work} mode="hover" />
          <ResumeIndicator titleId={work.id} />
        </div>

        <div className="flex flex-col gap-1 px-0.5 pt-2.5 group-data-[focused=true]/card:-translate-y-1 ">
          <TitleBlock
            parentTitle={parentTitle}
            title={displayTitle}
            titleClassName="group-hover/card:text-primary group-data-[focused=true]/card:text-primary"
          />
          <MetaRow work={work} className="text-muted-foreground" showStudio={false} />
        </div>
      </article>
    </Link>
  );
}

function BannerCard({
  work,
  className,
  spatialFocusKey,
  onOpenActions,
}: {
  work: Work;
  className?: string;
  spatialFocusKey?: string;
  onOpenActions?: () => void;
}) {
  const { displayTitle, parentTitle } = getTitleInfo(work);
  const artwork = work.bannerPath || work.imagePath;
  const { ref, focused } = useWorkCardSpatialNavigation(work, spatialFocusKey, onOpenActions);

  return (
    <Link
      ref={ref}
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      data-spatial-managed
      data-spatial-focus-key={spatialFocusKey}
      data-focused={focused || undefined}
      className={cn(
        "group/card block min-w-0 snap-start rounded-2xl outline-none",
        "focus-visible:outline-none",
        className,
      )}
    >
      <article>
        {/* Artwork is left completely uncovered at rest — no gradient, no text on
            top of it. Everything that used to overlay the image now lives below it,
            same as the poster variant. */}
        <div
          className={cn(
            "relative aspect-video transform-gpu overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-white/10",
            "transition-[transform,box-shadow] duration-200 motion-reduce:transform-none motion-reduce:transition-none",
            EASE,
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.015]",
            "group-data-[focused=true]/card:-translate-y-1 group-data-[focused=true]/card:scale-[1.02] group-data-[focused=true]/card:ring-[3px] group-data-[focused=true]/card:ring-primary group-data-[focused=true]/card:shadow-xl",
          )}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <FallbackArt title={displayTitle} />
          )}

          <HoverScrim />
          <PlayGlyph circleClassName="size-16" iconClassName="size-7" />
          <TopBadges work={work} mode="hover" />
          <ResumeIndicator titleId={work.id} />
        </div>

        <div className="flex flex-col gap-1 px-0.5 pt-2.5">
          <TitleBlock
            parentTitle={parentTitle}
            title={displayTitle}
            titleClassName="group-hover/card:text-primary group-data-[focused=true]/card:text-primary"
          />
          <MetaRow work={work} className="text-muted-foreground" />
        </div>
      </article>
    </Link>
  );
}

function LogoCard({
  work,
  className,
  spatialFocusKey,
}: {
  work: Work;
  className?: string;
  spatialFocusKey?: string;
}) {
  const { displayTitle, parentTitle } = getTitleInfo(work);
  const artwork = work.logoPath || work.imagePath;
  const { ref, focused } = useWorkCardSpatialNavigation(work, spatialFocusKey);

  return (
    <Link
      ref={ref}
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      data-spatial-managed
      data-spatial-focus-key={spatialFocusKey}
      data-focused={focused || undefined}
      className={cn(
        "group/card block min-w-0 rounded-xl outline-none",
        "focus-visible:outline-none",
        className,
      )}
    >
      <article>
        <div
          className={cn(
            "relative aspect-square transform-gpu overflow-hidden rounded-xl bg-muted ring-1 ring-white/10",
            "transition-[transform,box-shadow] duration-200 motion-reduce:transform-none motion-reduce:transition-none",
            EASE,
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.025]",
            "group-data-[focused=true]/card:-translate-y-1 group-data-[focused=true]/card:scale-[1.035] group-data-[focused=true]/card:ring-[3px] group-data-[focused=true]/card:ring-primary group-data-[focused=true]/card:shadow-xl",
          )}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn("size-full object-contain p-5 transition-transform duration-500", EASE)}
            />
          ) : (
            <FallbackArt title={displayTitle} compact />
          )}
          {work.calculatedRating !== null && (
            <Pill className="absolute inset-e-2 top-2 font-semibold">
              <StarIcon weight="fill" className="size-3 text-amber-300" />
              {work.calculatedRating.toFixed(1)}
            </Pill>
          )}
        </div>

        <div className="px-0.5 pt-3">
          <TitleBlock parentTitle={parentTitle} title={displayTitle} size="sm" />
          <MetaRow
            work={work}
            showDuration={false}
            showStudio={false}
            className="mt-1 text-muted-foreground"
          />
        </div>
      </article>
    </Link>
  );
}

/* ----------------------------------------------------------------------- */
/* Public API                                                                */
/* ----------------------------------------------------------------------- */

export function WorkCard({
  work,
  className,
  variant = "poster",
  spatialFocusKey,
}: {
  work: Work;
  className?: string;
  variant?: "poster" | "banner" | "logo";
  spatialFocusKey?: string;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const onOpenActions = () => setActionsOpen(true);

  let card = (
    <PosterCard
      work={work}
      className={className}
      spatialFocusKey={spatialFocusKey}
      onOpenActions={onOpenActions}
    />
  );
  if (variant === "logo") {
    card = <LogoCard work={work} className={className} spatialFocusKey={spatialFocusKey} />;
  } else if (variant === "banner") {
    card = (
      <BannerCard
        work={work}
        className={className}
        spatialFocusKey={spatialFocusKey}
        onOpenActions={onOpenActions}
      />
    );
  }

  const { displayTitle } = getTitleInfo(work);
  return (
    <div className="group/work-card relative min-w-0">
      {card}
      {/* Logo cards are small franchise/collection tiles, not primary browsable titles — the
          action menu only makes sense on the poster/banner cards that stand in for one work. */}
      {variant !== "logo" && (
        <WorkCardActions
          titleId={work.id}
          title={displayTitle}
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          className="absolute start-2.5 top-2.5 z-10"
        />
      )}
    </div>
  );
}
