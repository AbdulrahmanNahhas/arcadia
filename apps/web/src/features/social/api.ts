import type {
  AccountPlaybackState,
  AccountTitleState,
  FamilyActivity,
  TitleSocial,
  UpsertPlaybackInput,
} from "@arcadia/contracts";
import { apiFetch } from "@/lib/api";

export const socialKeys = {
  title: (titleId: string) => ["social", "title", titleId] as const,
  activity: ["social", "activity"] as const,
  library: ["account", "library"] as const,
  playbackByTitle: (titleId: string) => ["account", "playback", "title", titleId] as const,
  playbackByInstallment: (installmentId: string, episodeId: string | null) =>
    ["account", "playback", "installment", installmentId, episodeId] as const,
};

export function getTitleSocial(titleId: string) {
  return apiFetch<TitleSocial>(`/api/v1/titles/${titleId}/social`);
}

export function updateTitleState(
  titleId: string,
  input: Partial<Pick<AccountTitleState, "isFavorite" | "personalRating" | "notes">>,
) {
  return apiFetch<AccountTitleState>(`/api/v1/me/library/${titleId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function saveReview(
  titleId: string,
  input: { rating: number; body: string; containsSpoilers: boolean },
) {
  return apiFetch<{ id: string }>(`/api/v1/titles/${titleId}/review`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteReview(titleId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/v1/titles/${titleId}/review`, {
    method: "DELETE",
  });
}

export function saveComment(
  titleId: string,
  input: { parentId: string | null; body: string; containsSpoilers: boolean },
) {
  return apiFetch<{ id: string }>(`/api/v1/titles/${titleId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteComment(titleId: string, commentId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/v1/titles/${titleId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function toggleReaction(
  kind: "review" | "comment",
  objectId: string,
  emoji: "heart" | "clap" | "laugh" | "wow" | "think",
) {
  return apiFetch<{ active: boolean }>(`/api/v1/${kind}s/${objectId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export function getFamilyActivity() {
  return apiFetch<FamilyActivity[]>("/api/v1/family/activity");
}

/** Every playback row for one title — builds the episode watched map and series progress badge. */
export function getPlaybackForTitle(titleId: string) {
  return apiFetch<AccountPlaybackState[]>(`/api/v1/me/playback?titleId=${titleId}`);
}

/** A progress tick (pause/exit/interval). The server derives `isPlayed`; this never sends it. */
export function updatePlaybackProgress(input: UpsertPlaybackInput) {
  return apiFetch<{ id: string; updatedAt: string | null }>("/api/v1/me/playback", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Explicit watched/unwatched toggle for one movie/episode — the Jellyfin-style checkmark. */
export function markPlayed(installmentId: string, episodeId: string | null, isPlayed: boolean) {
  return apiFetch<{ updated: boolean }>(`/api/v1/me/playback/${installmentId}/played`, {
    method: "PATCH",
    body: JSON.stringify({ episodeId, isPlayed }),
  });
}

/** Bulk "mark season/series as watched": `installmentId: null` marks the whole title. */
export function bulkMarkPlayed(titleId: string, installmentId: string | null, isPlayed: boolean) {
  return apiFetch<{ updated: number }>(`/api/v1/titles/${titleId}/playback/played`, {
    method: "PATCH",
    body: JSON.stringify({ installmentId, isPlayed }),
  });
}
