import type { InstallmentStreams, TitleDetail } from "@arcadia/contracts";
import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

/**
 * "Save for offline" storage (docs/deployment-and-release-roadmap.md §4) — a title's detail
 * payload, poster/banner/logo bytes, and stable torrent candidates, kept in IndexedDB so a saved
 * title renders and starts playback with no Arcadia server reachable. It deliberately does not
 * cache the video itself: the desktop torrent engine still streams it from peers.
 *
 * IndexedDB rather than a Tauri-specific filesystem API on purpose — the same code path works
 * unmodified in the browser build and inside the Tauri webview (which supports IndexedDB fine),
 * matching how every other shared feature in this codebase avoids a desktop-only branch unless
 * the underlying capability genuinely doesn't exist in a browser (torrent/mpv playback does;
 * storing a JSON blob and some images does not).
 */

const databaseName = "arcadia-offline";
const databaseVersion = 2;
const titlesStore = "titles";
const imagesStore = "images";
const streamsStore = "streams";

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
      if (!db.objectStoreNames.contains(streamsStore)) db.createObjectStore(streamsStore);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => {
      // SAFETY: same as runRequest above — set whenever the "error" event fires.
      reject(request.error as DOMException);
    });
  });
  return databasePromise;
}

/** A parsed JSON value — a title detail payload (and everything IndexedDB gives back for one) is
 *  always one of these, which is exactly the shape both walks below need. Mirrors the same-named
 *  local type in `lib/api.ts`'s `rewriteMediaUrls`. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isJsonRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyPathValue(key: string, value: JsonValue): value is string {
  return key.endsWith("Path") && typeof value === "string" && value.length > 0;
}

/** Every `*Path` field in a title detail payload, deduplicated — the same walk
 *  `rewriteMediaUrls` (`lib/api.ts`) does, but collecting URLs instead of rewriting them. By the
 *  time a detail payload reaches here it has already passed through that rewrite, so every URL
 *  collected is absolute and fetchable on its own. */
function imageUrlsOf(detail: TitleDetail): string[] {
  const urls = new Set<string>();
  const walk = (value: JsonValue): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isJsonRecord(value)) return;
    for (const [key, entryValue] of Object.entries(value)) {
      if (isNonEmptyPathValue(key, entryValue)) {
        urls.add(entryValue);
      } else {
        walk(entryValue);
      }
    }
  };
  // SAFETY: a title detail payload is JSON decoded from the API (or from IndexedDB, itself a
  // stored copy of that same payload) — a string/number/boolean/null, or an array/object built
  // from those — so it always fits `JsonValue`.
  walk(detail as JsonValue);
  return [...urls];
}

type OfflinePlaybackTarget = {
  installmentId: string;
  episodeId: string | null;
};

function playbackTargetsOf(detail: TitleDetail): OfflinePlaybackTarget[] {
  return detail.installments.flatMap<OfflinePlaybackTarget>((installment) => {
    if (!installment.isPlayable) return [];
    if (installment.kind !== "season") {
      return [{ installmentId: installment.id, episodeId: null }];
    }
    return (installment.episodes ?? []).map((episode) => ({
      installmentId: installment.id,
      episodeId: episode.id,
    }));
  });
}

function streamKey(installmentId: string, episodeId: string | null | undefined) {
  return `${installmentId}:${episodeId ?? ""}`;
}

async function cachePlaybackTarget(db: IDBDatabase, target: OfflinePlaybackTarget): Promise<void> {
  try {
    const query = target.episodeId ? `?episodeId=${target.episodeId}` : "";
    const streams = await apiFetch<InstallmentStreams>(
      `/api/v1/installments/${target.installmentId}/streams${query}`,
      { signal: AbortSignal.timeout(12_000) },
    );
    // Torrent info hashes remain useful offline from Arcadia's server. Direct/debrid URLs may
    // expire and can carry provider credentials, so they are deliberately never persisted.
    const candidates = streams.candidates.filter(
      (candidate) => candidate.kind === "torrent" && candidate.infoHash,
    );
    if (candidates.length === 0) return;
    await runRequest(
      db
        .transaction(streamsStore, "readwrite")
        .objectStore(streamsStore)
        .put({ ...streams, candidates }, streamKey(target.installmentId, target.episodeId)),
    );
  } catch {
    // Best-effort like artwork: metadata still saves if one episode has no torrent source.
  }
}

async function cachePlaybackTargets(db: IDBDatabase, detail: TitleDetail): Promise<void> {
  const targets = playbackTargetsOf(detail);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < targets.length) {
      const target = targets[nextIndex];
      nextIndex += 1;
      if (target) await cachePlaybackTarget(db, target);
    }
  }
  const workerCount = Math.min(4, targets.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
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
  await Promise.all([
    Promise.all(
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
    ),
    cachePlaybackTargets(db, detail),
  ]);
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
async function hydrateJsonImages(value: JsonValue): Promise<JsonValue> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => hydrateJsonImages(item)));
  }
  if (!isJsonRecord(value)) return value;
  const entries = await Promise.all(
    Object.entries(value).map(async ([key, entryValue]): Promise<[string, JsonValue]> => {
      if (isNonEmptyPathValue(key, entryValue)) {
        const blob = await getOfflineImageBlob(entryValue);
        return [key, blob ? URL.createObjectURL(blob) : entryValue];
      }
      return [key, await hydrateJsonImages(entryValue)];
    }),
  );
  return Object.fromEntries(entries);
}

async function hydrateOfflineImages<T>(value: T): Promise<T> {
  // SAFETY: every call site passes a value read back from IndexedDB, itself a stored copy of a
  // title detail JSON payload — a string/number/boolean/null, or an array/object built from
  // those — so it always fits `JsonValue`.
  const hydrated = await hydrateJsonImages(value as JsonValue);
  // SAFETY: hydrateJsonImages preserves every key and array position, only ever replacing a
  // `*Path` string leaf with a same-typed blob URL string, so the result still fits the same
  // `T` shape `value` had.
  return hydrated as T;
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
  await Promise.all([
    ...imageUrlsOf(detail).map((url) =>
      runRequest(db.transaction(imagesStore, "readwrite").objectStore(imagesStore).delete(url)),
    ),
    ...playbackTargetsOf(detail).map((target) =>
      runRequest(
        db
          .transaction(streamsStore, "readwrite")
          .objectStore(streamsStore)
          .delete(streamKey(target.installmentId, target.episodeId)),
      ),
    ),
  ]);
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

/**
 * Every saved title, hydrated with its cached images — powers the unauthenticated `/offline`
 * library (`features/library/offline-library-page.tsx`), reached from the login form when no
 * family server is reachable at all (so there is no session to read this list from). Sorted by
 * Arabic/English title since the local store keeps no separate "saved at" timestamp.
 */
export async function listOfflineTitles(): Promise<TitleDetail[]> {
  const ids = await listOfflineTitleIds();
  const details = await Promise.all(ids.map((id) => getOfflineTitle(id)));
  return details
    .filter((detail): detail is TitleDetail => detail !== null)
    .toSorted((a, b) =>
      (a.titleAr || a.canonicalTitle).localeCompare(b.titleAr || b.canonicalTitle),
    );
}

export async function getOfflineImageBlob(url: string): Promise<Blob | null> {
  const db = await openDatabase();
  const result = await runRequest<Blob | undefined>(
    db.transaction(imagesStore, "readonly").objectStore(imagesStore).get(url),
  );
  return result ?? null;
}

export async function getOfflineStreams(
  installmentId: string,
  episodeId?: string | null,
): Promise<InstallmentStreams | null> {
  const db = await openDatabase();
  const result = await runRequest<InstallmentStreams | undefined>(
    db
      .transaction(streamsStore, "readonly")
      .objectStore(streamsStore)
      .get(streamKey(installmentId, episodeId)),
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
