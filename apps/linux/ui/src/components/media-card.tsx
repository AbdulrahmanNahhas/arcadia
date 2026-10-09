import type { ScoreSummary, UpcomingInstallment, WorkSummary } from "@nahhasio/api-contract";
import { Star } from "lucide-react";

import { Artwork } from "./artwork";
import { Badge } from "./ui/badge";

export function ScoreBadge({ score }: { score: ScoreSummary }) {
  return (
    <Badge
      variant="secondary"
      title={`التقييم المحسوب · ${score.scored} من ${score.total} أجزاء مكتملة التقييم`}
    >
      <Star data-icon="inline-start" />
      {score.rating === null ? "غير مقيّم" : score.rating.toFixed(1)}
    </Badge>
  );
}
type MediaCardProps = {
  onSelect: (workId: string, installmentId?: string) => void;
} & (
  | { work: WorkSummary; installment?: never }
  | { installment: UpcomingInstallment; work?: never }
);
export function MediaCard({ work, installment, onSelect }: MediaCardProps) {
  const title = work ? work.titleAr || work.canonicalTitle : installment.title;
  const poster = work ? work.poster : installment.poster;
  const score = work ? work.score : installment.score;
  return (
    <button
      className="group flex min-w-0 flex-col items-stretch gap-2 rounded-lg bg-transparent p-0 text-start transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-foreground motion-reduce:transition-none"
      aria-label={`تفاصيل ${title}`}
      onClick={() => onSelect(work ? work.id : installment.workId, installment?.id)}
    >
      <span className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-secondary transition-[transform,box-shadow] duration-200 group-hover:scale-[1.025] group-hover:shadow-lg group-hover:ring-2 group-hover:ring-primary/50 motion-reduce:transition-none">
        <Artwork id={poster?.id} alt="" className="h-full w-full object-cover" />
        <span className="absolute end-2 top-2">
          <ScoreBadge score={score} />
        </span>
        {work?.age && (
          <span className="absolute bottom-2.5 end-2.5 rounded bg-background/85 px-2 py-0.5 text-[11px] backdrop-blur">
            {work.age}
          </span>
        )}
        {work?.isPrivate && (
          <span className="absolute start-2 top-2 rounded bg-background/85 px-2 py-0.5 text-[11px] text-primary backdrop-blur">
            خاص
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-sm leading-relaxed font-semibold" dir="auto">
        {title}
      </span>
      {installment && (
        <span className="text-xs leading-relaxed text-muted-foreground" dir="auto">
          {installment.workTitleAr || installment.workTitle}
        </span>
      )}
      <span className="text-xs leading-relaxed text-muted-foreground">
        {work
          ? [
              work.releaseYear,
              work.episodeCount > 0 ? `${work.episodeCount} حلقة` : `${work.installmentCount} جزء`,
            ]
              .filter(Boolean)
              .join(" · ")
          : installment.kind === "movie"
            ? installment.runtimeMinutes
              ? `${installment.runtimeMinutes} دقيقة`
              : "فيلم"
            : installment.episodeCount > 0
              ? `${installment.episodeCount} حلقة`
              : installment.kind === "season"
                ? "موسم"
                : "إصدار خاص"}
      </span>
      {installment && (
        <span className="text-xs leading-relaxed text-muted-foreground">
          {installment.releaseDate
            ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeZone: "UTC" }).format(
                new Date(`${installment.releaseDate}T00:00:00Z`),
              )
            : "لم يُعلن موعده"}
        </span>
      )}
    </button>
  );
}
