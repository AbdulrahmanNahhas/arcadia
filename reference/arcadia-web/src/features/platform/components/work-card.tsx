import { titleFormatLabels, titleFormatOf, titleStructureOf } from "@arcadia/domain";
import { CheckIcon, FilmSlateIcon, StarIcon, TelevisionSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { archiveKeys, getContinueWatching } from "@/features/archive/api";
import { taxonomyLabels, type Work } from "@/features/library/model";
import { kindLabelsAr } from "@/features/library/translations";
import { revealSpatialTarget, useSpatialFocusable } from "@/features/platform/spatial-navigation";
import { cn } from "@/lib/utils";
import { WorkCardActionTray } from "./work-card-actions";

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** Kept as a named export here because the platform tables import it by this name. */
export const kindLabel = kindLabelsAr;

// The icon follows the movie/series half of the type; the animated/live-action half is carried
// by the label beside it, so a second visual axis here would just add noise.
const kindIcon = {
  "animated-movie": FilmSlateIcon,
  "animated-series": TelevisionSimpleIcon,
  "live-action-movie": FilmSlateIcon,
  "live-action-series": TelevisionSimpleIcon,
} satisfies Record<Work["kind"], typeof StarIcon>;

/* ----------------------------------------------------------------------- */
/* What a card says                                                          */
/* ----------------------------------------------------------------------- */

/** Splits a work into what to show as the eyebrow vs. the headline title. */
function getTitleInfo(work: Work) {
  const officialTitle = work.arabicTitle || work.title;
  const displayTitle = work.installmentTitle || officialTitle;
  const parentTitle =
    work.installmentTitle && work.installmentTitle !== officialTitle ? officialTitle : null;
  return { displayTitle, parentTitle };
}

function getDurationText(work: Work) {
  if (work.episodeCount !== null && work.episodeCount >= 1) return `${work.episodeCount} حلقة`;
  if (titleStructureOf(work.kind) === "movie" && work.runtimeMinutes && work.runtimeMinutes >= 1)
    return `${work.runtimeMinutes} دقيقة`;
  return null;
}

/**
 * The fact line under the title, built from whatever this work actually knows rather than from a
 * fixed set of slots. A browse listing carries no installments, so episode counts and runtimes are
 * simply absent there (`server/compat.ts`) — the old fixed "year · episodes · studio" line
 * collapsed to a lone year on every title-mode card, which read as a card missing its data rather
 * than a card that never had it.
 *
 * Facts are drawn in priority order and capped, so the line is the same length everywhere: the
 * most specific thing a card can say about itself comes first, and a title-mode card falls through
 * to its studio and then to its format rather than showing a year on its own. Genre is deliberately
 * not a fallback — a single genre out of a work's several is the least true thing a card can say
 * about it, and it repeats down a rail until it stops carrying information at all.
 */
function factsOf(work: Work, limit: number) {
  const facts: string[] = [];
  if (work.year !== null) facts.push(String(work.year));
  const duration = getDurationText(work);
  if (duration) facts.push(duration);
  // Only the two time-sensitive statuses earn a slot; "completed"/"unknown" say nothing a browsing
  // family would act on, and "returning" is true of most of the catalog's series.
  if (work.releaseStatus === "airing") facts.push("يعرض الآن");
  if (work.releaseStatus === "upcoming") facts.push("قادم");
  const studio = work.animationStudios[0]?.name || work.creator;
  if (studio) facts.push(studio);
  // Always available, so the line can never come up short: the icon beside it already carries the
  // film/series half of the type, and this is the animated/live-action half.
  facts.push(titleFormatLabels[titleFormatOf(work.kind)].ar);
  return facts.slice(0, limit);
}

/* ----------------------------------------------------------------------- */
/* Focus and input                                                           */
/* ----------------------------------------------------------------------- */

// How many repeated key-down events (the browser's own auto-repeat while a key stays held, not a
// timer we run ourselves) count as "held", not "tapped". A keyboard/remote's first auto-repeat
// normally lands well past the OS's initial ~500ms repeat delay, so requiring at least one repeat
// before treating Enter as a hold keeps a normal tap from ever mis-firing as a hold.
const LONG_PRESS_REPEAT_THRESHOLD = 2;

/**
 * A card is one focusable with two actions, not several overlapping ones: Enter/OK opens the title,
 * and *holding* Enter/OK opens the same action menu the tray's "⋮" button does. Arrow-key
 * navigation into a small button stacked on top of the card it belongs to was exactly the "hard to
 * focus" problem this replaces — the spatial-nav engine's distance math assumes non-overlapping
 * targets, so a button inside another focusable's bounds was never reliably reachable by
 * direction. Every control in the tray therefore carries `data-spatial-managed` to stay out of the
 * engine's automatic registration, and holding Enter needs no geometry at all: it works the same
 * on a keyboard and a remote, while pointer and Tab users still reach the buttons directly.
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

// The card is quiet until you engage with it: artwork at rest, everything else on hover, on Tab
// focus, on remote focus, or while its own action menu is open. Coarse pointers have no hover to
// reveal anything with, so there the overlays simply stay on.
const FADE_IN = cn(
  "opacity-0 transition-all duration-300 motion-reduce:transition-none",
  EASE,
  "group-hover/card:opacity-100 group-focus-within/card:opacity-100",
  "group-data-[card-focused=true]/card:opacity-100 group-data-[actions-open=true]/card:opacity-100",
  "pointer-coarse:opacity-100",
);

// The same reveal with a short rise under it, for the layer holding the chips and the tray. The
// overlay arrives a beat after the card lifts rather than with it, which is what makes the two
// read as one movement instead of two things starting at once.
const RISE_IN = cn(
  FADE_IN,
  "translate-y-1 transition-all delay-75 motion-reduce:transform-none",
  "group-hover/card:translate-y-0 group-focus-within/card:translate-y-0",
  "group-data-[card-focused=true]/card:translate-y-0 group-data-[actions-open=true]/card:translate-y-0",
  "pointer-coarse:translate-y-0",
);

// Hit-testing has to follow visibility: a fully transparent control still swallows the clicks
// meant for the artwork underneath it.
const REVEAL_POINTER = cn(
  "pointer-events-none",
  "group-hover/card:pointer-events-auto group-focus-within/card:pointer-events-auto",
  "group-data-[card-focused=true]/card:pointer-events-auto",
  "group-data-[actions-open=true]/card:pointer-events-auto",
  "pointer-coarse:pointer-events-auto",
);

// One ring for both ways of arriving without a mouse: a remote (the spatial engine's own focus)
// and Tab. The anchor itself draws no outline — the ring belongs on the artwork, which is what a
// viewer is actually tracking — so `:has()` lets the frame answer for a focus it never receives.
const FOCUS_RING = cn(
  "group-data-[card-focused=true]/card:ring-[3px] group-data-[card-focused=true]/card:ring-primary",
  "group-data-[card-focused=true]/card:ring-offset-2 group-data-[card-focused=true]/card:ring-offset-background",
  "group-has-[:focus-visible]/card:ring-[3px] group-has-[:focus-visible]/card:ring-primary",
  "group-has-[:focus-visible]/card:ring-offset-2 group-has-[:focus-visible]/card:ring-offset-background",
);

// The lift shared by the artwork and by the overlay layer stacked on it. Both boxes have identical
// geometry, so applying one transform to each keeps the badges and the tray locked to the artwork
// while it moves. Remote focus lifts slightly further than hover: it is the state a viewer reads
// from across a room, so it should never be the subtler of the two.
const MOTION = cn(
  "transform-gpu transition-[transform,box-shadow] duration-300",
  "motion-reduce:transform-none motion-reduce:transition-none",
  EASE,
  "group-hover/card:-translate-y-0 group-hover/card:scale-[1] transition-all!",
  "group-data-[actions-open=true]/card:-translate-y-1 group-data-[actions-open=true]/card:scale-[1.0]",
  "group-data-[card-focused=true]/card:-translate-y-1 group-data-[card-focused=true]/card:scale-[1.0]",
);

/**
 * A chip over artwork. Frosted glass — a translucent, blurred `background`/`foreground` pill —
 * rather than a flat color: the blur does the legibility work against whatever the photo behind it
 * looks like, so the chip can stay themed (light glass in light mode, dark glass in dark mode)
 * instead of needing a color fixed against the theme. Everything else — shape, height, type scale,
 * icon sizing — still comes from `Badge`. Matches the glass chips on `PlaybackTile` and
 * `ReleaseCard`, the same overlay language across every catalog card.
 */
function OverlayBadge({ className, ...props }: React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant="secondary"
      data-on-artwork
      className={cn(
        "bg-background/75 text-foreground ring-1 ring-border/70 backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A soft themed vignette, darkest at the corners where the chips and the action tray sit, clear
 * through the middle where the artwork should stay itself. Not load-bearing for legibility — the
 * chips and tray buttons are already opaque/glass on their own — this is the same "a little glassy"
 * depth treatment the rest of the interface uses, so it tracks light/dark mode instead of assuming
 * every poster needs a black wash.
 */
function ArtworkScrim() {
  return (
    <div
      aria-hidden="true"
      data-on-artwork
      className={cn(
        "absolute inset-0 bg-linear-to-t from-background/70 via-transparent to-background/25 -bottom-1.5 -left-1",
        FADE_IN,
      )}
    />
  );
}

/**
 * The two things a family checks before starting something: how the archive scored it, and who it
 * is for. Audience says that second part in the archive's own words ("مراهقون", "عام") rather than
 * as a number to decode; the age rating stands in only where a title has no audience set yet.
 */
function OverlayChips({ work }: { work: Work }) {
  const viewers = work.audience
    ? taxonomyLabels.audiences[work.audience]
    : work.age
      ? taxonomyLabels.ages[work.age]
      : null;
  if (work.calculatedRating === null && viewers === null) return null;

  return (
    <div className="absolute inset-e-2 top-2 flex items-center gap-1.5">
      {work.calculatedRating !== null && (
        <OverlayBadge className="font-semibold">
          <StarIcon weight="fill" className="text-primary" />
          {work.calculatedRating.toFixed(1)}
        </OverlayBadge>
      )}
      {viewers && <OverlayBadge>{viewers}</OverlayBadge>}
    </div>
  );
}

/**
 * The shared resume decision, surfaced on a catalog card: a thin progress bar along the bottom of
 * the artwork when this title has real in-progress playback. Sourced from `getContinueWatching`
 * (the same bulk, per-account query My Space's continue-watching row already fetches) so every
 * card asking for it dedupes into the one request TanStack Query already has cached — never one
 * request per card. Honors "determinate progress only when duration is known" (`v0.3-roadmap.md`):
 * an unknown duration shows a plain "started" mark rather than an invented percentage.
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

/**
 * Same cached `/me/continue-watching` request `useResumeProgress` already reads — this just looks
 * at the `watchedTitleIds`/`watchedInstallmentIds` half of the response instead of `inProgress`,
 * so a card never fires a second request to learn whether it's fully watched.
 *
 * A `Work` is either a title-mode card (`installmentId` null — every season/movie under it must be
 * watched) or an installment-mode card from the flattened browse view (one specific season or
 * movie) — checking the wrong set would show a season card as "watched" only once the *entire*
 * series is, or vice versa, so which set to check follows `installmentId` exactly the same way the
 * mark-watched write path below does.
 */
export function useWorkWatched(work: Pick<Work, "id" | "installmentId">) {
  const { data } = useQuery({
    queryKey: archiveKeys.continueWatching,
    queryFn: getContinueWatching,
    staleTime: 30_000,
  });
  return work.installmentId
    ? (data?.watchedInstallmentIds.includes(work.installmentId) ?? false)
    : (data?.watchedTitleIds.includes(work.id) ?? false);
}

/**
 * A seal, not a label: every other overlay chip on the card is a glass pill because it's reporting
 * a number or a category, but "watched" is binary and permanent, so it gets its own shape —
 * a small stamped disc rather than a badge that has to hold text. Emerald is the one color no
 * other card state borrows (the app's own primary is indigo-leaning, ratings use it too), so the
 * seal reads as "done" at a glance in a row of a dozen posters without needing a caption. Icon-only
 * by design — the ring/glow/shape already say "completed" three different ways.
 */
function WatchedBadge({ watched }: { watched: boolean }) {
  if (!watched) return null;
  return (
    <div
      data-on-artwork
      role="img"
      aria-label="تمّت مشاهدته بالكامل"
      className={cn(
        "absolute inset-s-2 top-2 flex size-5 items-center justify-center rounded-full",
        "bg-emerald-500/30 text-emerald-400 ring-1 ring-emerald-400/70 backdrop-blur-md",
        "shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_0_10px_-1px_rgba(16,185,129,0.85)]",
      )}
    >
      <CheckIcon weight="bold" className="size-3" />
    </div>
  );
}

/**
 * Unlike the rest of the overlay furniture this shows at rest, because "you were partway through
 * this" is the one fact that changes which card you pick — hiding it until hover would mean
 * hovering every card in a row to find the one you left.
 */
function ResumeIndicator({ titleId }: { titleId: string }) {
  const resume = useResumeProgress(titleId);
  if (!resume) return null;

  if (resume.progress === null) {
    return (
      <OverlayBadge className="absolute inset-s-2 top-2 border-transparent bg-primary/90">
        بدأت المشاهدة
      </OverlayBadge>
    );
  }

  return (
    <div
      role="progressbar"
      aria-label={`تقدم المشاهدة ${resume.progress}٪`}
      aria-valuenow={resume.progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="absolute inset-x-3 bottom-2.5 rounded-full h-1 overflow-hidden bg-background/70 ltr"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${Math.max(resume.progress, 2)}%` }}
      />
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

/** Fades artwork in instead of letting it snap over the placeholder as a rail scrolls. */
function Artwork({ src, className }: { src: string; className: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  // A cached image can finish decoding before React attaches `onLoad`, which would otherwise leave
  // it faded out forever; the mount check covers that case.
  useEffect(() => {
    if (imageRef.current?.complete) setLoaded(true);
  }, []);
  return (
    <img
      ref={imageRef}
      onLoad={() => setLoaded(true)}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(
        "size-full transition-all duration-500",
        "motion-reduce:transform-none motion-reduce:transition-none",
        EASE,
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}

/* ----------------------------------------------------------------------- */
/* Variants                                                                  */
/* ----------------------------------------------------------------------- */

// A slow drift inside the frame, under the card's own faster lift. Left off logo tiles, where the
// artwork is a mark centered in padding rather than a photograph filling the frame.
const ART_ZOOM =
  "group-hover/card:scale-[1.06] group-data-[card-focused=true]/card:scale-[1.06] group-data-[actions-open=true]/card:scale-[1.06]";

/**
 * The three forms a catalog card takes. They differ only in what they frame — a 2:3 poster, a
 * 16:9 still, a square franchise mark — so they share one implementation rather than three that
 * drift apart. Logo tiles stand for a whole franchise rather than for one work, so the personal
 * actions that only make sense against a single title are left off them.
 */
const variants = {
  poster: {
    art: (work: Work) => work.imagePath,
    aspect: "aspect-2/3",
    radius: "rounded-2xl",
    fit: cn("object-cover", ART_ZOOM),
    width: "max-w-100",
    facts: 2,
    actions: true,
  },
  banner: {
    art: (work: Work) => work.bannerPath || work.imagePath,
    aspect: "aspect-video",
    radius: "rounded-xl",
    fit: cn("object-cover", ART_ZOOM),
    width: "",
    facts: 3,
    actions: true,
  },
  logo: {
    art: (work: Work) => work.logoPath || work.imagePath,
    aspect: "aspect-square",
    radius: "rounded-xl",
    fit: "object-contain p-2",
    width: "",
    facts: 2,
    actions: false,
  },
};

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
  variant?: keyof typeof variants;
  spatialFocusKey?: string;
}) {
  const frame = variants[variant];
  const [actionsOpen, setActionsOpen] = useState(false);
  const { ref, focused } = useWorkCardSpatialNavigation(work, spatialFocusKey, () =>
    setActionsOpen(true),
  );
  const headingId = useId();
  const { displayTitle, parentTitle } = getTitleInfo(work);
  const artwork = frame.art(work);
  const facts = factsOf(work, frame.facts);
  const KindIcon = kindIcon[work.kind];
  const resume = useResumeProgress(work.id);
  const watched = useWorkWatched(work);

  return (
    // `data-card-focused` mirrors the anchor's own `data-focused` onto the card as a whole, so the
    // overlay layer stacked beside the anchor can style itself from remote focus too. It is a
    // separate attribute rather than a second `data-focused` because exactly one element on the
    // page carries that one — it is how the spatial engine's current target is identified.
    // `data-watched` does the same job for the seal's emerald ring/glow below, which lives on the
    // artwork wrapper rather than on `WatchedBadge` itself so it can react to the whole card's
    // hover/focus state, not just its own.
    <article
      data-card-focused={focused || undefined}
      data-actions-open={actionsOpen || undefined}
      data-watched={watched || undefined}
      className={cn("group/card relative min-w-0", frame.width, className)}
    >
      <Link
        ref={ref}
        to="/titles/$titleId"
        params={{ titleId: work.id }}
        aria-labelledby={headingId}
        data-spatial-managed
        data-spatial-focus-key={spatialFocusKey}
        data-focused={focused || undefined}
        className="block min-w-0 outline-none focus-visible:outline-none"
      >
        <div
          className={cn(
            "relative overflow-hidden bg-muted shadow-md shadow-foreground/15 ring-1 ring-border/70",
            "group-hover/card:shadow-2xl group-hover/card:shadow-foreground/25",
            "group-data-[card-focused=true]/card:shadow-2xl group-data-[card-focused=true]/card:shadow-foreground/25",
            "group-data-[watched=true]/card:ring-emerald-500/30 group-data-[watched=true]/card:ring-2",
            "group-data-[watched=true]/card:group-hover/card:shadow-emerald-500/30 group-data-[watched=true]/card:group-hover/card:ring-emerald-400/60",
            "group-data-[watched=true]/card:group-data-[card-focused=true]/card:shadow-emerald-500/30 group-data-[watched=true]/card:group-data-[card-focused=true]/card:ring-emerald-400/60",
            FOCUS_RING,
            frame.aspect,
            frame.radius,
            MOTION,
          )}
        >
          {artwork ? (
            <Artwork src={artwork} className={frame.fit} />
          ) : (
            <FallbackArt title={displayTitle} compact={variant === "logo"} />
          )}
          <ArtworkScrim />
          <WatchedBadge watched={watched} />
          <ResumeIndicator titleId={work.id} />
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 px-0.5 pt-2.5">
          {parentTitle && (
            <p className="truncate text-xs font-medium text-muted-foreground/75">{parentTitle}</p>
          )}
          <h3
            id={headingId}
            className={cn(
              "truncate font-heading text-sm font-semibold text-foreground",
              "transition-all duration-200 motion-reduce:transition-none",
              EASE,
              "group-hover/card:text-primary group-data-[card-focused=true]/card:text-primary",
              variant === "poster" && "sm:text-[0.9375rem]",
            )}
          >
            {displayTitle}
          </h3>
          {facts.length > 0 && (
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <KindIcon aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{facts.join(" · ")}</span>
            </p>
          )}
        </div>
      </Link>

      {/* The overlay layer is a sibling of the anchor, never a child: an interactive control
          belongs beside a link, not inside one. It reproduces the artwork box exactly — same
          inline extent, same aspect ratio, same lift — so its chips and buttons track the artwork
          as the card moves. */}
      <div className={cn("pointer-events-none absolute inset-x-0 top-0", frame.aspect, MOTION)}>
        <div className={cn("absolute inset-0", RISE_IN)}>
          <OverlayChips work={work} />
          {frame.actions && (
            <WorkCardActionTray
              titleId={work.id}
              installmentId={work.installmentId ?? null}
              title={displayTitle}
              open={actionsOpen}
              onOpenChange={setActionsOpen}
              className={cn(
                "absolute inset-s-2 bottom-3",
                REVEAL_POINTER,
                resume?.progress && "bottom-5",
              )}
            />
          )}
        </div>
      </div>
    </article>
  );
}
