import type { AccountTitleState, FamilyActivity, TitleSocial } from "@arcadia/contracts";
import { apiFetch } from "@/lib/api";

export const socialKeys = {
  title: (titleId: string) => ["social", "title", titleId] as const,
  activity: ["social", "activity"] as const,
  library: ["account", "library"] as const,
};

export function getTitleSocial(titleId: string) {
  return apiFetch<TitleSocial>(`/api/v1/titles/${titleId}/social`);
}

export function updateTitleState(
  titleId: string,
  input: Partial<Pick<AccountTitleState, "status" | "isFavorite" | "personalRating" | "notes">>,
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
