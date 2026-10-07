import { titleKindLabels } from "@arcadia/domain";
import { taxonomyLabel, valueLabel } from "@arcadia/i18n";
import { PlayIcon, StarIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { archiveKeys, getContinueWatching } from "@/features/archive/api";
import { DownloadButton } from "@/features/library/downloads/download-button";
import { unplayableReason } from "@/features/library/play-button";
import {
  FocusContext,
  revealSpatialTarget,
  useSpatialFocusable,
} from "@/features/platform/spatial-navigation";
import { getTitle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { displayTitleOf } from "./api";
import type { DisplayCardItem } from "./display-card";
import { DisplayRail } from "./display-rail";
import { DisplayShell } from "./display-shell";

type Detail = NonNullable<Awaited<ReturnType<typeof getTitle>>>;
type Installment = Detail["installments"][number];

function installmentReleaseAt(installment: Installment) {
  return installment.releaseDate ? Date.parse(installment.releaseDate) : null;
}

function playable(installment: Installment) {
  return (
    installment.isPlayable &&
    unplayableReason({
      releaseStatus: installment.status,
      releaseAt: installmentReleaseAt(installment),
      imdbId: installment.imdbId,
      tmdbId: installment.tmdbId,
    }) === null
  );
}

/**
 * Display Title: banner full-bleed, the facts a family needs (year, kind, rating, genres, age),
 * one big Play that resumes where the account left off, a Download beside it on desktop, then a
 * season strip and an episode rail. No tabs, no cast grid, no comments — that is the desk page.
 */
export function DisplayTitle({ titleId }: { titleId: string }) {
  const detail = useQuery({
    queryKey: ["title", titleId],
    queryFn: () => getTitle(titleId),
    staleTime: 5 * 60_000,
  });
  const continueWatching = useQuery({
    queryKey: archiveKeys.continueWatching,
    queryFn: getContinueWatching,
    staleTime: 30_000,
  });
  const title = detail.data ?? null;
  const installments = useMemo(
    () => (title?.installments ?? []).toSorted((a, b) => a.position - b.position),
    [title],
  );
  const resume = useMemo(
    () =>
      [...(continueWatching.data?.inProgress ?? []), ...(continueWatching.data?.upNext ?? [])].find(
        (row) => row.titleId === titleId,
      ) ?? null,
    [continueWatching.data, titleId],
  );
  const firstPlayable = installments.find(playable) ?? null;
  const seasons = installments.filter((i) => i.kind === "season");
  // The chosen season is state only once the remote picks one; until then it follows the
  // resume row (or the first season), derived during render rather than synced by an effect.
  const [pickedSeasonId, setSeasonId] = useState<string | null>(null);
  const seasonId = pickedSeasonId ?? resume?.installmentId ?? seasons[0]?.id ?? null;
  const season = seasons.find((s) => s.id === seasonId) ?? null;

  const episodeItems: DisplayCardItem[] = (season?.episodes ?? []).map((episode) => ({
    id: episode.id,
    title: episode.title ? `${episode.number}. ${episode.title}` : `الحلقة ${episode.number}`,
    subtitle: episode.runtimeMinutes ? `${episode.runtimeMinutes} د` : null,
    posterPath: episode.posterPath ?? season?.posterPath ?? title?.bannerPath ?? null,
    bannerPath: episode.posterPath ?? title?.bannerPath ?? null,
    progress:
      resume?.episodeId === episode.id && resume.durationSeconds
        ? resume.positionSeconds / resume.durationSeconds
        : null,
    to: { installmentId: season?.id ?? "", titleId, episodeId: episode.id },
  }));
  const filmItems: DisplayCardItem[] = installments
    .filter((i) => i.kind !== "season")
    .map((film) => ({
      id: film.id,
      title: film.title,
      subtitle: film.releaseDate?.slice(0, 4) ?? null,
      posterPath: film.posterPath ?? title?.posterPath ?? null,
      to: { installmentId: film.id, titleId, episodeId: null },
    }));

  if (detail.isPending) {
    return (
      <DisplayShell>
        <p className="px-[5vw] pt-32 text-xl text-white/60">جارٍ التحميل…</p>
      </DisplayShell>
    );
  }
  if (!title) {
    return (
      <DisplayShell>
        <p className="px-[5vw] pt-32 text-xl text-white/60">هذا العنوان غير موجود.</p>
      </DisplayShell>
    );
  }

  const heroArt = title.bannerPath ?? title.posterPath;
  const classification = title.classifications[0];
  const playTarget = resume
    ? { installmentId: resume.installmentId, episodeId: resume.episodeId }
    : firstPlayable
      ? { installmentId: firstPlayable.id, episodeId: null }
      : null;
  const playLabel = resume?.positionSeconds ? "متابعة المشاهدة" : "تشغيل";

  return (
    <DisplayShell>
      <div className="relative -mt-28 min-h-[78vh]">
        {heroArt && (
          <img src={heroArt} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
        <div className="relative flex min-h-[78vh] flex-col justify-end gap-5 px-[5vw] pb-14 pt-32">
          {title.logoPath ? (
            <img
              src={title.logoPath}
              alt={displayTitleOf(title)}
              className="max-h-40 max-w-[40vw] object-contain object-right"
            />
          ) : (
            <h1 className="max-w-[60vw] font-heading text-6xl font-bold leading-tight drop-shadow-lg">
              {displayTitleOf(title)}
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-white/85">
            {title.score.rating !== null && (
              <span className="flex items-center gap-1 font-semibold text-amber-300">
                <StarIcon weight="fill" /> {title.score.rating.toFixed(1)}
              </span>
            )}
            {title.releaseYear && <span>{title.releaseYear}</span>}
            <span>{titleKindLabels[title.kind].ar}</span>
            {seasons.length > 0 && <span>{seasons.length} مواسم</span>}
            {classification && (
              <span className="rounded border border-white/40 px-2 text-base">
                {valueLabel("ar", classification.age)}
              </span>
            )}
            {title.genres.slice(0, 4).map((genre) => (
              <span key={genre} className="text-white/60">
                {taxonomyLabel("ar", "genres", genre)}
              </span>
            ))}
          </div>
          {title.summary && (
            <p className="max-w-[55vw] text-xl leading-9 text-white/80 line-clamp-4">
              {title.summary}
            </p>
          )}
          <FocusContext.Provider value="title-actions">
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {playTarget ? (
                <Link
                  to="/player/$installmentId"
                  params={{ installmentId: playTarget.installmentId }}
                  search={{
                    titleId,
                    episodeId: playTarget.episodeId,
                    origin: `/titles/${titleId}`,
                  }}
                  data-display-chrome
                  className="flex items-center gap-3 rounded-full bg-white px-9 py-4 text-xl font-bold text-black outline-none"
                >
                  <PlayIcon weight="fill" size={28} />
                  {playLabel}
                  {resume?.episodeLabel && (
                    <span className="font-normal text-black/60">· {resume.episodeLabel}</span>
                  )}
                </Link>
              ) : (
                <span className="rounded-full bg-white/10 px-7 py-4 text-lg text-white/70">
                  {firstPlayable ? "" : "لا يتوفر تشغيل لهذا العنوان بعد"}
                </span>
              )}
              {playTarget && (
                <DownloadButton
                  size="lg"
                  variant="secondary"
                  className="rounded-full px-7 text-lg"
                  target={{
                    titleId,
                    titleName: displayTitleOf(title),
                    installmentId: playTarget.installmentId,
                    episodeId: playTarget.episodeId,
                    label: resume?.episodeLabel ?? firstPlayable?.title ?? displayTitleOf(title),
                  }}
                />
              )}
            </div>
          </FocusContext.Provider>
        </div>
      </div>
      <div className="relative z-10 flex flex-col gap-8 pb-24">
        {seasons.length > 1 && (
          <FocusContext.Provider value="title-seasons">
            <div className="flex flex-wrap gap-2 px-[5vw]">
              {seasons.map((s) => (
                <SeasonChip
                  key={s.id}
                  active={s.id === seasonId}
                  label={s.title}
                  onSelect={() => setSeasonId(s.id)}
                />
              ))}
            </div>
          </FocusContext.Provider>
        )}
        {season && (
          <DisplayRail
            title={seasons.length > 1 ? `حلقات ${season.title}` : "الحلقات"}
            items={episodeItems}
            variant="banner"
          />
        )}
        {filmItems.length > 0 && <DisplayRail title="الأفلام والخاصّات" items={filmItems} />}
      </div>
    </DisplayShell>
  );
}

function SeasonChip({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  const { ref, focused } = useSpatialFocusable<object, HTMLButtonElement>({
    onEnterPress: onSelect,
    onFocus: ({ node }) => {
      revealSpatialTarget(node);
      onSelect();
    },
  });
  return (
    <button
      ref={ref}
      type="button"
      data-display-chrome
      data-focused={focused || undefined}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "rounded-full px-5 py-2 text-lg font-medium outline-none",
        active ? "bg-white/20 text-white" : "bg-white/5 text-white/70",
      )}
    >
      {label}
    </button>
  );
}
