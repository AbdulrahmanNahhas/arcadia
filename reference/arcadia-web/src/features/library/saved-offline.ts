import { updateTitleState } from "@/features/social/api";
import { getTitle } from "@/lib/api";
import { removeTitleOffline, saveTitleOffline } from "./offline-store";

/** Injection point for tests — a faithful in-memory implementation replaces these instead of
 *  mocking the `@/lib/api`/`./offline-store`/`@/features/social/api` modules. */
type SavedOfflineDependencies = {
  getTitle: typeof getTitle;
  removeTitleOffline: typeof removeTitleOffline;
  saveTitleOffline: typeof saveTitleOffline;
  updateTitleState: typeof updateTitleState;
};

const productionDependencies: SavedOfflineDependencies = {
  getTitle,
  removeTitleOffline,
  saveTitleOffline,
  updateTitleState,
};

export async function syncTitleOfflineCache(
  titleId: string,
  savedOffline: boolean,
  dependencies: SavedOfflineDependencies = productionDependencies,
) {
  if (!savedOffline) {
    await dependencies.removeTitleOffline(titleId);
    return;
  }

  const detail = await dependencies.getTitle(titleId);
  if (detail) await dependencies.saveTitleOffline(detail);
}

export async function setTitleSavedOffline(
  titleId: string,
  savedOffline: boolean,
  dependencies: SavedOfflineDependencies = productionDependencies,
) {
  await syncTitleOfflineCache(titleId, savedOffline, dependencies);
  return dependencies.updateTitleState(titleId, { savedOffline });
}
