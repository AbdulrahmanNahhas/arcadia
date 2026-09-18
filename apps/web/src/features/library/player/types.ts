/** Where the player is in its life: only the first two get the big centred loading badge. */
export type PlayerStatus = "starting" | "resolving" | "buffering" | "playing" | "error";

/** The one modal panel that can be open at a time. */
export type PanelKind = "tracks" | "speed" | "source" | "episodes" | "more";

/** Whether the bar auto-hides normally, is pinned visible, or is forced hidden (`h` cycles it). */
export type UiLockMode = "auto" | "visible" | "hidden";

/** A momentary confirmation of an action that just happened, shown centred over the picture. */
export type FeedbackEvent =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "seek"; deltaSeconds: number }
  | { kind: "volume"; value: number; muted: boolean }
  | { kind: "lock"; mode: UiLockMode }
  | { kind: "resume"; positionSeconds: number };

/**
 * The 4 Hz tick from Rust, plus when it arrived, held in a ref so the paint loop can extrapolate
 * between ticks without a single React commit. `paused: true` is the "no real tick yet" state:
 * it keeps the clock frozen at 0:00 while a stream is still resolving instead of counting up from
 * how long the screen itself has been open.
 */
export interface TickSnapshot {
  position: number;
  duration: number;
  cacheSeconds: number;
  paused: boolean;
  at: number;
}

export const INITIAL_TICK: TickSnapshot = {
  position: 0,
  duration: 0,
  cacheSeconds: 0,
  paused: true,
  at: 0,
};
