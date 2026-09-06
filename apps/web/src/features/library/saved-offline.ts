import { updateTitleState } from "@/features/social/api";
import { getTitle } from "@/lib/api";
import { removeTitleOffline, saveTitleOffline } from "./offline-store";

export async function syncTitleOfflineCache(titleId: string, savedOffline: boolean) {
  if (!savedOffline) {
    await removeTitleOffline(titleId);
    return;
  }

  const detail = await getTitle(titleId);
  if (detail) await saveTitleOffline(detail);
}

export async function setTitleSavedOffline(titleId: string, savedOffline: boolean) {
  await syncTitleOfflineCache(titleId, savedOffline);
  return updateTitleState(titleId, { savedOffline });
}
