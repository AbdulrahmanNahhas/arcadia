import type { AccountDownload, UpsertDownloadInput } from "@arcadia/contracts";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { isDesktopShell } from "../desktop-player";
import { type DownloadItem, useDownloads } from "./api";

/**
 * Best-effort mirror of this device's registry into the server's `account_downloads` table
 * (`/api/v1/me/downloads`) so other devices and the admin can see what is kept where. Playback
 * never reads it. Every failure is swallowed: an offline server is precisely the situation
 * downloads exist for.
 */

const deviceNameKey = "arcadia:deviceName";
export const defaultDeviceName = "جهاز سطح المكتب";

export function readDeviceName(): string {
  try {
    return window.localStorage.getItem(deviceNameKey) || defaultDeviceName;
  } catch {
    return defaultDeviceName;
  }
}

export function writeDeviceName(name: string) {
  try {
    window.localStorage.setItem(deviceNameKey, name.trim() || defaultDeviceName);
  } catch {
    // Storage disabled: the default name is sent instead.
  }
}

function fingerprint(item: DownloadItem) {
  return `${item.state}|${item.path ?? ""}|${item.sizeBytes}`;
}

/** What was last acknowledged by the server, keyed by registry id. */
const mirrored = new Map<string, { fingerprint: string; serverId: string }>();
let inFlight = false;

async function reconcile(deviceId: string, items: DownloadItem[]) {
  if (inFlight || !deviceId) return;
  inFlight = true;
  try {
    const deviceName = readDeviceName();
    for (const item of items) {
      const current = fingerprint(item);
      if (mirrored.get(item.id)?.fingerprint === current) continue;
      const body: UpsertDownloadInput = {
        installmentId: item.installmentId,
        episodeId: item.episodeId,
        deviceId,
        deviceName,
        path: item.path ?? item.folder,
        sizeBytes: item.sizeBytes,
        state: item.state,
      };
      const saved = await apiFetch<AccountDownload>("/api/v1/me/downloads", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      mirrored.set(item.id, { fingerprint: current, serverId: saved.id });
    }
    const alive = new Set(items.map((item) => item.id));
    for (const [id, entry] of mirrored) {
      if (alive.has(id)) continue;
      await apiFetch<void>(`/api/v1/me/downloads/${entry.serverId}`, { method: "DELETE" });
      mirrored.delete(id);
    }
  } catch {
    // Retried on the next snapshot; nothing here is authoritative.
  } finally {
    inFlight = false;
  }
}

/** Mount once inside the signed-in shell; a no-op outside the desktop app. */
export function useDownloadMirror() {
  const { deviceId, items } = useDownloads();
  useEffect(() => {
    if (!isDesktopShell()) return;
    void reconcile(deviceId, items);
  }, [deviceId, items]);
}
