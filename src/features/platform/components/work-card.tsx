import {
  ArrowLeftIcon,
  BookOpenIcon,
  FilmSlateIcon,
  GameControllerIcon,
  SparkleIcon,
  StarIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { Work } from "@/features/library/model";
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

  if (variant === "logo") {
    return (
      <Link
        to="/works/$workId"
        params={{ workId: work.id }}
        className={cn(
          "group/card block min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          className,
        )}
      >
        <article>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-white/8 transition duration-300 group-hover/card:-translate-y-1 group-hover/card:ring-white/20 motion-reduce:transition-none">
            {work.logoPath || work.imagePath ? (
              <img
                src={work.logoPath || work.imagePath || undefined}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-contain p-5 transition duration-500 group-hover/card:scale-[1.035] motion-reduce:transition-none"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/25 via-muted to-muted p-4 text-center">
                <span className="font-heading text-sm leading-6">
                  {work.arabicTitle || work.title}
                </span>
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
              {work.arabicTitle || work.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{work.year ?? "—"}</p>
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "banner") {
    return (
      <Link
        to="/works/$workId"
        params={{ workId: work.id }}
        className={cn(
          "group/card mt-1.5 block min-w-0 snap-start overflow-visible rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring pb-13",
          className,
        )}
      >
        <article className="relative aspect-video overflow-visible rounded-2xl bg-muted shadow-lg shadow-background/10 ring-1 ring-white/8 transition-all duration-600 ease-out group-hover/card:z-10 group-hover/card:-translate-y-2 group-hover/card:scale-[1.020] group-hover/card:shadow-2xl group-hover/card:shadow-background/40 group-hover/card:ring-white/25 group-focus-visible/card:-translate-y-2 group-focus-visible/card:scale-[1.025]">
          {work.bannerPath || work.imagePath ? (
            <img
              src={work.bannerPath || work.imagePath || undefined}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full rounded-2xl overflow-hidden object-cover transition duration-700 ease-out group-hover/card:scale-100 group-focus-visible/card:scale-100 motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-t from-primary/25 via-muted to-muted p-4">
              <span className="font-heading text-sm leading-6">
                {work.arabicTitle || work.title}
              </span>
            </div>
          )}
          <div className="absolute -inset-1  bg-linear-to-t from-background/0 via-background/0 to-transparent transition duration-500 group-hover/card:from-background group-hover/card:via-background/35 group-focus-visible/card:from-background group-focus-visible/card:via-background/35" />
          {work.calculatedRating !== null && (
            <span className="absolute inset-e-3 top-3 flex items-center gap-1 rounded-full bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              <StarIcon weight="fill" className="text-amber-300" />
              {work.calculatedRating.toFixed(1)}
            </span>
          )}
          <div className="absolute inset-x-0 -bottom-22 border border-t-0 pt-32 rounded-b-2xl border-transparent group-hover/card:border-border translate-y-9 p-4 transition-all duration-300 ease-out group-hover/card:translate-y-0 group-focus-visible/card:translate-y-0">
            <h3 className="truncate font-heading text-sm font-semibold text-white sm:text-base">
              {work.arabicTitle || work.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
              <span>{work.year ?? "—"}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <KindIcon className="size-3" weight="fill" />
                {kindLabel[work.kind]}
              </span>
              {work.animationStudios[0] && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{work.animationStudios[0].name}</span>
                </>
              )}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5 text-xs text-white opacity-0 transition-opacity delay-75 duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100">
              <span className="line-clamp-1 text-white/65">
                {work.summary || "افتح سجل العمل الكامل"}
              </span>
              <span className="ms-3 flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-background">
                استكشف
                <ArrowLeftIcon />
              </span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link
      to="/works/$workId"
      params={{ workId: work.id }}
      className={cn(
        "max-w-100 group/card block min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      <article>
        <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-white/8 transition duration-300 group-hover/card:-translate-y-1 group-hover/card:ring-white/20 motion-reduce:transition-none">
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition duration-500 group-hover/card:scale-[1.035] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full items-end bg-linear-to-t from-primary/25 via-muted to-muted p-4">
              <span className="font-heading text-sm leading-6">
                {work.arabicTitle || work.title}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-background/75 to-transparent opacity-0 transition-opacity group-hover/card:opacity-100" />
          {work.calculatedRating !== null && (
            <span className="absolute inset-e-2 top-2 flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              <StarIcon weight="fill" className="text-amber-300" />
              {work.calculatedRating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="px-0.5 pt-3">
          <h3 className="truncate font-heading text-sm font-medium text-foreground">
            {work.arabicTitle || work.title}
          </h3>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
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
