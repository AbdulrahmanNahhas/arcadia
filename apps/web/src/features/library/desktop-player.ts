import type { StreamCandidate } from "@arcadia/contracts";
import { z } from "zod";

/**
 * The bridge to the Tauri shell's player commands.
 *
 * The same `apps/web` bundle is also served as a plain SPA (`pnpm dev`, Playwright), where none of
 * this exists. Every entry point here is therefore guarded and `@tauri-apps/api` is only ever
 * loaded through a dynamic `import()` — importing it at module scope in a browser context throws,
 * which would take the whole route down and break the e2e suite along with it.
 */

/** Mirrors `PlayerTick` in `src-tauri/src/player/mod.rs`. */
export interface PlayerTick {
  position: number;
  duration: number;
  paused: boolean;
  /** mpv stalled waiting for the demuxer cache. Distinct from a deliberate pause. */
  buffering: boolean;
  cacheSeconds: number;
  eof: boolean;
}

/** Mirrors `StreamProgress` in `src-tauri/src/torrent/mod.rs`. */
export interface TransferProgress {
  torrentId: number;
  downloadedBytes: number;
  totalBytes: number;
  downloadRateBps: number;
  peersConnected: number;
  finished: boolean;
}

/** Mirrors `PlayerEvent` in `src-tauri/src/player/mod.rs`. */
export type PlayerEvent =
  | ({ type: "tick" } & PlayerTick)
  | { type: "fileLoaded"; duration: number | null; hardwareDecoder: string | null }
  | { type: "ended"; reason: string }
  | { type: "idle" }
  | { type: "failed"; message: string }
  | ({ type: "transfer" } & TransferProgress)
  | { type: "attempt"; candidateId: string; index: number; total: number }
  | { type: "resolving" }
  /** The pointer moved anywhere over the window, including over the video surface itself — see
   * the note on `watch_pointer` in `src-tauri/src/player/surface.rs` for why this has to come
   * from Rust rather than a DOM `pointermove` listener. */
  | { type: "pointerMoved" };

/**
 * Mirrors `PlayerError` in `src-tauri/src/error.rs`. Commands reject with this shape rather than a
 * stringified panic, so it is parsed at the boundary like any other external payload.
 */
export const playerErrorSchema = z.object({
  kind: z.enum([
    "engineUnavailable",
    "surfaceUnavailable",
    "mpv",
    "torrentRejected",
    "torrentStalled",
    "streamServer",
  ]),
  detail: z.string(),
});
export type PlayerError = z.infer<typeof playerErrorSchema>;

/**
 * A rectangle of interface the video surface must not cover, in CSS pixels measured from the top
 * left of the window. Mirrors `UiRect` in `src-tauri/src/player/surface.rs`.
 */
export interface UiRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The element's CSS corner radius, so the hole follows the control's shape. */
  radius: number;
}

export interface StartedStream {
  candidateId: string;
  url: string;
  torrentId: number | null;
}

/**
 * True only inside the Tauri shell. Checked against the injected global rather than by trying an
 * import, so the browser build never pays for the module at all.
 */
export function isDesktopShell(): boolean {
  // In a browser `globalThis` *is* `window`; under prerender neither the global nor the Tauri
  // marker exists, so this is false without touching `window` directly.
  return "__TAURI_INTERNALS__" in globalThis;
}

async function core() {
  return import("@tauri-apps/api/core");
}

/** The argument shapes the Rust commands accept, keyed by command name. */
interface CommandArguments {
  player_init: never;
  player_set_overlay: { visible: boolean; regions: UiRect[] };
  player_start_stream: { candidates: StreamCandidate[] };
  player_play: never;
  player_pause: never;
  player_seek: { seconds: number };
  player_set_volume: { volume: number };
  player_set_property: { name: string; value: string };
  player_get_property: { name: string };
  player_load_subtitle: { bytes: number[]; filename: string };
  player_stop: never;
}

async function invoke<TCommand extends keyof CommandArguments, TResult>(
  command: TCommand,
  args?: CommandArguments[TCommand],
): Promise<TResult> {
  const { invoke: tauriInvoke } = await core();
  return tauriInvoke<TResult>(command, args);
}

/**
 * Opens the event pipe. A `Channel` is a direct, ordered, single-consumer pipe — unlike `emit`,
 * which broadcasts to every webview and re-serialises per listener — and the Rust side already
 * throttles ticks to 4 Hz, so nothing further is needed on this end.
 */
export async function subscribeToPlayer(onEvent: (event: PlayerEvent) => void): Promise<void> {
  const { Channel, invoke: tauriInvoke } = await core();
  const channel = new Channel<PlayerEvent>();
  // `Channel` is not an EventTarget; assigning `onmessage` is the only handler API Tauri exposes.
  // oxlint-disable-next-line unicorn/prefer-add-event-listener
  channel.onmessage = onEvent;
  await tauriInvoke("player_subscribe", { onEvent: channel });
}

export const desktopPlayer = {
  init: () => invoke<"player_init", void>("player_init"),
  setOverlay: (visible: boolean, regions: UiRect[]) =>
    invoke<"player_set_overlay", void>("player_set_overlay", { visible, regions }),
  startStream: (candidates: StreamCandidate[]) =>
    invoke<"player_start_stream", StartedStream>("player_start_stream", { candidates }),
  play: () => invoke<"player_play", void>("player_play"),
  pause: () => invoke<"player_pause", void>("player_pause"),
  seek: (seconds: number) => invoke<"player_seek", void>("player_seek", { seconds }),
  setVolume: (volume: number) => invoke<"player_set_volume", void>("player_set_volume", { volume }),
  setProperty: (name: string, value: string) =>
    invoke<"player_set_property", void>("player_set_property", { name, value }),
  getProperty: (name: string) =>
    invoke<"player_get_property", string>("player_get_property", { name }),
  /** `bytes` are the raw subtitle file contents — the caller already downloaded them through the
   *  API's authenticated OpenSubtitles proxy; this only crosses them into a local file `sub-add`
   *  can open. */
  loadSubtitle: (bytes: Uint8Array, filename: string) =>
    invoke<"player_load_subtitle", void>("player_load_subtitle", {
      bytes: [...bytes],
      filename,
    }),
  stop: () => invoke<"player_stop", void>("player_stop"),
};

/** One entry from mpv's `track-list`, as enumerated by {@link listPlayerTracks}. */
export interface PlayerTrack {
  /** mpv's own track id — what `aid`/`sid` gets set to. */
  id: string;
  lang: string | null;
  title: string | null;
  selected: boolean;
}

/**
 * `track-list` is node-typed and cannot ride `observe_property` (see `player/mod.rs`), but mpv
 * also exposes it as individually-indexed scalar sub-properties — `track-list/count`, then
 * `track-list/N/id`/`/type`/`/lang`/`/title`/`/selected` per index — every one reachable through
 * the existing generic `getProperty` command, so this needs zero new Rust. Sequential rather than
 * `Promise.all`'d across indices: track counts are small (a handful at most), and each `getProperty`
 * call is already its own IPC round trip regardless.
 */
export async function listPlayerTracks(type: "audio" | "sub"): Promise<PlayerTrack[]> {
  const countRaw = await desktopPlayer.getProperty("track-list/count").catch(() => "0");
  const count = Number.parseInt(countRaw, 10) || 0;
  const tracks: PlayerTrack[] = [];
  for (let index = 0; index < count; index += 1) {
    const trackType = await desktopPlayer.getProperty(`track-list/${index}/type`).catch(() => "");
    if (trackType !== type) continue;
    const id = await desktopPlayer.getProperty(`track-list/${index}/id`).catch(() => "");
    if (!id) continue;
    const [lang, title, selected] = await Promise.all([
      desktopPlayer.getProperty(`track-list/${index}/lang`).catch(() => ""),
      desktopPlayer.getProperty(`track-list/${index}/title`).catch(() => ""),
      desktopPlayer.getProperty(`track-list/${index}/selected`).catch(() => "no"),
    ]);
    tracks.push({ id, lang: lang || null, title: title || null, selected: selected === "yes" });
  }
  return tracks;
}

/**
 * The only languages the family actually wants offered in the audio/subtitle menus, keyed by
 * every code mpv/ffmpeg is known to report for them (ISO 639-1 and 639-2, both seen in the wild
 * across different muxers) — a track in any other language exists in the file but is hidden from
 * the menu entirely, not shown-and-disabled the way an `allowedAudio` restriction used to. That
 * restriction was cut from this picker for exactly this bug: a language outside it stayed visibly
 * "selected" (mpv itself may default to a Japanese dub, say) yet permanently unclickable, with no
 * way back to it once switched away — this fixed set replaces it with an honest "not offered at
 * all" instead.
 */
const AUDIO_TRACK_LANGUAGES: Record<string, string> = {
  ar: "العربية",
  ara: "العربية",
  en: "الإنجليزية",
  eng: "الإنجليزية",
  ja: "اليابانية",
  jpn: "اليابانية",
  es: "الإسبانية",
  spa: "الإسبانية",
};

/** Arabic and English only, per the same "don't show other options" rule as the audio menu. */
const SUBTITLE_TRACK_LANGUAGES: Record<string, string> = {
  ar: "العربية",
  ara: "العربية",
  en: "الإنجليزية",
  eng: "الإنجليزية",
};

/**
 * Filters `tracks` down to the curated language set for `kind`, attaching the Arabic label to
 * show instead of the raw ISO code or (often absent/unhelpful) container title.
 */
export function knownLanguageTracks(
  tracks: PlayerTrack[],
  kind: "audio" | "sub",
): Array<PlayerTrack & { label: string }> {
  const languages = kind === "audio" ? AUDIO_TRACK_LANGUAGES : SUBTITLE_TRACK_LANGUAGES;
  return tracks.flatMap((track) => {
    const label = track.lang ? languages[track.lang.toLowerCase()] : undefined;
    return label ? [{ ...track, label }] : [];
  });
}

/** Fullscreen is a core Tauri API, so it is the one thing here that needs a capability entry. */
export async function setFullscreen(fullscreen: boolean): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setFullscreen(fullscreen);
}

export async function isFullscreen(): Promise<boolean> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isFullscreen();
}
