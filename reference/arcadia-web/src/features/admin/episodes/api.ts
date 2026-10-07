import type {
  AdminEpisode,
  AdminEpisodeRowInput,
  AdminEpisodesResponse,
  TmdbApplyInput,
  TmdbSeasonPreview,
} from "@arcadia/contracts";
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const episodeKeys = {
  all: ["admin", "episodes"] as const,
  season: (installmentId: string) => [...episodeKeys.all, installmentId] as const,
  tmdb: (installmentId: string, season: number | null) =>
    [...episodeKeys.all, installmentId, "tmdb", season] as const,
};

export const seasonEpisodesQueryOptions = (installmentId: string) =>
  queryOptions({
    queryKey: episodeKeys.season(installmentId),
    queryFn: () =>
      apiFetch<AdminEpisodesResponse>(`/api/v1/admin/installments/${installmentId}/episodes`),
  });

export function saveSeasonEpisodes(
  installmentId: string,
  episodes: AdminEpisodeRowInput[],
  removeIds: string[],
) {
  return apiFetch<AdminEpisodesResponse>(`/api/v1/admin/installments/${installmentId}/episodes`, {
    method: "PUT",
    body: JSON.stringify({ episodes, removeIds }),
  });
}

export const tmdbSeasonPreviewQueryOptions = (installmentId: string, season: number | null) =>
  queryOptions({
    queryKey: episodeKeys.tmdb(installmentId, season),
    queryFn: () =>
      apiFetch<TmdbSeasonPreview>(
        `/api/v1/admin/installments/${installmentId}/episodes/tmdb${
          season === null ? "" : `?season=${season}`
        }`,
      ),
    retry: false,
  });

export type TmdbApplyResult = AdminEpisodesResponse & {
  applied: { updated: number; created: number; stillsSaved: number; fetched: number };
};

export function applyTmdbSeason(installmentId: string, input: TmdbApplyInput) {
  return apiFetch<TmdbApplyResult>(`/api/v1/admin/installments/${installmentId}/episodes/tmdb`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** A row in the editor: a persisted episode, or a new one keyed by a local id until saved. */
export type EpisodeDraft = Omit<AdminEpisode, "id"> & {
  id: string | null;
  localKey: string;
  /** Set when the still was changed in the editor (path/URL or `null` to clear). */
  posterChanged?: boolean;
};

export function toDraft(episode: AdminEpisode): EpisodeDraft {
  return { ...episode, localKey: episode.id };
}

export function newDraft(after: EpisodeDraft[]): EpisodeDraft {
  const number = after.reduce((max, episode) => Math.max(max, Math.floor(episode.number)), 0) + 1;
  const position = after.reduce((max, episode) => Math.max(max, episode.position), 0) + 1;
  return {
    id: null,
    localKey: `new-${number}-${Date.now()}`,
    number,
    position,
    title: null,
    summary: "",
    releaseDate: null,
    runtimeMinutes: null,
    posterPath: null,
    posterChanged: false,
  };
}

export function toInput(draft: EpisodeDraft): AdminEpisodeRowInput {
  const input: AdminEpisodeRowInput = {
    number: draft.number,
    position: draft.position,
    title: draft.title?.trim() ? draft.title.trim() : null,
    summary: draft.summary,
    releaseDate: draft.releaseDate || null,
    runtimeMinutes: draft.runtimeMinutes,
  };
  if (draft.id) input.id = draft.id;
  // Absent means "leave the still alone"; only an edited row sends the field (even as null).
  if (draft.posterChanged) input.posterPath = draft.posterPath;
  return input;
}
