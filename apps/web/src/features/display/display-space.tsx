import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { archiveKeys, getContinueWatching, getLibrary } from "@/features/archive/api";
import { cardItemFromResume, type DisplayCardItem } from "./display-card";
import { DisplayRail } from "./display-rail";
import { DisplayShell } from "./display-shell";

/**
 * Display My Space: what this account is in the middle of, what is next, favorites, and the
 * titles saved for offline — four rails, no stats, no history table.
 */
export function DisplaySpace() {
  const continueWatching = useQuery({
    queryKey: archiveKeys.continueWatching,
    queryFn: getContinueWatching,
    staleTime: 30_000,
  });
  const library = useQuery({
    queryKey: archiveKeys.library,
    queryFn: getLibrary,
    staleTime: 60_000,
  });

  const inProgress = useMemo(
    () => (continueWatching.data?.inProgress ?? []).map(cardItemFromResume),
    [continueWatching.data],
  );
  const upNext = useMemo(
    () => (continueWatching.data?.upNext ?? []).map(cardItemFromResume),
    [continueWatching.data],
  );
  const favorites = useMemo<DisplayCardItem[]>(
    () =>
      (library.data ?? [])
        .filter((entry) => entry.isFavorite)
        .map((entry) => ({
          id: entry.titleId,
          title: entry.title,
          posterPath: entry.posterPath,
          to: { titleId: entry.titleId },
        })),
    [library.data],
  );
  const saved = useMemo<DisplayCardItem[]>(
    () =>
      (library.data ?? [])
        .filter((entry) => entry.savedOffline)
        .map((entry) => ({
          id: entry.titleId,
          title: entry.title,
          posterPath: entry.posterPath,
          to: { titleId: entry.titleId },
        })),
    [library.data],
  );
  const empty =
    !continueWatching.isPending &&
    !library.isPending &&
    inProgress.length + upNext.length + favorites.length + saved.length === 0;

  return (
    <DisplayShell>
      <div className="flex flex-col gap-10 pb-24">
        <h1 className="px-[5vw] font-heading text-4xl font-bold">مساحتي</h1>
        {empty && <p className="px-[5vw] text-xl text-white/60">ابدأ بمشاهدة شيء وسيظهر هنا.</p>}
        <DisplayRail title="متابعة المشاهدة" items={inProgress} variant="banner" />
        <DisplayRail title="التالي" items={upNext} variant="banner" />
        <DisplayRail title="المفضّلة" items={favorites} />
        <DisplayRail title="المحفوظات" items={saved} />
      </div>
    </DisplayShell>
  );
}
