import { StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";

export function WorkCard({ work, className }: { work: Work; className?: string }) {
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
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/75 to-transparent opacity-0 transition-opacity group-hover/card:opacity-100" />
          {work.calculatedRating !== null && (
            <span className="absolute end-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
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
            <span>{kindLabel[work.kind]}</span>
          </p>
        </div>
      </article>
    </Link>
  );
}

const kindLabel: Record<Work["kind"], string> = {
  movie: "فيلم",
  series: "مسلسل",
  anime: "أنمي",
  game: "لعبة",
  novel: "رواية",
  manga: "مانغا",
  "visual-novel": "رواية مرئية",
  comic: "قصص مصوّرة",
};
