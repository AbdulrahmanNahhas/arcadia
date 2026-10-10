import { installmentRating } from "@arcadia/domain";
import type { WorkDetail, ViewerUnitState } from "@nahhasio/api-contract";
import { ArrowDownUp, ChevronDown, Info, Play } from "lucide-react";
import { useState } from "react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { ScoreBadge } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../../components/ui/popover";
import { requestWatch } from "../player/watch-request";
import { replaceParams, useViewerRoute } from "../shell/navigation";
import { ArtworkGallery, MediaFiles, References } from "./data-panel";
import { RiskRows } from "./family-panel";
import { Disclosure, FieldList } from "./field-list";
import { dateLabel, externalIdLabels, pickArtwork, statusLabels } from "./format";
import type { WorkTracking } from "./use-work-tracking";
import { WatchedControl } from "./watched-control";

type Installment = WorkDetail["installments"][number];
type Episode = Installment["episodes"][number];

export function InstallmentsPanel({
  work,
  initial,
  tracking,
}: {
  work: WorkDetail;
  initial?: string;
  tracking: WorkTracking;
}) {
  const route = useViewerRoute();
  const [search, setSearch] = useState("");
  const [descending, setDescending] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const item = work.installments.find((unit) => unit.id === initial) ?? work.installments[0];
  if (!item) return null;
  const select = (id: string) => {
    const params = new URLSearchParams(route.params);
    params.set("installment", id);
    params.set("tab", "installments");
    replaceParams(`/titles/${work.id}`, params);
    setSearch("");
    setSelectorOpen(false);
  };
  const episodes = item.episodes
    .filter((episode) =>
      `${episode.number} ${episode.title ?? ""} ${episode.summary}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    )
    .toSorted((a, b) => (descending ? b.position - a.position : a.position - b.position));
  const rating = installmentRating(item.scores ?? {});
  const summary = tracking.state.data?.installments.find(
    (unit) => unit.installmentId === item.id,
  )?.summary;
  return (
    <div className="flex min-w-0 flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold md:text-3xl">
          {item.kind === "season" ? "الحلقات" : "الإصدار"}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
            <PopoverTrigger render={<Button variant="outline" size="lg" />}>
              <ChevronDown data-icon="inline-start" />
              {item.title}
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-96 w-80 max-w-full overflow-y-auto">
              <PopoverTitle>اختر الجزء</PopoverTitle>
              {work.installments.map((unit) => (
                <Button
                  key={unit.id}
                  variant={unit.id === item.id ? "secondary" : "ghost"}
                  onClick={() => select(unit.id)}
                  className="h-auto justify-start gap-4 py-3"
                  aria-pressed={unit.id === item.id}
                >
                  <Artwork
                    id={pickArtwork(unit.artwork, "poster")?.id ?? work.poster?.id}
                    alt=""
                    className="h-20 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <span className="flex min-w-0 flex-col items-start gap-2 text-start">
                    <span className="text-base">{unit.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {unit.kind === "season"
                        ? `${unit.episodes.length} حلقة`
                        : unit.runtimeMinutes
                          ? `${unit.runtimeMinutes} دقيقة`
                          : "إصدار مستقل"}
                    </span>
                  </span>
                </Button>
              ))}
            </PopoverContent>
          </Popover>
          <WatchedControl tracking={tracking} installmentId={item.id} label={item.title} />
          {item.episodes.length > 1 && (
            <Button variant="outline" onClick={() => setDescending(!descending)}>
              <ArrowDownUp data-icon="inline-start" />
              {descending ? "الأحدث أولًا" : "الأقدم أولًا"}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-5 rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl md:p-6">
        <Artwork
          id={pickArtwork(item.artwork, "poster")?.id ?? work.poster?.id}
          alt=""
          className="h-32 w-22 shrink-0 rounded-xl object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="text-xl font-semibold md:text-2xl">{item.title}</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {!(item.status === "announced" && rating === null) && (
              <ScoreBadge score={{ rating, scored: rating === null ? 0 : 1, total: 1 }} />
            )}
            <Badge variant="outline">{statusLabels.get(item.status)}</Badge>
            <span>{dateLabel(item.releaseDate)}</span>
            {item.runtimeMinutes && <span>{item.runtimeMinutes} دقيقة</span>}
            {summary && summary.releasedUnits > 0 && (
              <span>
                {summary.watchedReleasedUnits} من {summary.releasedUnits} تمّت مشاهدته
              </span>
            )}
          </div>
          {item.summary.trim() && (
            <p className="line-clamp-3 text-base leading-loose" dir="auto">
              {item.summary}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {item.kind !== "season" && (
              <Button
                onClick={() =>
                  requestWatch({
                    workId: work.id,
                    installmentId: item.id,
                    title: `${work.titleAr || work.canonicalTitle} · ${item.title}`,
                  })
                }
              >
                <Play data-icon="inline-start" />
                تشغيل الإصدار
              </Button>
            )}
            <InstallmentDetails item={item} />
          </div>
        </div>
      </div>
      {item.episodes.length > 0 && (
        <>
          {item.episodes.length > 6 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="episode-search">ابحث في الحلقات</FieldLabel>
                <Input
                  id="episode-search"
                  placeholder="رقم الحلقة أو اسمها…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
            </FieldGroup>
          )}
          <div
            className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="حلقات الجزء"
          >
            {episodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                installment={item}
                work={work}
                tracking={tracking}
              />
            ))}
          </div>
          {episodes.length === 0 && <p role="status">لا توجد حلقات مطابقة للبحث.</p>}
        </>
      )}
    </div>
  );
}

function InstallmentDetails({ item }: { item: Installment }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Info data-icon="inline-start" />
        تفاصيل الإصدار
      </DialogTrigger>
      <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>بيانات الإصدار المسجّلة في المكتبة</DialogDescription>
        </DialogHeader>
        {item.summary.trim() && (
          <p className="text-base leading-loose whitespace-pre-line">{item.summary}</p>
        )}
        <FieldList
          rows={[
            ["الترتيب", item.position],
            ["المدة بالدقائق", item.runtimeMinutes],
            ["تاريخ الإصدار", dateLabel(item.releaseDate)],
            ["حالة الإصدار", statusLabels.get(item.status)],
            ["الحلقات", item.episodes.length],
            ["أضيف في", dateLabel(item.createdAt)],
            ["آخر تحديث", dateLabel(item.updatedAt)],
          ]}
        />
        <RiskRows classification={item.classification} overrides={item.classificationOverrides} />
        <References items={item.externalReferences} />
        <FieldList
          rows={Object.entries(item.externalIds)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => [externalIdLabels.get(key) ?? key, value])}
        />
        {item.mediaFiles.length > 0 && <MediaFiles files={item.mediaFiles} />}
        {item.artwork.length > 0 && <ArtworkGallery images={item.artwork} />}
        <Disclosure title="معرّف السجل">
          <p className="text-xs" dir="ltr">
            {item.id}
          </p>
        </Disclosure>
      </DialogContent>
    </Dialog>
  );
}

function EpisodeCard({
  episode,
  installment,
  work,
  tracking,
}: {
  episode: Episode;
  installment: Installment;
  work: WorkDetail;
  tracking: WorkTracking;
}) {
  const navigation = useCardNavigation();
  const state = tracking.state.data?.units.find((unit) => unit.episodeId === episode.id);
  const image =
    pickArtwork(episode.artwork, "still") ??
    pickArtwork(episode.artwork, "banner") ??
    episode.artwork[0] ??
    pickArtwork(installment.artwork, "banner") ??
    work.banner;
  return (
    <article className="flex min-w-0 flex-col gap-3" aria-label={`الحلقة ${episode.number}`}>
      <div className="relative overflow-hidden rounded-2xl bg-card">
        <Artwork id={image?.id} alt="" className="aspect-video w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background/75 to-transparent" />
        <div className="absolute inset-s-3 top-3">
          <Badge variant="secondary">{episode.number}</Badge>
        </div>
        <div className="absolute inset-e-3 top-3">
          <WatchedControl
            tracking={tracking}
            installmentId={installment.id}
            episodeId={episode.id}
            label={`الحلقة ${episode.number}`}
            compact
          />
        </div>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              requestWatch({
                workId: work.id,
                installmentId: installment.id,
                episodeId: episode.id,
                title: `${work.titleAr || work.canonicalTitle} · الحلقة ${episode.number}`,
              })
            }
            aria-label={`تشغيل الحلقة ${episode.number}`}
          >
            <Play data-icon="inline-start" />
            تشغيل
          </Button>
        </div>
        <div className="absolute inset-s-3 bottom-3 flex gap-2">
          {episode.runtimeMinutes && <Badge variant="secondary">{episode.runtimeMinutes} د</Badge>}
          {episode.releaseState === "upcoming" && <Badge variant="outline">قادم</Badge>}
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-lg leading-relaxed font-semibold md:text-xl">
          {episode.title || `الحلقة ${episode.number}`}
        </h3>
        <EpisodeDetails episode={episode} state={state} navigation={navigation} />
      </div>
      {episode.summary.trim() && (
        <p className="line-clamp-2 text-base leading-relaxed text-muted-foreground" dir="auto">
          {episode.summary}
        </p>
      )}
      {state && state.positionSeconds > 0 && !state.isPlayed && state.durationSeconds && (
        <progress
          className="h-1 w-full accent-primary"
          value={state.positionSeconds}
          max={state.durationSeconds}
          aria-label={`تقدم الحلقة ${episode.number}`}
        />
      )}
    </article>
  );
}
function EpisodeDetails({
  episode,
  state,
  navigation,
}: {
  episode: Episode;
  state?: ViewerUnitState;
  navigation: ReturnType<typeof useCardNavigation>;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button {...navigation} variant="ghost" size="icon-sm" />}
        aria-label={`تفاصيل الحلقة ${episode.number}`}
      >
        <Info />
      </DialogTrigger>
      <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {episode.number} · {episode.title || "حلقة بلا عنوان"}
          </DialogTitle>
          <DialogDescription>تفاصيل الحلقة في المكتبة</DialogDescription>
        </DialogHeader>
        {episode.summary.trim() && (
          <p className="text-base leading-loose whitespace-pre-line">{episode.summary}</p>
        )}
        <FieldList
          rows={[
            ["رقم الحلقة", episode.number],
            ["الترتيب", episode.position],
            ["تاريخ الإصدار", dateLabel(episode.releaseDate)],
            ["المدة بالدقائق", episode.runtimeMinutes],
            ["حالة الإصدار", statusLabels.get(episode.releaseState)],
            ["المشاهدة", state ? (state.isPlayed ? "تمّت المشاهدة" : "لم تُشاهَد") : null],
            ["علامة يدوية", state ? (state.playedManually ? "نعم" : "لا") : null],
            ["أضيف في", dateLabel(episode.createdAt)],
            ["آخر تحديث", dateLabel(episode.updatedAt)],
          ]}
        />
        {state?.positionSeconds ? (
          <FieldList
            rows={[
              ["تقدم التشغيل بالثواني", state.positionSeconds],
              ["المدة المسجّلة بالثواني", state.durationSeconds],
              ["تاريخ المشاهدة", dateLabel(state.playedAt)],
              ["إزاحة الترجمة بالمللي ثانية", state.subtitleOffsetMs],
            ]}
          />
        ) : null}
        <RiskRows classification={episode.classification} />
        {episode.mediaFiles.length > 0 && <MediaFiles files={episode.mediaFiles} />}
        {episode.artwork.length > 0 && <ArtworkGallery images={episode.artwork} />}
        <Disclosure title="معرّف السجل">
          <p className="text-xs" dir="ltr">
            {episode.id}
          </p>
        </Disclosure>
      </DialogContent>
    </Dialog>
  );
}
