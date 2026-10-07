import type { Update } from "@tauri-apps/plugin-updater";
import { isDesktopShell } from "../library/desktop-player";

/**
 * The bridge to the Tauri updater plugin (`src-tauri`'s `tauri_plugin_updater`, which checks the
 * `endpoints` configured in `tauri.conf.json` — GitHub Releases' generated `latest.json`, see
 * `.github/workflows/release.yml`). Same guarding convention as `desktop-player.ts`: only ever
 * reached through a dynamic `import()`, behind `isDesktopShell()`, so the browser build never
 * pays for it and never throws trying to load a Tauri-only package.
 */

export type UpdateCheckResult =
  | { status: "unavailable" }
  | { status: "upToDate" }
  | { status: "available"; version: string; currentVersion: string; notes: string | null }
  | { status: "failed"; message: string };

/** Held between `checkForUpdate` and `installUpdateAndRestart` — the plugin's own `Update` object
 *  is what actually knows how to download and install itself; there is nothing to serialize it
 *  into that would survive a round trip through application state. */
let pendingUpdate: Update | null = null;

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isDesktopShell()) return { status: "unavailable" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { status: "upToDate" };
    pendingUpdate = update;
    return {
      status: "available",
      version: update.version,
      currentVersion: update.currentVersion,
      notes: update.body ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذّر التحقق من التحديثات.";
    return { status: "failed", message };
  }
}

/**
 * Downloads and installs the update `checkForUpdate` already found, then restarts into it.
 * `onProgress` reports whole percent points; download size isn't always known up front (a
 * `Started` event without `contentLength`), in which case progress simply never fires and the
 * caller should show an indeterminate state instead of a stuck 0%.
 */
export async function installUpdateAndRestart(onProgress?: (percent: number) => void) {
  const update = pendingUpdate;
  if (!update) throw new Error("لم يُعثر على تحديث جاهز للتثبيت — تحقّق من التحديثات أولاً.");
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0;
    if (event.event === "Progress" && total > 0) {
      downloaded += event.data.chunkLength;
      onProgress?.(Math.min(100, Math.round((downloaded / total) * 100)));
    }
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
