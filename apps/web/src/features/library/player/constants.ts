export const CONTROLS_TIMEOUT_MS = 2_500;
/** One arrow press moves the volume a noticeable amount; 1 % steps would need 100 presses. */
export const VOLUME_STEP = 10;
export const SEEK_STEP_SECONDS = 10;
/**
 * How often progress is persisted while playing, on top of the pause/exit writes — the
 * Jellyfin-style tracking roadmap's "read path" (`docs/tracking-dashboard-i18n-roadmap.md`).
 */
export const PROGRESS_PERSIST_INTERVAL_MS = 20_000;
/** Below this, resuming isn't worth it — just start from the beginning. */
export const RESUME_MIN_POSITION_SECONDS = 15;
/** Within this many seconds of the end, treat it as finished rather than resuming mid-credits. */
export const RESUME_END_BUFFER_SECONDS = 30;
/** How long the end-of-episode card counts down before starting the next one on its own. */
export const AUTOPLAY_NEXT_COUNTDOWN_SECONDS = 10;
/** `sub-delay` nudges in 100 ms steps: fine enough to line up lips, coarse enough to feel. */
export const SUBTITLE_OFFSET_STEP_MS = 100;
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
/**
 * Everything the video surface must not cover. `data-video-overlay` marks the player's own
 * chrome; the `data-slot` value is what the shared Tooltip primitive stamps on its portalled
 * content.
 */
export const OVERLAY_SELECTOR = '[data-video-overlay],[data-slot="tooltip-content"]';
