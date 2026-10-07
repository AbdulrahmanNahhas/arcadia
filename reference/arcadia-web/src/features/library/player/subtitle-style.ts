import { useSyncExternalStore } from "react";
import { desktopPlayer } from "../desktop-player";

/**
 * Subtitle size and vertical position — mpv's `sub-scale` (1 = default) and `sub-pos` (0–150,
 * 100 = bottom edge). Per device, in `localStorage`: the TV wants big captions, the laptop does
 * not, and it is a display preference rather than an account one. Re-applied on every
 * `fileLoaded` because mpv resets nothing between files but a new player process starts clean.
 */
export interface SubtitleStyle {
  scale: number;
  position: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = { scale: 1, position: 100 };
export const SUBTITLE_SCALE_STEP = 0.1;
export const SUBTITLE_SCALE_MIN = 0.5;
export const SUBTITLE_SCALE_MAX = 2.5;
export const SUBTITLE_POSITION_STEP = 5;
export const SUBTITLE_POSITION_MIN = 40;
export const SUBTITLE_POSITION_MAX = 110;

const storageKey = "arcadia:subtitleStyle";
const listeners = new Set<() => void>();
let cached: SubtitleStyle | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function readSubtitleStyle(): SubtitleStyle {
  if (cached) return cached;
  try {
    const raw = globalThis.localStorage?.getItem(storageKey);
    if (raw) {
      const parsed: { scale?: number; position?: number } = JSON.parse(raw);
      cached = {
        scale: clamp(Number(parsed.scale) || 1, SUBTITLE_SCALE_MIN, SUBTITLE_SCALE_MAX),
        position: clamp(
          Number(parsed.position) || 100,
          SUBTITLE_POSITION_MIN,
          SUBTITLE_POSITION_MAX,
        ),
      };
      return cached;
    }
  } catch {
    // Unreadable storage: defaults.
  }
  cached = DEFAULT_SUBTITLE_STYLE;
  return cached;
}

/** `apply` is injectable for tests — production always pushes into mpv. */
export function writeSubtitleStyle(
  next: SubtitleStyle,
  apply: (style: SubtitleStyle) => Promise<void> = applySubtitleStyle,
) {
  cached = {
    scale: clamp(Math.round(next.scale * 100) / 100, SUBTITLE_SCALE_MIN, SUBTITLE_SCALE_MAX),
    position: clamp(Math.round(next.position), SUBTITLE_POSITION_MIN, SUBTITLE_POSITION_MAX),
  };
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(cached));
  } catch {
    // Still applied for this session.
  }
  for (const listener of listeners) listener();
  void apply(cached);
}

/** Pushes the style into the running mpv; harmless when nothing is loaded yet. */
export async function applySubtitleStyle(style: SubtitleStyle = readSubtitleStyle()) {
  await desktopPlayer.setProperty("sub-scale", String(style.scale)).catch(() => undefined);
  await desktopPlayer.setProperty("sub-pos", String(style.position)).catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSubtitleStyle(): SubtitleStyle {
  return useSyncExternalStore(subscribe, readSubtitleStyle, () => DEFAULT_SUBTITLE_STYLE);
}
