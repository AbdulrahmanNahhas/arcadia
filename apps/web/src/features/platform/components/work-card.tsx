import {
  ArrowLeftIcon,
  BookOpenIcon,
  FilmSlateIcon,
  GameControllerIcon,
  SparkleIcon,
  StackIcon,
  StarIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { taxonomyLabels, type Work } from "@/features/library/model";
import { cn } from "@/lib/utils";

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

function taxonomyLabel<T extends Record<PropertyKey, string>>(labels: T, value: string) {
  return value in labels ? labels[value as keyof T] : value;
}

export function WorkCard({
  work,
  className,
  variant = "poster",
}: {
  work: Work;
  className?: string;
  variant?: "poster" | "banner" | "logo";
}) {
  const KindIcon = kindIcon[work.kind];
  const officialTitle = work.arabicTitle || work.title;
  const displayTitle = work.installmentTitle || officialTitle;
  const parentTitle =
    work.installmentTitle && work.installmentTitle !== officialTitle ? officialTitle : null;
  const logoArtworkPath = work.logoPath || work.imagePath;
  const bannerArtworkPath = work.bannerPath || work.imagePath || work.logoPath;

  const durationText =
    work.episodeCount !== null && work.episodeCount >= 1
      ? `${work.episodeCount} حلقة`
      : work.kind === "movie" && work.runtimeMinutes && work.runtimeMinutes >= 1
        ? `${work.runtimeMinutes} دقيقة`
        : null;

  const studioOrCreator = work.animationStudios?.[0]?.name || work.creator || null;

  if (variant === "logo") {
    return (
      <Link
        to="/titles/$titleId"
        params={{ titleId: work.id }}
        className={cn(
          "group/card block min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          className,
        )}
      >
        <article>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-white/8 transition duration-300 group-hover/card:-translate-y-1 group-focus-visible/card:-translate-y-1 group-hover/card:ring-white/20 group-focus-visible/card:ring-white/20 motion-reduce:transition-none">
            {logoArtworkPath ? (
              <img
                src={logoArtworkPath}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-contain p-5 transition duration-500 group-hover/card:scale-[1.035] group-focus-visible/card:scale-[1.035] motion-reduce:transition-none"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/25 via-muted to-muted p-4 text-center">
                <span className="font-heading text-sm leading-6">{displayTitle}</span>
              </div>
            )}
            {work.calculatedRating !== null && (
              <span className="absolute inset-e-2 top-2 flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                <StarIcon weight="fill" className="text-amber-300" />
                {work.calculatedRating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="px-0.5 pt-3">
            <h3 className="truncate font-heading text-sm font-medium text-foreground">
              {displayTitle}
            </h3>
            {parentTitle && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{parentTitle}</p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{work.year ?? "—"}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <KindIcon className="size-3" />
                {kindLabel[work.kind]}
              </span>
            </p>
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "banner") {
    return (
      <Link
        to="/titles/$titleId"
        params={{ titleId: work.id }}
        className={cn(
          "group/card mt-1.5 block min-w-0 snap-start overflow-visible rounded-2xl pb-13 focus-visible:outline-2 focus-visible:pb-18 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <article className="relative aspect-video overflow-visible rounded-2xl bg-muted shadow-lg shadow-background/10 ring-1 ring-white/8 transition-all duration-600 ease-out group-hover/card:z-10 group-focus-visible/card:z-10 group-hover/card:-translate-y-2 group-focus-visible/card:-translate-y-2 group-hover/card:scale-[1.020] group-focus-visible/card:scale-[1.020] group-hover/card:shadow-2xl group-focus-visible/card:shadow-2xl group-hover/card:shadow-background/40 group-focus-visible/card:shadow-background/40 group-hover/card:ring-white/25 group-focus-visible/card:ring-white/25">
          {bannerArtworkPath ? (
            <img
              src={bannerArtworkPath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full overflow-hidden rounded-2xl object-cover transition duration-700 ease-out group-hover/card:scale-100 group-focus-visible/card:scale-100 motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-t from-primary/25 via-muted to-muted p-4">
              <span className="font-heading text-sm leading-6">{displayTitle}</span>
            </div>
          )}
          <div
            className={cn(
              "absolute -inset-1 bg-linear-to-t from-background/0 via-background/0 via-40% to-transparent transition duration-200",
              "group-hover/card:from-background group-focus-visible/card:from-background group-hover/card:via-background/70 group-focus-visible/card:via-background/70",
            )}
          />

          {/* Top Badges (Audience & Rating) */}
          <div className="absolute inset-x-3 top-2 flex items-center justify-between pointer-events-none">
            {work.audience && taxonomyLabels.audiences?.[work.audience] ? (
              <span className="rounded-full bg-background/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md ring-1 ring-white/10">
                {taxonomyLabels.audiences[work.audience]}
              </span>
            ) : (
              <span />
            )}

            {work.calculatedRating !== null && (
              <span className="flex items-center gap-1 rounded-full bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/10">
                <StarIcon weight="fill" className="text-amber-300" />
                {work.calculatedRating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Slide-Up Panel */}
          <div className="absolute inset-x-0 -bottom-12 border border-t-0 pt-12 rounded-b-2xl border-transparent p-4 translate-y-0 transition-all delay-50 duration-300 ease-out group-hover/card:-bottom-20 group-focus-visible/card:-bottom-20 group-hover/card:pb-10 group-focus-visible/card:pb-10 group-hover/card:border-border group-focus-visible/card:border-border">
            <div className="relative top-22 group-hover/card:top-8 group-focus-visible/card:top-8 duration-300">
              {parentTitle && (
                <p className="mt-0.5 truncate text-xs text-white/60">{parentTitle}</p>
              )}
              <h3 className="truncate font-heading text-sm font-semibold text-white sm:text-base">
                {displayTitle}
              </h3>

              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                <span>{work.year ?? "—"}</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <KindIcon className="size-3" weight="fill" />
                  {kindLabel[work.kind]}
                </span>
                {durationText && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{durationText}</span>
                  </>
                )}
                {studioOrCreator && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-30">{studioOrCreator}</span>
                  </>
                )}
              </p>
            </div>

            {/* Bottom Section: Mapped Genres + Tones */}
            <div className="relative top-12 mt-4 flex h-10 items-start justify-between gap-2 pt-2.5 text-xs text-white opacity-0 transition-all delay-50 duration-300 group-hover/card:top-4 group-focus-visible/card:top-4 group-hover/card:opacity-100 group-focus-visible/card:opacity-100">
              <div className="flex max-h-10 flex-wrap items-center gap-1 px-px overflow-hidden">
                {/* Genres */}
                {work.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-xs"
                  >
                    {taxonomyLabel(taxonomyLabels.genres, genre)}
                  </span>
                ))}

                {/* Tones */}
                {work.tone?.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-primary/25 ring-1 ring-primary/30 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground backdrop-blur-xs"
                  >
                    {taxonomyLabel(taxonomyLabels.tones, t)}
                  </span>
                ))}
              </div>

              <span className="ms-3 flex relative top-4 shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-background">
                استكشف
                <ArrowLeftIcon />
              </span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  // Default: Poster
  return (
    <Link
      to="/titles/$titleId"
      params={{ titleId: work.id }}
      className={cn(
        "max-w-100 group/card block min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      <article>
        <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted shadow-md shadow-black/20 ring-1 ring-white/10 transition-all duration-500 ease-out group-hover/card:-translate-y-1.5 group-focus-visible/card:-translate-y-1.5 group-hover/card:shadow-2xl group-focus-visible/card:shadow-2xl group-hover/card:shadow-black/40 group-focus-visible/card:shadow-black/40 group-hover/card:ring-white/20 group-focus-visible/card:ring-white/20 motion-reduce:transition-none">
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-105 group-focus-visible/card:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-t from-primary/25 via-muted to-muted p-4">
              <span className="font-heading text-sm leading-6">{displayTitle}</span>
            </div>
          )}

          {/* Gradient Overlay for Hover */}
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100" />

          {/* Top Badges (Audience & Rating) */}
          <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between pointer-events-none z-10">
            {work.audience && taxonomyLabels.audiences?.[work.audience] ? (
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md ring-1 ring-white/10">
                {taxonomyLabels.audiences[work.audience]}
              </span>
            ) : (
              <span />
            )}

            {work.calculatedRating !== null && (
              <span className="flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md ring-1 ring-white/10">
                <StarIcon weight="fill" className="text-amber-300 size-3" />
                {work.calculatedRating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Hover Bottom Overlay: Genre Chips + Arrow CTA */}
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 opacity-0 transition-all duration-300 translate-y-2 group-hover/card:translate-y-0 group-focus-visible/card:translate-y-0 group-hover/card:opacity-100 group-focus-visible/card:opacity-100 z-10">
            <div className="flex flex-wrap gap-1 overflow-hidden">
              {work.genres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs ring-1 ring-white/10"
                >
                  {taxonomyLabel(taxonomyLabels.genres, genre)}
                </span>
              ))}
            </div>

            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-background shadow-lg transition-transform duration-200 group-hover/card:scale-110 group-focus-visible/card:scale-110">
              <ArrowLeftIcon className="size-3.5" />
            </span>
          </div>
        </div>

        {/* Text Section Below Poster */}
        <div className="px-0.5 pt-2.5 flex flex-col gap-1">
          {parentTitle && (
            <p className="mt-0.5 truncate text-[11px] flex items-center gap-1 text-muted-foreground">
              <StackIcon />
              {parentTitle}
            </p>
          )}
          <h3 className="truncate font-heading text-sm font-semibold text-foreground transition-colors duration-200 group-hover/card:text-primary group-focus-visible/card:text-primary">
            {displayTitle}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{work.year ?? "—"}</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 transition-colors group-hover/card:text-foreground/80 group-focus-visible/card:text-foreground/80">
              <KindIcon className="size-3" />
              {kindLabel[work.kind]}
            </span>
            {durationText && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate bg-accent px-2 py-px rounded-full">{durationText}</span>
              </>
            )}
          </p>
        </div>
      </article>
    </Link>
  );
}
