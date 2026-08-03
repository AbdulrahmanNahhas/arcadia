import {
  BookOpenIcon,
  FilmSlateIcon,
  GameControllerIcon,
  SparkleIcon,
  StarIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { kindLabels } from "../filtering";
import type { Work } from "../model";
import { statusLabelsAr, useArabicTranslations } from "../translations";

// Map a work's `kind` to a representative icon. Keys are lowercase and
// include common aliases — adjust to match your actual `kind` enum values.
const kindIcons = {
  movie: FilmSlateIcon,
  film: FilmSlateIcon,
  tv: TelevisionSimpleIcon,
  series: TelevisionSimpleIcon,
  show: TelevisionSimpleIcon,
  anime: SparkleIcon,
  novel: BookOpenIcon,
  book: BookOpenIcon,
  manga: BookOpenIcon,
  game: GameControllerIcon,
} as const;

// Map a work's `status` to a semantic color. Adjust keys to match your
// actual `status` enum values.
const statusStyles: Record<string, string> = {
  watching: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  reading: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  in_progress: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ongoing: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  finished: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  dropped: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  on_hold: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  planned: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  plan_to_watch: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};
const defaultStatusStyle = "bg-slate-500/10 text-slate-600 dark:text-slate-400";

function ratingStyle(rating: number) {
  if (rating >= 8.5) return "text-emerald-600 dark:text-emerald-400";
  if (rating >= 7) return "text-amber-600 dark:text-amber-400";
  if (rating >= 5) return "text-orange-600 dark:text-orange-400";
  return "text-rose-600 dark:text-rose-400";
}

export function Timeline({
  works,
  onOpen,
  newestFirst,
}: {
  works: Work[];
  onOpen: (id: string) => void;
  newestFirst: boolean;
}) {
  const { taxonomyLabel } = useArabicTranslations();
  const groups = works.reduce<Map<number, Work[]>>((map, work) => {
    const year = work.year ?? 0;
    map.set(year, [...(map.get(year) ?? []), work]);
    return map;
  }, new Map());

  return (
    <div className="timeline mx-auto max-w-6xl">
      {[...groups.entries()]
        .sort(([a], [b]) => (newestFirst ? b - a : a - b))
        .map(([year, items]) => (
          <section key={year} className="grid md:grid-cols-[130px_1fr]">
            <header className="pb-5 md:pr-6 md:text-right">
              <h2 className="text-2xl font-bold tracking-tight">{year || "غير محدد"}</h2>
              <p className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "عمل" : "أعمال"}
              </p>
            </header>
            <div className="relative grid gap-3 border-r-2 pr-6 pb-10! before:absolute before:top-2.5 before:-right-[7px] before:size-3 before:rounded-full before:border-2 before:border-background before:bg-primary before:ring-4 before:ring-primary/15 last:pb-0 lg:grid-cols-2">
              {items.map((work) => {
                const KindIcon =
                  kindIcons[work.kind as unknown as keyof typeof kindIcons] ?? BookOpenIcon;
                const visibleGenres = work.genres.slice(0, 3);
                const extraGenres = work.genres.length - visibleGenres.length;

                return (
                  <button
                    type="button"
                    key={work.id}
                    onClick={() => onOpen(work.id)}
                    className="group flex min-w-0 items-center gap-4 rounded-2xl border bg-card p-3 text-right shadow-xs transition hover:border-primary/80 hover:bg-accent/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {work.imagePath ? (
                        <img
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                          src={work.imagePath}
                          alt=""
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-primary/45">
                          <KindIcon className="size-6 text-primary/50" weight="light" />
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 rounded-md bg-background/85 p-1 backdrop-blur-sm">
                        <KindIcon className="size-3.5 text-foreground/70" weight="fill" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 text-start">
                      <p className="truncate text-base leading-snug font-semibold">
                        {work.arabicTitle || work.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {kindLabels[work.kind]} · {work.creator || "منشئ غير معروف"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {visibleGenres.map((genre) => (
                          <Badge
                            key={genre}
                            variant="secondary"
                            className="py-0 text-[10px] font-normal"
                          >
                            {taxonomyLabel("genre", genre)}
                          </Badge>
                        ))}
                        {extraGenres > 0 && (
                          <Badge
                            variant="ghost"
                            className="py-0 text-[10px] font-normal text-muted-foreground"
                          >
                            +{extraGenres}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {work.calculatedRating !== null && (
                        <span
                          className={`flex items-center gap-1 text-sm font-semibold ${ratingStyle(work.calculatedRating)}`}
                        >
                          <StarIcon className="size-3.5" weight="fill" />
                          {work.calculatedRating.toFixed(1)}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[work.status as unknown as string] ?? defaultStatusStyle}`}
                      >
                        {statusLabelsAr[work.status]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
