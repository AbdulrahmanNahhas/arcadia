import type { StreamCandidate } from "@arcadia/contracts";
import { useSyncExternalStore } from "react";
import { isDesktopShell } from "../desktop-player";
import { noLocalLookup, resolvePlayback } from "../playback-resolver";
import { downloadSubtitle, type SubtitleSource, searchSubtitles } from "../subtitle-resolver";

/**
 * The bridge to the Tauri shell's download commands (`src-tauri/src/downloads`), plus one
 * process-wide store of the download list so every button, badge and the Downloads page read
 * the same snapshot. Same rules as `desktop-player.ts`: `@tauri-apps/*` only through dynamic
 * `import()`, behind {@link isDesktopShell}, so the browser build never touches it.
 */

export type DownloadState = "queued" | "downloading" | "paused" | "completed" | "failed";

/** Mirrors `DownloadTarget` in `src-tauri/src/downloads/registry.rs`. */
export interface DownloadTarget {
  titleId: string;
  titleName: string;
  installmentId: string;
  episodeId: string | null;
  label: string;
}

/** Mirrors `DownloadItem` in `src-tauri/src/downloads/registry.rs` (target fields flattened). */
export interface DownloadItem extends DownloadTarget {
  id: string;
  infoHash: string;
  fileIdx: number | null;
  magnet: string;
  /** Absolute path of the video on this device; `null` until the torrent's metadata resolved. */
  path: string | null;
  folder: string;
  sizeBytes: number;
  downloadedBytes: number;
  downloadRateBps: number;
  peersConnected: number;
  state: DownloadState;
  error: string | null;
  subtitles: Array<{ language: string; path: string }>;
  createdAtMs: number;
  completedAtMs: number | null;
}

/** Mirrors `DownloadSnapshot` in `src-tauri/src/downloads/mod.rs`. */
export interface DownloadSnapshot {
  dir: string;
  deviceId: string;
  items: DownloadItem[];
}

type DownloadEvent = { type: "snapshot" } & DownloadSnapshot;

async function core() {
  return import("@tauri-apps/api/core");
}

interface CommandArguments {
  downloads_list: never;
  downloads_start: { target: DownloadTarget; candidates: StreamCandidate[] };
  downloads_pause: { id: string };
  downloads_resume: { id: string };
  downloads_remove: { id: string; deleteFiles: boolean };
  downloads_find: { installmentId: string; episodeId: string | null };
  downloads_set_dir: { path: string };
  downloads_save_subtitle: { id: string; bytes: number[]; language: string; filename: string };
}

async function invoke<TCommand extends keyof CommandArguments, TResult>(
  command: TCommand,
  args?: CommandArguments[TCommand],
): Promise<TResult> {
  const { invoke: tauriInvoke } = await core();
  return tauriInvoke<TResult>(command, args);
}

export const desktopDownloads = {
  list: () => invoke<"downloads_list", DownloadSnapshot>("downloads_list"),
  start: (target: DownloadTarget, candidates: StreamCandidate[]) =>
    invoke<"downloads_start", DownloadItem>("downloads_start", { target, candidates }),
  pause: (id: string) => invoke<"downloads_pause", void>("downloads_pause", { id }),
  resume: (id: string) => invoke<"downloads_resume", void>("downloads_resume", { id }),
  remove: (id: string, deleteFiles: boolean) =>
    invoke<"downloads_remove", void>("downloads_remove", { id, deleteFiles }),
  find: (installmentId: string, episodeId: string | null) =>
    invoke<"downloads_find", DownloadItem | null>("downloads_find", { installmentId, episodeId }),
  setDir: (path: string) => invoke<"downloads_set_dir", string>("downloads_set_dir", { path }),
  saveSubtitle: (id: string, bytes: Uint8Array, language: string, filename: string) =>
    invoke<"downloads_save_subtitle", string>("downloads_save_subtitle", {
      id,
      bytes: [...bytes],
      language,
      filename,
    }),
};

/**
 * One subscription to the Rust channel for the whole app, opened lazily by the first component
 * that reads the store. Rust pushes a full snapshot on every change and once a second while
 * something transfers, so the store is a plain "latest value" cell.
 */
const emptySnapshot: DownloadSnapshot = { dir: "", deviceId: "", items: [] };
let snapshot: DownloadSnapshot = emptySnapshot;
let subscribed = false;
const listeners = new Set<() => void>();

function setSnapshot(next: DownloadSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

async function openChannel() {
  const { Channel, invoke: tauriInvoke } = await core();
  const channel = new Channel<DownloadEvent>();
  // `Channel` is not an EventTarget; assigning `onmessage` is the only handler API Tauri exposes.
  // oxlint-disable-next-line unicorn/prefer-add-event-listener
  channel.onmessage = (event) => setSnapshot(event);
  const initial = await tauriInvoke<DownloadSnapshot>("downloads_subscribe", { onEvent: channel });
  setSnapshot(initial);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscribed && isDesktopShell()) {
    subscribed = true;
    // The manager comes up a moment after the window (the torrent session starts first); retry
    // until it answers rather than leaving the page empty on a cold start.
    const attempt = (remaining: number) => {
      openChannel().catch(() => {
        if (remaining > 0) setTimeout(() => attempt(remaining - 1), 1000);
      });
    };
    attempt(15);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useDownloads(): DownloadSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => emptySnapshot,
  );
}

/** The download row for one catalog unit on this device, or `null`. */
export function findDownload(
  items: DownloadItem[],
  installmentId: string,
  episodeId: string | null,
): DownloadItem | null {
  return (
    items.find((item) => item.installmentId === installmentId && item.episodeId === episodeId) ??
    null
  );
}

export function useDownloadFor(installmentId: string, episodeId: string | null) {
  const { items } = useDownloads();
  return findDownload(items, installmentId, episodeId);
}

/** Preferred subtitle languages saved beside a download, best-first per language. */
const SIDECAR_LANGUAGES = ["ar", "en"] as const;

/**
 * Best-effort: after the download is registered, fetch the top Arabic and English subtitle
 * through the API's OpenSubtitles proxy and hand the bytes to Rust to write beside the video.
 * A missing key, no results, or a failed download leaves the video downloading regardless.
 */
async function saveSidecarSubtitles(item: DownloadItem, videoHash: string | null) {
  try {
    const source: SubtitleSource = {
      kind: "installment",
      installmentId: item.installmentId,
      episodeId: item.episodeId,
    };
    const found = await searchSubtitles(source, {
      videoHash,
      languages: SIDECAR_LANGUAGES.join(","),
    });
    for (const language of SIDECAR_LANGUAGES) {
      const candidate = found.find((entry) => entry.language === language);
      if (!candidate) continue;
      try {
        const file = await downloadSubtitle(source, candidate.fileId);
        await desktopDownloads.saveSubtitle(item.id, file.bytes, language, file.filename);
      } catch {
        // One language failing must not cost the other.
      }
    }
  } catch {
    // No subtitle source configured, or the server is unreachable — the video still downloads.
  }
}

/**
 * Registers a download of the given torrent candidate(s) — the one the family member picked in
 * the source picker, or the one currently playing — then (once Rust knows the file name) saves
 * sidecar subtitles. Without an explicit choice the API's ranking decides, as the player would.
 * Resolves to the registry row.
 */
export async function startDownload(
  target: DownloadTarget,
  chosen?: StreamCandidate[],
): Promise<DownloadItem> {
  let torrents = chosen?.filter((candidate) => candidate.kind === "torrent") ?? [];
  if (torrents.length === 0) {
    const source = await resolvePlayback(
      target.installmentId,
      target.episodeId,
      null,
      noLocalLookup,
    );
    torrents = source.streams.candidates.filter((candidate) => candidate.kind === "torrent");
  }
  const item = await desktopDownloads.start(target, torrents);
  const videoHash = torrents[0]?.videoHash ?? null;
  // Subtitles need the video's file name, which arrives with the torrent metadata; poll the
  // store briefly for it rather than blocking the click.
  void (async () => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const current = snapshot.items.find((entry) => entry.id === item.id);
      if (!current || current.state === "failed") return;
      if (current.path) {
        if (current.subtitles.length === 0) await saveSidecarSubtitles(current, videoHash);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  })();
  return item;
}

/** Opens the system file manager with the file selected (Tauri opener plugin). */
export async function revealDownload(path: string): Promise<void> {
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function openFolder(path: string): Promise<void> {
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/** Native folder picker; resolves to the chosen absolute path, or `null` when dismissed. */
export async function pickDownloadDir(current: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const chosen = await open({
    directory: true,
    multiple: false,
    defaultPath: current || undefined,
  });
  return Array.isArray(chosen) ? (chosen[0] ?? null) : chosen;
}

export function formatRate(bytesPerSecond: number) {
  const mb = bytesPerSecond / 1024 ** 2;
  return mb >= 1 ? `${mb.toFixed(1)} م.ب/ث` : `${Math.round(bytesPerSecond / 1024)} ك.ب/ث`;
}

export function downloadStateLabel(state: DownloadState) {
  switch (state) {
    case "queued":
      return "في الانتظار";
    case "downloading":
      return "جارٍ التنزيل";
    case "paused":
      return "متوقّف مؤقتاً";
    case "completed":
      return "مكتمل — متاح دون اتصال";
    case "failed":
      return "فشل";
    default:
      return state;
  }
}
