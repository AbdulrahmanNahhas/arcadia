import { type AccountPreferences, accountPreferencesSchema } from "@arcadia/contracts";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The single owner of the colour theme: the `arcadia:theme` storage key, the `dark` class on
 * `<html>`, `color-scheme`, and the `prefers-color-scheme` subscription. Nothing else in the app
 * reads or writes any of those — `settings-page.tsx` calls `setTheme`, `__root.tsx` inlines
 * `themeRestoreScript` so the first paint is already correct, and Tailwind's `dark:` variant
 * (`&:is(.dark *)` in styles.css) follows the class on `<html>`. Keeping `<body>` free of
 * `.dark` is what makes light mode reachable at all.
 *
 * Client-only by construction: the app builds as a static SPA, and every reader below is either
 * an event handler, an effect, or a `useSyncExternalStore` client snapshot.
 */
export type ThemePreference = AccountPreferences["theme"];
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "arcadia:theme";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const DEFAULT_THEME: ThemePreference = "dark";
const themePreferenceSchema = accountPreferencesSchema.pick({ theme: true });
/**
 * `--background` from styles.css as hex, painted on `<html>` before the stylesheet arrives (and
 * mirrored by `app.windows[].backgroundColor` in tauri.conf.json for the native window itself),
 * so a cold start never flashes white. Keep in sync with the two `--background` tokens.
 */
const BACKGROUND_HEX = { dark: "#070a0f", light: "#f9fafc" } satisfies Record<
  ResolvedTheme,
  string
>;

/** Pure: what actually renders for a stored preference given the OS setting. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

/**
 * Runs inline in `<head>` before React, so the page never flashes the wrong palette. Must stay
 * dependency-free and mirror `resolveTheme`/`applyResolvedTheme` exactly (pinned by theme.test.ts).
 */
export const themeRestoreScript = `(function(){try{var r=document.documentElement,t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(DEFAULT_THEME)},d=t==='system'?matchMedia(${JSON.stringify(DARK_SCHEME_QUERY)}).matches:t==='dark';r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.style.backgroundColor=d?${JSON.stringify(BACKGROUND_HEX.dark)}:${JSON.stringify(BACKGROUND_HEX.light)}}catch(e){}})()`;

function readStoredPreference(): ThemePreference {
  const parsed = themePreferenceSchema.safeParse({
    theme: window.localStorage.getItem(THEME_STORAGE_KEY),
  });
  return parsed.success ? parsed.data.theme : DEFAULT_THEME;
}

function osPrefersDark(): boolean {
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.style.backgroundColor = BACKGROUND_HEX[resolved];
}

// A tiny external store so every `useTheme()` caller re-renders together when the preference or
// the OS scheme changes, without a context provider in the tree.
const listeners = new Set<() => void>();
let currentPreference: ThemePreference | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function getPreference(): ThemePreference {
  currentPreference ??= readStoredPreference();
  return currentPreference;
}

function getResolved(): ResolvedTheme {
  return resolveTheme(getPreference(), osPrefersDark());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Persists and applies a preference. Safe to call from anywhere (settings save, a shortcut). */
export function setTheme(preference: ThemePreference) {
  currentPreference = preference;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyResolvedTheme(resolveTheme(preference, osPrefersDark()));
  notify();
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getPreference, () => DEFAULT_THEME);
  const resolved = useSyncExternalStore(subscribe, getResolved, () => DEFAULT_THEME);
  return { preference, resolved, setTheme };
}

/**
 * Mount once near the root. Keeps a `system` preference live when the OS switches, and applies
 * the account's server-side preference on sign-in so a second device follows the same setting.
 */
export function useThemeEffects(accountPreference: ThemePreference | undefined) {
  useEffect(() => {
    const media = window.matchMedia(DARK_SCHEME_QUERY);
    const onChange = () => {
      if (getPreference() !== "system") return;
      applyResolvedTheme(resolveTheme("system", media.matches));
      notify();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (accountPreference && accountPreference !== getPreference()) setTheme(accountPreference);
  }, [accountPreference]);
}
