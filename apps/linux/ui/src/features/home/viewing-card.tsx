import type { HomeViewingItem } from "@nahhasio/api-contract";
import { cn } from "cn";
import { Check, Play, RotateCcw } from "lucide-react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import type { WatchTarget } from "../player/watch-request";
import { requestWatch } from "../player/watch-request";
import { workLink } from "../shell/navigation";
import { episodeNumberLabel } from "../work/format";

export function homeDate(value: string) {
  return new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );
}
function recentRelease(value: string | null) {
  if (!value) return null;
  const days = Math.floor(Date.now() / 86400000) - Math.floor(new Date(value).getTime() / 86400000);
  if (!Number.isFinite(days) || days < 0 || days >= 30) return null;
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days === 2) return "قبل يومين";
  return `قبل ${days} ${days <= 10 ? "أيام" : "يومًا"}`;
}
function durationLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function ViewingCard({
  item,
  resume = false,
  portrait = false,
}: {
  item: HomeViewingItem;
  resume?: boolean;
  portrait?: boolean;
}) {
  const navigation = useCardNavigation();
  const title = item.work.titleAr || item.work.canonicalTitle;
  const episode = item.episodeNumber
    ? `الحلقة ${episodeNumberLabel(item.episodeNumber)}`
    : item.installmentTitle;
  const subtitle = item.episodeId ? `${title} — ${item.installmentTitle}` : title;
  const recency = resume ? null : recentRelease(item.releaseDate);
  const duration = item.durationSeconds;
  const watch = () => {
    const target: WatchTarget = { workId: item.work.id, title, installmentId: item.installmentId };
    if (item.episodeId) target.episodeId = item.episodeId;
    requestWatch(target);
  };
  const progress =
    duration && duration > 0 ? Math.min(100, (item.positionSeconds / duration) * 100) : null;
  return (
    <article className="group/episode min-w-0 space-y-3">
      <div className="relative">
        <Button
          {...navigation}
          variant="ghost"
          aria-label={`${item.isPlayed ? "إعادة مشاهدة" : "مشاهدة"} ${title}، ${episode}`}
          className={cn(
            "group/play relative h-auto w-full overflow-hidden rounded-2xl p-0",
            portrait ? "aspect-2/3" : "aspect-video",
          )}
          onClick={watch}
        >
          <span className="absolute inset-0 transform-gpu overflow-hidden rounded-2xl">
            <Artwork
              id={item.artwork?.id}
              alt=""
              className={cn(
                "absolute inset-0 size-full object-cover transition duration-200 group-hover/play:scale-105 group-focus-visible/play:scale-105 motion-reduce:transition-none",
                item.isPlayed &&
                  "opacity-50 group-hover/play:opacity-100 group-focus-visible/play:opacity-100",
              )}
            />
            <span className="absolute inset-0 bg-linear-to-t from-background/60 via-transparent to-transparent" />
            <span className="absolute inset-0 bg-background/0 transition-colors group-hover/play:bg-background/20 group-focus-visible/play:bg-background/20 motion-reduce:transition-none" />
          </span>
          <span className="relative flex translate-y-1 items-center gap-2 rounded-xl bg-background px-4 py-3 text-sm text-foreground opacity-0 shadow-lg transition duration-200 group-hover/play:translate-y-0 group-hover/play:opacity-100 group-focus-visible/play:translate-y-0 group-focus-visible/play:opacity-100 pointer-coarse:translate-y-0 pointer-coarse:opacity-100 motion-reduce:transition-none">
            {item.isPlayed ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
            {item.isPlayed ? "إعادة المشاهدة" : "مشاهدة"}
          </span>
          {item.episodeId && (
            <span className="absolute start-3 bottom-3 rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-foreground tabular-nums">
              {episode}
            </span>
          )}
          {duration !== null && duration > 0 && (
            <span
              dir="ltr"
              className="absolute end-3 bottom-3 rounded-md bg-background px-2 py-1 text-xs text-foreground tabular-nums"
            >
              {durationLabel(duration)}
            </span>
          )}
        </Button>
        {item.isPlayed && (
          <span className="pointer-events-none absolute end-3 top-3">
            <Badge variant="secondary">
              <Check data-icon="inline-start" />
              مُشاهد
            </Badge>
          </span>
        )}
      </div>
      <div className="flex items-start gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="line-clamp-2 text-sm leading-5 font-semibold" dir="auto">
            {item.episodeTitle || episode}
          </h3>
          <a
            {...navigation}
            href={workLink(item.work.id, item.installmentId)}
            className="block truncate text-sm leading-5 text-muted-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            dir="auto"
          >
            {subtitle}
          </a>
          {recency && (
            <time
              dateTime={item.releaseDate ?? undefined}
              className="block text-xs text-muted-foreground tabular-nums"
            >
              {recency}
            </time>
          )}
        </div>
      </div>
      {resume ? (
        <div className="space-y-2 px-1 pt-1">
          {progress !== null && <Progress value={progress} aria-label={`تقدم مشاهدة ${title}`} />}
          <p className="text-xs text-muted-foreground tabular-nums">
            {Math.floor(item.positionSeconds / 60)} دقيقة تمت مشاهدتها
            {duration && duration > 0 ? ` من ${Math.ceil(duration / 60)}` : ""}
          </p>
        </div>
      ) : null}
    </article>
  );
}
