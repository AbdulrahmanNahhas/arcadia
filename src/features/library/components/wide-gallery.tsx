import { HeartIcon, StarIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import type { Work } from "../model";
import { statusLabelsAr, useArabicTranslations } from "../translations";
import type { GalleryOptions } from "../view-types";
import { progressText, usesProgress, WorkArtwork } from "./work-artwork";

export function WideGallery({
  works,
  onOpen,
  cardSize,
  options,
}: {
  works: Work[];
  onOpen: (id: string) => void;
  cardSize: number;
  options: GalleryOptions;
}) {
  const { taxonomyLabel } = useArabicTranslations();
  const minimum = Math.max(360, cardSize * 2.7);

  return (
    <div
      className="grid items-start gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minimum}px), 1fr))` }}
    >
      {works.map((work) => {
        const progress = work.progressTotal
          ? Math.min(100, Math.round((work.progress / work.progressTotal) * 100))
          : work.status === "completed"
            ? 100
            : null;
        return (
          <button
            type="button"
            dir="ltr"
            key={work.id}
            onClick={() => onOpen(work.id)}
            className="group grid min-h-48 grid-cols-[minmax(0,1fr)_7.75rem] overflow-hidden rounded-2xl border bg-card text-start shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_9rem]"
          >
            <div dir="rtl" className="flex min-w-0 flex-col p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-base leading-snug font-semibold tracking-tight sm:text-lg">
                    {work.arabicTitle || work.title}
                  </h2>
                  {work.arabicTitle && work.title !== work.arabicTitle ? (
                    <p dir="auto" className="mt-1 truncate text-xs text-muted-foreground">
                      {work.title}
                    </p>
                  ) : null}
                </div>
                {options.showFavorite && work.favorite ? (
                  <HeartIcon className="shrink-0 text-primary" weight="fill" aria-label="مفضّل" />
                ) : null}
              </div>

              {options.showCreator && work.creator ? (
                <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
                  {work.creator}
                </p>
              ) : null}
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {work.summary || "لا يوجد ملخص لهذا العمل بعد."}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                <Badge variant="outline">{statusLabelsAr[work.status]}</Badge>
                {options.showYear && work.year ? (
                  <Badge variant="secondary">{work.year}</Badge>
                ) : null}
                {options.showRating && work.calculatedRating !== null ? (
                  <Badge variant="secondary">
                    <StarIcon weight="fill" />
                    {work.calculatedRating.toFixed(1)}
                  </Badge>
                ) : null}
                {options.showGenres
                  ? work.genres.slice(0, 2).map((genre) => (
                      <Badge key={genre} variant="secondary">
                        {taxonomyLabel("genre", genre)}
                      </Badge>
                    ))
                  : null}
              </div>

              {options.showProgress && usesProgress(work) ? (
                <Progress value={progress} className="mt-4 gap-1.5">
                  <ProgressLabel className="text-xs text-muted-foreground">التقدم</ProgressLabel>
                  <ProgressValue className="text-xs">{() => progressText(work)}</ProgressValue>
                </Progress>
              ) : null}
            </div>
            <WorkArtwork
              work={work}
              image={options.imageType}
              showType={options.showType}
              showRating={false}
              className="h-full min-h-48 rounded-none"
            />
          </button>
        );
      })}
    </div>
  );
}
