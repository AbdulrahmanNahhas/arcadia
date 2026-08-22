import {
  BookOpenIcon,
  FilmSlateIcon,
  GameControllerIcon,
  PlayIcon,
  SparkleIcon,
  StarIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { taxonomyLabels, type Work } from "@/features/library/model";
import { cn } from "@/lib/utils";

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

export const kindLabel: Record<Work["kind"], string> = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  game: "لعبة",
  novel: "رواية",
  manga: "مانغا",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصوّرة",
};

const kindIcon: Record<Work["kind"], typeof StarIcon> = {
  movie: FilmSlateIcon,
  series: TelevisionSimpleIcon,
  anime: SparkleIcon,
  game: GameControllerIcon,
  novel: BookOpenIcon,
  manga: BookOpenIcon,
  comic: BookOpenIcon,
  "visual-novel": BookOpenIcon,
};

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

/* ----------------------------------------------------------------------- */
/* Shared building blocks                                                   */
/* ----------------------------------------------------------------------- */

/** Small translucent pill used for the rating / audience badges over artwork. */
function Pill({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 backdrop-blur-md",
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
 * Rating / audience badges over the artwork.
 * `mode="hover"` keeps the artwork completely clean at rest and only reveals
 * the badges on hover — used on the banner variant so the full image reads
 * uninterrupted until the user actually engages with the card.
 */
function TopBadges({ work, mode = "always" }: { work: Work; mode?: "always" | "hover" }) {
  const audienceLabel = work.audience ? taxonomyLabels.audiences?.[work.audience] : null;
  if (!audienceLabel && work.calculatedRating === null) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex items-center justify-between",
        mode === "hover" &&
          cn("opacity-0 transition-opacity duration-400", EASE, "group-hover/card:opacity-100"),
      )}
    >
      {audienceLabel ? <Pill>{audienceLabel}</Pill> : <span />}

      <div className="flex items-center gap-1.5">
        {/*{work.calculatedRating !== null && (
          <Pill className="font-semibold">
            <StarIcon weight="fill" className="size-3 text-amber-300" />
            {work.calculatedRating.toFixed(1)}
          </Pill>
        )}*/}

        {(work?.awards ?? [])
          .filter((item) => item?.installmentTitle === work?.installmentTitle)
          .map((item) => (
            <Pill
              key={item.id}
              className={cn("font-semibold", item.result === "winner" && "bg-amber-800/65")}
            >
              {item.result === "winner" ? (
                <StarIcon weight="fill" className="size-3 text-amber-300" />
              ) : (
                <StarIcon weight="fill" className="size-3 text-foreground" />
              )}

              {item.result === "winner" ? "فائز" : "مرشح"}
            </Pill>
          ))}
      </div>
    </div>
  );
}

/** Dark wash that fades in on hover so the play glyph and badges stay legible. */
function HoverScrim() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-500",
        EASE,
        "group-hover/card:bg-black/35",
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
      <Button
        variant={"outline"}
        className={cn(
          circleClassName,
          "bg-background/40  backdrop-blur-lg border-2 flex scale-50 items-center justify-center rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
          "transition-all duration-500",
          EASE,
          "opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100",
        )}
      >
        <PlayIcon weight="fill" className={cn(iconClassName, "translate-x-0")} />
      </Button>
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

function PosterCard({ work, className }: { work: Work; className?: string }) {
  const { displayTitle, parentTitle } = getTitleInfo(work);

  return (
    <Link
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      className={cn(
        "group/card block max-w-100 min-w-0 rounded-2xl outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      <article>
        <div
          className={cn(
            "relative aspect-2/3 transform-gpu overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-white/10",
            "transition-all duration-500",
            EASE,
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.03] group-hover/card:shadow-2xl group-hover/card:shadow-black/40 group-hover/card:ring-white/25",
          )}
        >
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-700",
                EASE,
                "group-hover/card:scale-110",
              )}
            />
          ) : (
            <FallbackArt title={displayTitle} />
          )}
          <HoverScrim />
          <PlayGlyph />
          <TopBadges work={work} />
        </div>

        <div className="flex flex-col gap-1 px-0.5 pt-2.5">
          <TitleBlock
            parentTitle={parentTitle}
            title={displayTitle}
            titleClassName="group-hover/card:text-primary"
          />
          <MetaRow work={work} className="text-muted-foreground" showStudio={false} />
        </div>
      </article>
    </Link>
  );
}

function BannerCard({ work, className }: { work: Work; className?: string }) {
  const { displayTitle, parentTitle } = getTitleInfo(work);
  const artwork = work.bannerPath || work.imagePath;

  return (
    <Link
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      className={cn(
        "group/card block min-w-0 snap-start rounded-2xl outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
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
            "transition-all duration-500",
            EASE,
            "group-hover/card:-translate-y-1 group-hover/card:scale-[1.02] group-hover/card:shadow-2xl group-hover/card:shadow-black/40 group-hover/card:ring-white/25",
          )}
        >
          {artwork ? (
            <img
              src={artwork}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-700",
                EASE,
                "group-hover/card:scale-110",
              )}
            />
          ) : (
            <FallbackArt title={displayTitle} />
          )}

          <HoverScrim />
          <PlayGlyph circleClassName="size-16" iconClassName="size-7" />
          <TopBadges work={work} mode="hover" />
        </div>

        <div className="flex flex-col gap-1 px-0.5 pt-2.5">
          <TitleBlock
            parentTitle={parentTitle}
            title={displayTitle}
            titleClassName="group-hover/card:text-primary"
          />
          <MetaRow work={work} className="text-muted-foreground" />
        </div>
      </article>
    </Link>
  );
}

function LogoCard({ work, className }: { work: Work; className?: string }) {
  const { displayTitle, parentTitle } = getTitleInfo(work);
  const artwork = work.logoPath || work.imagePath;

  return (
    <Link
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      className={cn(
        "group/card block min-w-0 rounded-xl outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      <article>
        <div
          className={cn(
            "relative aspect-square transform-gpu overflow-hidden rounded-xl bg-muted ring-1 ring-white/10",
            "transition-all duration-500",
            EASE,
            "group-hover/card:-translate-y-1 group-hover/card:scale-105 group-hover/card:ring-white/25",
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
}: {
  work: Work;
  className?: string;
  variant?: "poster" | "banner" | "logo";
}) {
  if (variant === "logo") return <LogoCard work={work} className={className} />;
  if (variant === "banner") return <BannerCard work={work} className={className} />;
  return <PosterCard work={work} className={className} />;
}
