import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { archiveKeys, getContinueWatching } from "@/features/archive/api";
import { PlaybackTile } from "@/features/archive/components/playback-tile";
import { bannerTrackClass, RailHeader, RailScroller, railActionClass } from "./rail";

/**
 * Home page's "أكمل المشاهدة": in-progress titles first, falling back to the followed-title
 * "up next" queue when nothing is in progress.
 *
 * Renders the same `PlaybackTile` My Space uses, in its `rail` variant — landscape banner art, a
 * full-width progress bar, and the "يتبقى ..." reading. A half-watched episode is the same object
 * whether the home page or the archive is showing it, so it gets the same card; only the
 * container differs (a scrolling shelf here, a grid there).
 */
export function ContinueWatchingRail() {
  const query = useQuery({ queryKey: archiveKeys.continueWatching, queryFn: getContinueWatching });
  const inProgress = query.data?.inProgress ?? [];
  const upNext = query.data?.upNext ?? [];
  const items = inProgress.length ? inProgress : upNext;
  if (!items.length) return null;
  return (
    <section className="scroll-mt-24 overflow-hidden" aria-labelledby="continue-watching-title">
      <RailHeader
        id="continue-watching-title"
        title="أكمل المشاهدة"
        description={
          inProgress.length
            ? "عد مباشرة إلى الحلقة أو الفيلم من حيث توقفت."
            : "الحلقة التالية في كل عمل تتابعه."
        }
        action={
          <Link to="/archive" search={{ tab: "history" }} className={railActionClass}>
            سجل المشاهدة
          </Link>
        }
      />
      <RailScroller className={bannerTrackClass}>
        {items.map((item) => (
          <PlaybackTile
            key={`${item.installmentId}:${item.episodeId ?? "movie"}`}
            item={item}
            variant="rail"
          />
        ))}
      </RailScroller>
    </section>
  );
}
