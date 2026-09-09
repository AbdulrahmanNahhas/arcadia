import { PlayCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { archiveKeys, getContinueWatching } from "../api";
import { PlaybackTile, PlaybackTileSkeleton } from "./playback-tile";
import { Blank, Failed } from "./shared";

/**
 * "أكمل المشاهدة / التالي في المتابعات" — driven by Phase B's `account_playback_states`, and
 * rendered with the same `PlaybackTile` the history grid uses, so a half-watched episode looks
 * identical wherever the app surfaces it.
 */
export function ContinueWatchingRow() {
  const query = useQuery({ queryKey: archiveKeys.continueWatching, queryFn: getContinueWatching });
  if (query.isLoading) return <PlaybackTileSkeleton count={3} />;
  if (query.isError) return <Failed retry={() => void query.refetch()} />;
  const inProgress = query.data?.inProgress ?? [];
  const upNext = query.data?.upNext ?? [];
  if (!inProgress.length && !upNext.length) {
    return (
      <Blank icon={<PlayCircleIcon />} title="لا شيء قيد المتابعة">
        ابدأ مشاهدة عمل، أو تابع أعمالاً من صفحاتها لتظهر هنا بطاقات المتابعة والتالي.
      </Blank>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {inProgress.length ? (
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {inProgress.map((item) => (
            <PlaybackTile key={`${item.installmentId}:${item.episodeId ?? "movie"}`} item={item} />
          ))}
        </div>
      ) : null}
      {upNext.length ? (
        <div>
          <h3 className="mb-4 font-heading text-sm font-semibold text-muted-foreground">
            التالي في المتابعات
          </h3>
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {upNext.map((item) => (
              <PlaybackTile
                key={`${item.installmentId}:${item.episodeId ?? "movie"}`}
                item={item}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
