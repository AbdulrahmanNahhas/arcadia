import type { InstallmentSubtitles, SubtitleCandidate, WatchSubtitles } from "@arcadia/contracts";
import { apiBaseUrl, apiFetch, authenticatedFetch } from "@/lib/api";

/**
 * The subtitle half of the player (roadmap Phase 2). Mirrors `playback-resolver.ts`'s shape:
 * search is a plain JSON `apiFetch`, download is a raw authenticated `fetch` since the response
 * is a subtitle file's bytes, not JSON.
 *
 * Two kinds of thing can be subtitled: a catalog unit (installment + optional episode) and a
 * watch-hub target (a bare IMDb id, optionally with season/episode). Both go through the API's
 * OpenSubtitles proxy — the desktop shell never talks to OpenSubtitles directly.
 */
export type SubtitleSource =
  | { kind: "installment"; installmentId: string; episodeId: string | null }
  | { kind: "watch"; imdbId: string; season: number | null; episode: number | null };

export function subtitleSourceKey(source: SubtitleSource): string {
  return source.kind === "installment"
    ? `${source.installmentId}:${source.episodeId ?? ""}`
    : `${source.imdbId}:${source.season ?? ""}:${source.episode ?? ""}`;
}

function watchParams(source: Extract<SubtitleSource, { kind: "watch" }>) {
  const params = new URLSearchParams({ imdbId: source.imdbId });
  if (source.season !== null) params.set("season", String(source.season));
  if (source.episode !== null) params.set("episode", String(source.episode));
  return params;
}

export async function searchSubtitles(
  source: SubtitleSource,
  options: { videoHash?: string | null; languages?: string } = {},
): Promise<SubtitleCandidate[]> {
  const params = source.kind === "installment" ? new URLSearchParams() : watchParams(source);
  if (source.kind === "installment" && source.episodeId) params.set("episodeId", source.episodeId);
  if (options.videoHash) params.set("videoHash", options.videoHash);
  if (options.languages) params.set("languages", options.languages);
  const query = params.size ? `?${params.toString()}` : "";
  if (source.kind === "installment") {
    const result = await apiFetch<InstallmentSubtitles>(
      `/api/v1/installments/${source.installmentId}/subtitles${query}`,
    );
    return result.candidates;
  }
  const result = await apiFetch<WatchSubtitles>(`/api/v1/watch/subtitles${query}`);
  return result.candidates;
}

/**
 * Fetches a chosen candidate's bytes through the API's OpenSubtitles proxy. Not a plain
 * `apiFetch`: the response body is the subtitle file itself, not a JSON envelope.
 */
export async function downloadSubtitle(
  source: SubtitleSource,
  fileId: number,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const path =
    source.kind === "installment"
      ? `/api/v1/installments/${source.installmentId}/subtitles/${fileId}/download`
      : `/api/v1/watch/subtitles/${fileId}/download`;
  const response = await authenticatedFetch(`${apiBaseUrl}${path}`);
  if (!response.ok) throw new Error("تعذّر تنزيل ملف الترجمة.");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `subtitle-${fileId}.srt`;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, filename };
}
