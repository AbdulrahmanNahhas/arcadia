import type { WorkDetail } from "@nahhasio/api-contract";
import { CalendarDays, Film, Heart, Play, Tv } from "lucide-react";

import { Artwork } from "../../components/artwork";
import { ScoreBadge } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { requestWatch } from "../player/watch-request";
import { entityLink } from "../shell/navigation";
import { audienceLabels, statusLabels } from "./format";
import type { WorkTracking } from "./use-work-tracking";
import { WatchedControl } from "./watched-control";

export function releaseStatus(work: WorkDetail) {
  const statuses = work.installments.map((item) => item.status);
  if (statuses.length && statuses.every((status) => status === "completed")) return "completed";
  if (statuses.includes("airing")) return "airing";
  if (statuses.includes("announced")) return "announced";
  return "unknown";
}

export function SummaryExcerpt({ work }: { work: WorkDetail }) {
  if (!work.summary.trim()) return null;
  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <p
        className="line-clamp-4 text-base leading-loose wrap-anywhere md:text-lg lg:text-xl"
        dir="auto"
      >
        {work.summary}
      </p>
      <Dialog>
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>قراءة المزيد</DialogTrigger>
        <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{work.titleAr || work.canonicalTitle}</DialogTitle>
            <DialogDescription>نبذة العمل</DialogDescription>
          </DialogHeader>
          <p className="text-lg leading-loose whitespace-pre-line wrap-anywhere" dir="auto">
            {work.summary}
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>إغلاق</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkHero({
  work,
  tracking,
  onEpisodes,
}: {
  work: WorkDetail;
  tracking: WorkTracking;
  onEpisodes: () => void;
}) {
  const status = releaseStatus(work);
  const Kind = work.installments.some((item) => item.kind === "season") ? Tv : Film;
  const state = tracking.state.data;
  return (
    <header className="relative isolate overflow-hidden rounded-3xl m-2 border! border-border">
      <Artwork
        id={work.banner?.id ?? work.poster?.id}
        alt=""
        className="absolute inset-0 size-full object-cover object-center opacity-75"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/45 to-background/50" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-l from-background/65 via-background/25 to-transparent" />
      <div className="relative mx-auto grid min-h-160 max-w-screen-2xl items-end gap-10 px-6 pt-28 pb-12 md:px-10 lg:min-h-176 lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-14 lg:pt-40 lg:pb-16">
        <div className="flex min-w-0 max-w-3xl flex-col items-start gap-5 md:gap-6">
          {work.planets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {work.planets.map((planet) => (
                <Badge
                  key={planet.id}
                  variant="outline"
                  render={<a href={entityLink("planets", planet.slug)} />}
                >
                  {planet.icon} {planet.nameAr}
                </Badge>
              ))}
            </div>
          )}
          <h1
            className="w-full text-4xl leading-tight font-bold md:text-5xl lg:text-6xl"
            dir="auto"
          >
            {work.logo ? (
              <>
                <Artwork
                  id={work.logo.id}
                  alt={work.titleAr || work.canonicalTitle}
                  className="h-28 w-full max-w-lg object-contain object-right md:h-40 lg:h-48"
                  priority
                />
                <span className="sr-only">{work.titleAr || work.canonicalTitle}</span>
              </>
            ) : (
              work.titleAr || work.canonicalTitle
            )}
          </h1>
          {work.logo && (
            <p className="text-xl md:text-2xl" dir="auto">
              {work.titleAr || work.canonicalTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground md:gap-5">
            {!(status === "announced" && work.score.rating === null) && (
              <ScoreBadge score={work.score} />
            )}
            {work.releaseYear && (
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden="true" />
                {work.releaseYear}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Kind className="size-4" aria-hidden="true" />
              {work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
            </span>
            <Badge variant={status === "completed" ? "secondary" : "outline"}>
              {statusLabels.get(status)}
            </Badge>
            <span>{audienceLabels.get(work.audience)}</span>
            {work.age && (
              <Badge variant="outline">
                <bdi>{work.age}</bdi>
              </Badge>
            )}
            {work.isPrivate && <Badge variant="outline">خاص</Badge>}
          </div>
          <SummaryExcerpt work={work} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() =>
                requestWatch({
                  workId: work.id,
                  title: work.titleAr || work.canonicalTitle,
                })
              }
            >
              <Play data-icon="inline-start" />
              تشغيل
            </Button>
            {work.installments.length > 0 && (
              <Button size="lg" variant="outline" onClick={onEpisodes}>
                الأجزاء والحلقات
              </Button>
            )}
            <Button
              size="icon-lg"
              variant={state?.isFavorite ? "secondary" : "outline"}
              aria-label={state?.isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              aria-pressed={state?.isFavorite ?? false}
              title={state?.isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              disabled={!state || tracking.pending}
              onClick={() => tracking.favorite.mutate(!state?.isFavorite)}
            >
              <Heart data-icon="inline-start" />
            </Button>
            <WatchedControl tracking={tracking} label="العمل" compact />
          </div>
          {state && state.summary.releasedUnits > 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              {state.summary.watchedReleasedUnits} من {state.summary.releasedUnits}{" "}
              {work.episodeCount ? "حلقة وإصدار صادر" : "إصدار صادر"} تمّت مشاهدته
              {state.summary.isFullyWatched ? " · تمّت مشاهدة كل ما صدر" : ""}
            </p>
          )}
        </div>
        <div className="hidden lg:block">
          <HeroFacts work={work} status={status} />
        </div>
      </div>
    </header>
  );
}

function HeroFacts({ work, status }: { work: WorkDetail; status: string }) {
  const dates = work.installments
    .map((item) => item.releaseDate)
    .filter((date) => date !== null)
    .toSorted();
  const rows = [
    ["حالة الإصدار", statusLabels.get(status)],
    ["أول إصدار", dates[0]?.slice(0, 10)],
    ["الأجزاء", work.installmentCount],
    ["الحلقات", work.episodeCount || null],
    ["الجمهور", audienceLabels.get(work.audience)],
  ];
  return (
    <dl className="rounded-2xl border border-border/60 bg-background/45 p-4 backdrop-blur-2xl">
      {rows
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <dt className="text-muted-foreground flex-1">{label}</dt>
            <dd className="text-start w-full flex-2 border-r pr-4 border-border">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
