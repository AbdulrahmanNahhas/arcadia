import type {
  ArchiveQuality,
  AuditEntry,
  BackgroundJob,
  Collection,
  ContinueWatchingResponse,
  DuplicateCandidate,
  FamilyActivity,
  FamilyEvent,
  FamilyRecommendation,
  Notification,
  ReleaseCalendarItem,
  SavedView,
  ViewHistoryItem,
  WatchStats,
} from "@arcadia/contracts";
import { apiFetch } from "@/lib/api";

export type LibraryEntry = {
  titleId: string;
  title: string;
  posterPath: string | null;
  isFavorite: boolean;
  personalRating: number | null;
  notes: string;
  updatedAt: string;
};

export const archiveKeys = {
  root: ["archive"] as const,
  library: ["archive", "library"] as const,
  history: ["archive", "history"] as const,
  views: ["archive", "views"] as const,
  collections: ["archive", "collections"] as const,
  calendar: ["archive", "calendar"] as const,
  activity: ["archive", "activity"] as const,
  recommendations: ["archive", "recommendations"] as const,
  events: ["archive", "events"] as const,
  notifications: ["archive", "notifications"] as const,
  continueWatching: ["archive", "continue-watching"] as const,
  watchStats: ["archive", "watch-stats"] as const,
  admin: ["archive", "admin"] as const,
};

export const getLibrary = () => apiFetch<LibraryEntry[]>("/api/v1/me/library");
export const getHistory = () => apiFetch<ViewHistoryItem[]>("/api/v1/me/history");
export const clearHistory = (titleId = "all") =>
  apiFetch<{ deleted: true }>(`/api/v1/me/history/${titleId}`, { method: "DELETE" });
export const recordHistory = (titleId: string) =>
  apiFetch<{ recorded: true }>(`/api/v1/me/history/${titleId}`, { method: "POST" });

export const getSavedViews = () => apiFetch<SavedView[]>("/api/v1/me/saved-views");
export const createSavedView = (input: {
  name: string;
  query: Record<string, unknown>;
  isDefault?: boolean;
  notifyNew?: boolean;
}) =>
  apiFetch<{ id: string }>("/api/v1/me/saved-views", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getCollections = () => apiFetch<Collection[]>("/api/v1/collections");
export const createCollection = (input: {
  name: string;
  description: string;
  visibility: "private" | "family";
  ranked: boolean;
}) =>
  apiFetch<{ id: string }>("/api/v1/collections", {
    method: "POST",
    body: JSON.stringify({ ...input, isSmart: false, rules: null }),
  });
export const addCollectionItem = (collectionId: string, titleId: string, note = "") =>
  apiFetch<{ added: true }>(`/api/v1/collections/${collectionId}/items`, {
    method: "POST",
    body: JSON.stringify({ titleId, note }),
  });

export const getCalendar = () => apiFetch<ReleaseCalendarItem[]>("/api/v1/calendar/releases");
export const toggleFollow = (titleId: string) =>
  apiFetch<{ followed: boolean }>(`/api/v1/me/follows/${titleId}`, { method: "PUT" });
export const getFamilyActivity = () => apiFetch<FamilyActivity[]>("/api/v1/family/activity");
export const getRecommendations = () =>
  apiFetch<FamilyRecommendation[]>("/api/v1/family/recommendations");
export const createRecommendation = (input: {
  recipientAccountId: string;
  titleId: string;
  reason: string;
}) =>
  apiFetch<{ id: string }>("/api/v1/family/recommendations", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const respondRecommendation = (id: string, status: "accepted" | "deferred" | "dismissed") =>
  apiFetch<{ updated: true }>(`/api/v1/family/recommendations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const getFamilyEvents = () => apiFetch<FamilyEvent[]>("/api/v1/family/events");
export const createFamilyEvent = (input: {
  name: string;
  notes: string;
  scheduledFor: string | null;
  candidateTitleIds: string[];
}) =>
  apiFetch<{ id: string }>("/api/v1/family/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const voteForEventTitle = (eventId: string, titleId: string) =>
  apiFetch<{ voted: boolean }>(`/api/v1/family/events/${eventId}/votes/${titleId}`, {
    method: "POST",
  });

export const getNotifications = () => apiFetch<Notification[]>("/api/v1/me/notifications");
export const readNotification = (id: string) =>
  apiFetch<{ read: true }>(`/api/v1/me/notifications/${id}/read`, { method: "PATCH" });

/** "My Space" continue-watching/up-next row — see `docs/tracking-dashboard-i18n-roadmap.md` Phase D. */
export const getContinueWatching = () =>
  apiFetch<ContinueWatchingResponse>("/api/v1/me/continue-watching");
export const getWatchStats = () => apiFetch<WatchStats>("/api/v1/me/watch-stats");

export const getAdminQuality = () => apiFetch<ArchiveQuality[]>("/api/v1/admin/archive/quality");
export const getAdminAudit = () => apiFetch<AuditEntry[]>("/api/v1/admin/archive/audit");
export const getAdminDuplicates = () =>
  apiFetch<DuplicateCandidate[]>("/api/v1/admin/archive/duplicates");
export const getAdminJobs = () => apiFetch<BackgroundJob[]>("/api/v1/admin/archive/jobs");
export const runAdminJob = (type: string) =>
  apiFetch<{ id: string }>("/api/v1/admin/archive/jobs", {
    method: "POST",
    body: JSON.stringify({ type, payload: {} }),
  });
export const updateTitleWorkflow = (
  titleId: string,
  status: "draft" | "in_review" | "approved" | "published" | "archived",
) =>
  apiFetch<{ status: string }>(`/api/v1/admin/titles/${titleId}/workflow`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
