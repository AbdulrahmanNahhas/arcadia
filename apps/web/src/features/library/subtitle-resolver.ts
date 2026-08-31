import type { InstallmentSubtitles } from "@arcadia/contracts";
import { apiBaseUrl, apiFetch } from "@/lib/api";

/**
 * The subtitle half of the player (roadmap Phase 2). Mirrors `playback-resolver.ts`'s shape:
 * search is a plain JSON `apiFetch`, download is a raw authenticated `fetch` since the response
 * is a subtitle file's bytes, not JSON.
 */
export async function getInstallmentSubtitles(
  installmentId: string,
  options: { episodeId?: string | null; videoHash?: string | null; languages?: string } = {},
): Promise<InstallmentSubtitles> {
  const params = new URLSearchParams();
  if (options.episodeId) params.set("episodeId", options.episodeId);
  if (options.videoHash) params.set("videoHash", options.videoHash);
  if (options.languages) params.set("languages", options.languages);
  const query = params.size ? `?${params.toString()}` : "";
  return apiFetch<InstallmentSubtitles>(`/api/v1/installments/${installmentId}/subtitles${query}`);
}

/**
 * Fetches a chosen candidate's bytes through the API's OpenSubtitles proxy (never talks to
 * OpenSubtitles directly — same reasoning as the torrent addon URL staying server-side). Not a
 * plain `apiFetch`: the response body is the subtitle file itself, not a JSON envelope.
 */
export async function downloadInstallmentSubtitle(
  installmentId: string,
  fileId: number,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/installments/${installmentId}/subtitles/${fileId}/download`,
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("تعذّر تنزيل ملف الترجمة.");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `subtitle-${fileId}.srt`;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, filename };
}
