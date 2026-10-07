import type { AccountPlaybackState, Installment, TitleDetail } from "@arcadia/contracts";

type Episode = NonNullable<Installment["episodes"]>[number];

import { unplayableEpisodeReason } from "../play-button";

/** The slice of a title the player reads — narrow so a test can build one without a full record. */
export type PlayerTitleSource = Pick<TitleDetail, "imdbId" | "tmdbId"> & {
  installments: readonly Pick<
    Installment,
    "id" | "kind" | "position" | "title" | "status" | "episodes" | "isPlayable"
  >[];
};

export type PlayerEpisodeSource = Episode;
export type PlayerPlaybackSource = Pick<AccountPlaybackState, "episodeId" | "isPlayed">;

/** One playable-or-not episode in catalog order, with enough of its season to label it. */
export interface PlayerEpisode {
  installmentId: string;
  installmentTitle: string;
  /** 1-based season order within the title, for the `الموسم N` label. */
  seasonNumber: number;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string | null;
  runtimeMinutes: number | null;
  playable: boolean;
  played: boolean;
}

export interface PlayerSeason {
  installmentId: string;
  title: string;
  seasonNumber: number;
  episodes: PlayerEpisode[];
}

/**
 * Every season's episodes in order, flattened once so the next-episode lookup, the episodes
 * panel, and the top-bar label all read the same list — one place to keep the "is it playable"
 * rule (`unplayableEpisodeReason`) in step with the play button.
 */
export function playerSeasons(
  detail: PlayerTitleSource | null | undefined,
  playback: readonly PlayerPlaybackSource[] | undefined,
): PlayerSeason[] {
  if (!detail) return [];
  const playedEpisodeIds = new Set(
    playback?.filter((state) => state.isPlayed && state.episodeId).map((state) => state.episodeId),
  );
  const toEpisode = (
    installment: PlayerTitleSource["installments"][number],
    seasonNumber: number,
    episode: Episode,
  ): PlayerEpisode => ({
    installmentId: installment.id,
    installmentTitle: installment.title,
    seasonNumber,
    episodeId: episode.id,
    episodeNumber: episode.number,
    episodeTitle: episode.title,
    runtimeMinutes: episode.runtimeMinutes,
    playable:
      unplayableEpisodeReason({
        releaseStatus: installment.status,
        releaseAt: episode.releaseDate ? Date.parse(episode.releaseDate) : null,
        titleImdbId: detail.imdbId,
        titleTmdbId: detail.tmdbId,
        episodeNumber: episode.number,
      }) === null,
    played: playedEpisodeIds.has(episode.id),
  });

  return detail.installments
    .filter((installment) => installment.kind === "season" && installment.isPlayable)
    .toSorted((left, right) => left.position - right.position)
    .map((installment, index) => ({
      installmentId: installment.id,
      title: installment.title,
      seasonNumber: index + 1,
      episodes: (installment.episodes ?? [])
        .toSorted((left, right) => left.position - right.position)
        .map((episode) => toEpisode(installment, index + 1, episode)),
    }))
    .filter((season) => season.episodes.length > 0);
}

export function findEpisode(
  seasons: readonly PlayerSeason[],
  installmentId: string,
  episodeId: string | null,
): PlayerEpisode | null {
  if (!episodeId) return null;
  for (const season of seasons) {
    const match = season.episodes.find(
      (episode) => episode.installmentId === installmentId && episode.episodeId === episodeId,
    );
    if (match) return match;
  }
  return null;
}

/** The first playable, not-yet-watched episode after the current one, across season boundaries. */
export function nextUnwatchedEpisode(
  seasons: readonly PlayerSeason[],
  installmentId: string,
  episodeId: string | null,
): PlayerEpisode | null {
  if (!episodeId) return null;
  const all = seasons.flatMap((season) => season.episodes);
  const currentIndex = all.findIndex(
    (episode) => episode.installmentId === installmentId && episode.episodeId === episodeId,
  );
  if (currentIndex < 0) return null;
  return all.slice(currentIndex + 1).find((episode) => episode.playable && !episode.played) ?? null;
}
