import type { TitleDetail } from "@arcadia/contracts";
import { useSyncExternalStore } from "react";

/**
 * "Save for offline" storage (docs/deployment-and-release-roadmap.md §4) — a title's detail
 * payload and its poster/banner/logo bytes, kept in IndexedDB so a saved title renders fully with
 * no server reachable. Deliberately not the actual video (that's Phase 3 in
 * player-torrent-roadmap.md, a separate, larger feature): this only ever holds metadata + images,
 * a few hundred KB per title at most.
 *
 * IndexedDB rather than a Tauri-specific filesystem API on purpose — the same code path works
 * unmodified in the browser build and inside the Tauri webview (which supports IndexedDB fine),
 * matching how every other shared feature in this codebase avoids a desktop-only branch unless
 * the underlying capability genuinely doesn't exist in a browser (torrent/mpv playback does;
 * storing a JSON blob and some images does not).
 */

const databaseName = "arcadia-offline";
const databaseVersion = 1;
const titlesStore = "titles";
const imagesStore = "images";

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => {
      // SAFETY: IDBRequest.error is only null before the request settles; the "error" event
      // firing means it already has, so it is always set here.
      reject(request.error as DOMException);
    });
  });
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(titlesStore)) db.createObjectStore(titlesStore);
      if (!db.objectStoreNames.contains(imagesStore)) db.createObjectStore(imagesStore);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => {
      // SAFETY: same as runRequest above — set whenever the "error" event fires.
      reject(request.error as DOMException);
    });
  });
  return databasePromise;
}

/** Every `*Path` field in a title detail payload, deduplicated — the same walk
 *  `rewriteMediaUrls` (`lib/api.ts`) does, but collecting URLs instead of rewriting them. By the
 *  time a detail payload reaches here it has already passed through that rewrite, so every URL
 *  collected is absolute and fetchable on its own. */
function imageUrlsOf(detail: TitleDetail): string[] {
  const urls = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, entryValue] of Object.entries(value)) {
      if (key.endsWith("Path") && typeof entryValue === "string" && entryValue) {
        urls.add(entryValue);
      } else {
        walk(entryValue);
      }
    }
  };
  walk(detail);
  return [...urls];
}

/**
 * Persists `detail` and best-effort downloads every image it references. One missing image (a
 * transient fetch failure) does not fail the save — the title still saves, that one picture just
 * won't render offline, exactly like a broken `<img>` would today.
 */
export async function saveTitleOffline(detail: TitleDetail): Promise<void> {
  const db = await openDatabase();
  await runRequest(
    db.transaction(titlesStore, "readwrite").objectStore(titlesStore).put(detail, detail.id),
  );
  await Promise.all(
    imageUrlsOf(detail).map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const blob = await response.blob();
        await runRequest(
          db.transaction(imagesStore, "readwrite").objectStore(imagesStore).put(blob, url),
        );
      } catch {
        // Best-effort, per the doc comment above.
      }
    }),
  );
}

/**
 * Swaps every `*Path` field's live URL for a `blob:` URL built from that image's cached bytes —
 * the stored detail payload still carries the real server URLs (exactly what a live fetch would
 * have returned), which is correct for the payload itself but useless as an `<img src>` with no
 * server reachable. A `blob:` URL only lives for the current page's session, which is fine here:
 * it's rebuilt fresh from `getOfflineTitle` every time the saved title is opened. A `*Path` whose
 * image never downloaded (a transient failure at save time) is left as its original URL, which
 * fails to load exactly like a normal broken image would.
 */
async function hydrateOfflineImages<T>(value: T): Promise<T> {
  if (Array.isArray(value)) {
    // SAFETY: mapping an array over the identity shape (each element rebuilt by the same
    // function) preserves T's own array-ness; the generic walk can't express that structurally.
    return Promise.all(value.map((item) => hydrateOfflineImages(item))) as Promise<T>;
  }
  if (!value || typeof value !== "object") return value;
  const entries = await Promise.all(
    Object.entries(value).map(async ([key, entryValue]) => {
      if (key.endsWith("Path") && typeof entryValue === "string" && entryValue) {
        const blob = await getOfflineImageBlob(entryValue);
        return [key, blob ? URL.createObjectURL(blob) : entryValue];
      }
      return [key, await hydrateOfflineImages(entryValue)];
    }),
  );
  // SAFETY: entries carries exactly value's own keys, each rebuilt to the same shape (a plain
  // string reassigned, or the recursive result of hydrating that same key's original value) —
  // the object's runtime shape never changes, only some of its leaf string values do.
  return Object.fromEntries(entries) as T;
}

/** Raw read, no blob-URL hydration — for internal use (cleanup) where the image bytes
 *  themselves are never rendered, so creating `blob:` URLs for them would just leak memory
 *  until page unload with nothing to show for it. */
async function getRawOfflineTitle(titleId: string): Promise<TitleDetail | null> {
  const db = await openDatabase();
  const result = await runRequest<unknown>(
    db.transaction(titlesStore, "readonly").objectStore(titlesStore).get(titleId),
  );
  if (result === undefined) return null;
  // SAFETY: this store only ever receives values written by saveTitleOffline above, keyed by
  // the same TitleDetail's own id — never populated from anywhere else.
  return result as TitleDetail;
}

export async function getOfflineTitle(titleId: string): Promise<TitleDetail | null> {
  const raw = await getRawOfflineTitle(titleId);
  return raw ? hydrateOfflineImages(raw) : null;
}

export async function removeTitleOffline(titleId: string): Promise<void> {
  const db = await openDatabase();
  const detail = await getRawOfflineTitle(titleId);
  await runRequest(
    db.transaction(titlesStore, "readwrite").objectStore(titlesStore).delete(titleId),
  );
  if (!detail) return;
  await Promise.all(
    imageUrlsOf(detail).map((url) =>
      runRequest(db.transaction(imagesStore, "readwrite").objectStore(imagesStore).delete(url)),
    ),
  );
}

export async function listOfflineTitleIds(): Promise<string[]> {
  const db = await openDatabase();
  const keys = await runRequest(
    db.transaction(titlesStore, "readonly").objectStore(titlesStore).getAllKeys(),
  );
  // SAFETY: every key in this store is a TitleDetail's own `id` (a string), set by
  // saveTitleOffline's `.put(detail, detail.id)` — never any other kind of IDBValidKey.
  return keys as string[];
}

export async function getOfflineImageBlob(url: string): Promise<Blob | null> {
  const db = await openDatabase();
  const result = await runRequest<Blob | undefined>(
    db.transaction(imagesStore, "readonly").objectStore(imagesStore).get(url),
  );
  return result ?? null;
}

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Hydration-safe online/offline status, for the "غير متصل — من المحفوظات" indicator a saved
 * title's page shows when it rendered from its local copy. Same `useSyncExternalStore` pattern as
 * `useIsDesktopShell` (`play-button.tsx`): the server snapshot is always `true`, so the
 * prerendered HTML never disagrees with the client's first paint — the real answer, if different,
 * arrives on the next commit.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true,
  );
}
