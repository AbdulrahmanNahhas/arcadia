import { useSyncExternalStore } from "react";

/**
 * Normal (desk) vs Display (TV) posture — docs/v0.3.5.md Phase B. A per-device choice kept in
 * `localStorage`: the living-room box sets it once, the laptop never does. `?tv=1` on any URL
 * switches a device into Display Mode (how a TV box is set up without a keyboard), and
 * `Ctrl+Shift+T` toggles it from anywhere so nobody is stuck in the wrong posture.
 *
 * The mode is one attribute on `<html>` (`data-mode`) that Tailwind's `tv:` variant and the
 * Display Mode rules in `styles.css` key off, plus route-level swaps of the page components.
 */
export type AppMode = "normal" | "display";

const storageKey = "arcadia:display-mode";
const listeners = new Set<() => void>();
let cached: AppMode | null = null;

function isAppMode(value: string | null): value is AppMode {
  return value === "normal" || value === "display";
}

export function readAppMode(): AppMode {
  if (cached) return cached;
  try {
    const stored = globalThis.localStorage?.getItem(storageKey) ?? null;
    cached = isAppMode(stored) ? stored : "normal";
  } catch {
    cached = "normal";
  }
  return cached;
}

export function setAppMode(mode: AppMode) {
  cached = mode;
  try {
    globalThis.localStorage?.setItem(storageKey, mode);
  } catch {
    // Storage disabled: the choice lasts for this session.
  }
  applyAppMode(mode);
  for (const listener of listeners) listener();
}

export function toggleAppMode() {
  setAppMode(readAppMode() === "display" ? "normal" : "display");
}

/** Writes `html[data-mode]`; the restore script in `__root.tsx` does the same before first paint. */
export function applyAppMode(mode: AppMode = readAppMode()) {
  const root = globalThis.document?.documentElement;
  if (root) root.dataset.mode = mode;
}

/** `?tv=1` / `?tv=0` on the current URL switches the mode once and is then dropped. */
export function consumeModeFromUrl() {
  const location = globalThis.location;
  if (!location) return;
  const url = new URL(location.href);
  const tv = url.searchParams.get("tv");
  if (tv === null) return;
  setAppMode(tv === "0" ? "normal" : "display");
  url.searchParams.delete("tv");
  window.history.replaceState(window.history.state, "", url.toString());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppMode() {
  const mode = useSyncExternalStore(subscribe, readAppMode, () => "normal" as const);
  return { mode, isDisplay: mode === "display", setMode: setAppMode, toggle: toggleAppMode };
}

/** Routes Display Mode hides — the desk-only tools. Checked in `beforeLoad`, not only in nav. */
export const displayHiddenPrefixes = [
  "/admin",
  "/compare",
  "/accounts",
  "/awards",
  "/watch",
] as const;

export function isHiddenInDisplayMode(pathname: string) {
  return displayHiddenPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
