import type {
  CatalogEntry,
  ScoreSummary,
  UpcomingInstallment,
  WorkSummary,
} from "@nahhasio/api-contract";
import { CheckCircle, Star } from "lucide-react";

import { workLink } from "../features/shell/navigation";
import { Artwork } from "./artwork";
import { Badge } from "./ui/badge";
export function ScoreBadge({ score }: { score: ScoreSummary }) {
  return (
    <Badge
      variant="secondary"
      className="h-auto gap-1.5 bg-background/90 px-2.5 py-1 text-xs"
      title={`التقييم المحسوب · ${score.scored} من ${score.total} أجزاء مقيّمة`}
    >
      <Star className="size-3.5 fill-amber-300 text-amber-300" aria-hidden="true" />
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
}: {
  work?: WorkSummary;
  installment?: UpcomingInstallment;
  entry?: CatalogEntry;
  onSelect?: (id: string, installmentId?: string) => void;
  layout?: "poster" | "banner" | "logo";
}) {
  const parent = entry?.work ?? work;
  const unit = entry?.installment ?? installment;

  if (!parent && !unit) return null;

  const workId = parent?.id ?? unit?.workId ?? "";
  const title = unit ? unit.title : parent?.titleAr || parent?.canonicalTitle || "";
  const poster = unit?.poster ?? parent?.poster;
  const score = unit?.score ?? parent?.score;
  const date = unit?.releaseDate;
  const image =
    layout === "banner"
      ? (parent?.banner ?? poster)
      : layout === "logo"
        ? (parent?.logo ?? poster)
        : poster;

  return (
    <article className="group/media min-w-0 snap-start" data-layout={layout}>
      <a
        className="flex flex-col gap-2 rounded-2xl text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-foreground"
        href={workLink(workId, unit?.id)}
        aria-label={`تفاصيل ${title}`}
        onClick={
          onSelect
            ? (event) => {
                event.preventDefault();
                onSelect(workId, unit?.id);
              }
            : undefined
        }
      >
        <span className={`relative block overflow-hidden rounded-[20px] border border-border bg-card transition-[transform,border-color] duration-200 group-hover/media:-translate-y-1 group-hover/media:border-foreground/60 motion-reduce:transition-none ${layout === "poster" ? "aspect-[2/3]" : "aspect-video"}`}>
          <Artwork id={image?.id} alt="" className={`block h-full w-full object-cover ${layout === "logo" ? "object-contain p-[22px]" : ""}`} />
          {score && (
            <span className="absolute start-2.5 top-2.5">
              <ScoreBadge score={score} />
            </span>
          )}
          {date && (
            <span className="absolute end-2 top-2 grid rounded-2xl bg-background/90 px-2.5 py-1.5 text-center text-[9px]">
              <b className="text-lg">{new Date(`${date}T00:00:00Z`).getUTCDate()}</b>
              <span>
                {new Intl.DateTimeFormat("ar", { month: "long", timeZone: "UTC" }).format(
                  new Date(`${date}T00:00:00Z`),
                )}
              </span>
            </span>
          )}
          {entry?.watchState === "watched" && (
            <span className="absolute end-2.5 bottom-2.5">
              <CheckCircle className="size-5 text-primary" aria-label="تمّت مشاهدته" />
            </span>
          )}
          {parent?.isPrivate && <span className="absolute bottom-2 start-2 rounded-lg bg-background px-2 py-0.5 text-[11px]">خاص</span>}
        </span>
        {unit && (
          <p className="text-[11px] leading-relaxed text-muted-foreground" dir="auto">
            {parent?.titleAr || unit.workTitleAr || unit.workTitle}
          </p>
        )}
        <h3 className="line-clamp-2 text-[15px] leading-relaxed font-semibold max-[750px]:text-[13px]" dir="auto">{title}</h3>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {unit
            ? [
                unit.kind === "season" ? "موسم" : unit.kind === "movie" ? "فيلم" : "إصدار خاص",
                unit.runtimeMinutes
                  ? `${unit.runtimeMinutes} دقيقة`
                  : unit.episodeCount
                    ? `${unit.episodeCount} حلقة`
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : [parent?.releaseYear, parent?.audience === "general" ? "عام" : parent?.age]
                .filter(Boolean)
                .join(" · ")}
        </p>
        {unit && !date && <p className="text-[11px] leading-relaxed text-muted-foreground">لم يُعلن الموعد بعد</p>}
      </a>
    </article>
  );
}
