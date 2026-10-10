import type {
  CatalogEntry,
  ScoreSummary,
  UpcomingInstallment,
  WorkSummary,
} from "@nahhasio/api-contract";
import { cn } from "cn";
import { CalendarDays, CheckCircle, Film, Star, Tv } from "lucide-react";

import { optionLabel } from "../features/catalog/filter-model";
import { workLink } from "../features/shell/navigation";
import { Artwork } from "./artwork";
import { useCardNavigation } from "./card-navigation";
import { Badge } from "./ui/badge";

export function ScoreBadge({ score }: { score: ScoreSummary }) {
  return (
    <Badge
      variant="secondary"
      className="h-auto gap-1.5 bg-background/90 px-2.5 py-1 text-xs"
      title={`التقييم المحسوب · ${score.scored} من ${score.total} أجزاء مقيّمة`}
    >
      <Star className="fill-(--gold) text-(--gold)" data-icon="inline-start" aria-hidden="true" />
      {score.rating === null ? "غير مقيّم" : score.rating.toFixed(1)}
      {score.total > 1 && (
        <small className="text-[9px] text-muted-foreground">
          {score.scored}/{score.total}
        </small>
      )}
    </Badge>
  );
}

export function MediaCard({
  work,
  installment,
  entry,
  onSelect,
  layout = "poster",
  mediaType,
  minimal = false,
  borderless = false,
  showScore = true,
  showStatus = true,
}: {
  work?: WorkSummary;
  installment?: UpcomingInstallment;
  entry?: CatalogEntry;
  onSelect?: (id: string, installmentId?: string) => void;
  layout?: "poster" | "banner" | "logo";
  mediaType?: "movies" | "series";
  minimal?: boolean;
  borderless?: boolean;
  showScore?: boolean;
  showStatus?: boolean;
}) {
  const navigation = useCardNavigation();
  const parent = entry?.work ?? work;
  const unit = entry?.installment ?? installment;
  if (!parent && !unit) return null;

  const workId = parent?.id ?? unit?.workId ?? "";
  const title = unit?.title ?? (parent?.titleAr || parent?.canonicalTitle || "");
  const poster = unit?.poster ?? parent?.poster;
  const image =
    layout === "banner"
      ? (parent?.banner ?? poster)
      : layout === "logo"
        ? (parent?.logo ?? poster)
        : poster;
  const score = unit?.score ?? parent?.score;
  const year = unit ? unit.releaseDate?.slice(0, 4) : parent?.releaseYear;

  const watched = entry?.watchState === "watched";
  const status = entry?.status ?? (installment ? "announced" : null);
  const kind = unit
    ? unit.kind === "season"
      ? "موسم"
      : unit.kind === "movie"
        ? "فيلم"
        : "إصدار خاص"
    : mediaType === "movies"
      ? "فيلم"
      : mediaType === "series"
        ? "مسلسل"
        : parent?.format === "animated"
          ? "رسوم متحركة"
          : "تمثيل حي";
  const KindIcon = unit?.kind === "season" || mediaType === "series" ? Tv : Film;

  return (
    <article
      className="group/media min-w-0 snap-start"
      data-layout={layout}
      data-watched={watched}
      data-kind={unit ? "installment" : "work"}
    >
      <a
        {...navigation}
        href={workLink(workId, unit?.id)}
        aria-label={`تفاصيل ${title}`}
        className="group/card flex flex-col gap-3 rounded-3xl text-foreground focus-visible:outline-none"
        onClick={
          onSelect
            ? (event) => {
                event.preventDefault();
                onSelect(workId, unit?.id);
              }
            : undefined
        }
      >
        <span
          className={cn(
            "relative block aspect-2/3 rounded-3xl border transition-[box-shadow,border-color] duration-200 group-hover/card:border-foreground/60 group-hover/card:shadow-lg group-focus-visible/card:ring-4 group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-background group-data-[layout=banner]/media:aspect-video group-data-[layout=logo]/media:aspect-video motion-reduce:transition-none",
            borderless && layout === "logo"
              ? "border-transparent bg-transparent"
              : "border-border bg-card",
            watched === true
              ? "group-focus-visible/card:ring-success"
              : "group-focus-visible/card:ring-foreground",
          )}
        >
          <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
            <Artwork
              id={image?.id}
              alt=""
              className={cn(
                "block size-full object-cover",
                layout === "logo" && parent?.logo && "object-contain p-6",
              )}
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-background/85 to-transparent opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-visible/card:opacity-100 motion-reduce:transition-none" />
          </span>
          {!minimal && showScore && score?.rating != null && (
            <span
              className="absolute inset-s-0 top-0 flex items-center min-w-12 justify-items-center gap-0.5 rounded-ss-3xl rounded-ee-2xl bg-primary px-2.5 py-2 text-primary-foreground shadow-sm"
              title={`التقييم المحسوب · ${score.scored} من ${score.total} أجزاء مقيّمة`}
            >
              <Star className="size-4 fill-current" aria-hidden="true" />
              <span className="text-base leading-none font-bold" dir="ltr">
                {score.rating.toFixed(1)}
              </span>
            </span>
          )}
          {!minimal && parent?.isPrivate && (
            <span className="absolute inset-e-2.5 top-1">
              <Badge variant="secondary">خاص</Badge>
            </span>
          )}
          {!minimal && watched && (
            <span className="absolute inset-e-3 bottom-3 rounded-full bg-background/90 p-1.5 text-success">
              <CheckCircle className="size-5" aria-label="تمّت مشاهدته" />
            </span>
          )}
          {!minimal &&
            showStatus &&
            (status === "announced" || status === "airing" || status === "completed") && (
              <span className="absolute inset-s-3 bottom-3">
                <Badge variant="secondary">
                  {status === "completed" ? (
                    <CheckCircle data-icon="inline-start" />
                  ) : (
                    <CalendarDays data-icon="inline-start" />
                  )}
                  {optionLabel(status, status)}
                </Badge>
              </span>
            )}
        </span>
        {!minimal && (
          <div className="flex min-w-0 flex-col gap-1.5 px-0.5">
            {unit && (
              <span className="truncate text-xs text-muted-foreground" dir="auto">
                {parent?.titleAr || unit.workTitleAr || unit.workTitle}
              </span>
            )}
            <h3
              className="line-clamp-2 text-sm leading-relaxed font-semibold transition-colors group-hover/card:text-primary group-focus-visible/card:text-primary sm:text-base motion-reduce:transition-none"
              dir="auto"
            >
              {title}
            </h3>
            <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted-foreground">
              {year && (
                <>
                  <span className="shrink-0">{year}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <KindIcon className="size-3.5 shrink-0" aria-label={kind} />
              <span className="truncate">
                {unit
                  ? unit.runtimeMinutes
                    ? `${unit.runtimeMinutes} دقيقة`
                    : unit.episodeCount
                      ? `${unit.episodeCount} حلقة`
                      : !unit.releaseDate
                        ? "لم يُعلن الموعد بعد"
                        : ""
                  : kind}
              </span>
            </span>
          </div>
        )}
      </a>
    </article>
  );
}
