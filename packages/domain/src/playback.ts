/**
 * Jellyfin-style auto-watched threshold: a movie or episode is marked watched automatically once
 * playback position reaches this fraction of its duration.
 *
 * The product owner was asked to pin an exact number (90%, 95%, or configurable) and declined —
 * see `docs/tracking-dashboard-i18n-roadmap.md`, Phase B's "Open questions". 90% is the default
 * this codebase ships with (it matches Jellyfin/Plex/Trakt's own defaults), expressed as one
 * named constant so both the API and any client-side display share it rather than each
 * hardcoding the ratio. Revisit here if the number ever needs to change or become configurable.
 */
export const AUTO_WATCHED_THRESHOLD = 0.9;

/**
 * Whether a position/duration pair crosses the auto-watched threshold. `durationSeconds` is
 * `null` until the player reports one (a torrent-backed stream may not know its duration for a
 * while), in which case nothing can be auto-marked watched yet.
 */
export function isAutoWatched(positionSeconds: number, durationSeconds: number | null): boolean {
  if (durationSeconds == null || durationSeconds <= 0) return false;
  return positionSeconds / durationSeconds >= AUTO_WATCHED_THRESHOLD;
}

/**
 * The next `isPlayed` value for a progress write (`PUT /api/v1/me/playback`). A manual toggle
 * always overrides the auto-computed value: once a row has `playedManually=true`, a later
 * position/duration update must not flip `isPlayed` back on its own — the family member's
 * explicit choice sticks until they toggle it again themselves.
 */
export function nextIsPlayed(input: {
  positionSeconds: number;
  durationSeconds: number | null;
  previouslyPlayedManually: boolean;
  previouslyIsPlayed: boolean;
}): boolean {
  if (input.previouslyPlayedManually) return input.previouslyIsPlayed;
  return isAutoWatched(input.positionSeconds, input.durationSeconds);
}
