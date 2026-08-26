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
  stop: () => invoke<"player_stop", void>("player_stop"),
};

/** Fullscreen is a core Tauri API, so it is the one thing here that needs a capability entry. */
export async function setFullscreen(fullscreen: boolean): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setFullscreen(fullscreen);
}

export async function isFullscreen(): Promise<boolean> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isFullscreen();
}
