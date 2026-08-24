import { useEffect, useState } from "react";

/**
 * Like `useState`, but reads its initial value from `localStorage` and writes every update back
 * under the given key. Falls back to `defaultValue` — silently, without persisting — outside the
 * browser or when storage throws (private browsing quota, disabled storage, corrupt JSON).
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return defaultValue;
      // SAFETY: this key only ever holds what a previous call to this same hook serialized with
      // `JSON.stringify(value)` below, so the parsed shape matches `T` unless storage was edited
      // by hand — an ordinary user won't do that, and a bad value just resets on next write.
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable — the in-memory value still works for the rest of the session.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
