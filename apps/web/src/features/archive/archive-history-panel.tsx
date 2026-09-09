import type { ViewHistoryItem, WatchHistoryItem } from "@arcadia/contracts";
import { ClockCounterClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { archiveKeys, clearHistory, clearWatchHistory, getHistory, getWatchHistory } from "./api";
import { PlaybackTile, PlaybackTileSkeleton } from "./components/playback-tile";
import { Blank, dateFormat, Failed, PanelTitle, timeFormat } from "./components/shared";

/** "اليوم" / "أمس" for the two most recent days, otherwise the full Arabic date. Evaluated per
 *  render against the current clock so a session left open overnight relabels correctly. */
function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000,
  );
  if (diffDays <= 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return dateFormat.format(date);
}

/** Buckets rows into day groups, insertion order preserved — the server already returns them
 *  most-recent-first, so every bucket stays internally sorted with no extra pass. */
function groupByDay(items: WatchHistoryItem[]) {
  const groups = new Map<string, WatchHistoryItem[]>();
  for (const item of items) {
    const key = dayLabel(item.playedAt ?? item.updatedAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries());
}

function DayHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h3 className="font-heading text-sm font-semibold">{label}</h3>
      <Badge variant="outline" className="font-mono tabular-nums">
        {count}
      </Badge>
      <Separator className="flex-1" />
    </div>
  );
}

export function HistoryPanel() {
  const client = useQueryClient();
  const watching = useQuery({ queryKey: archiveKeys.watchHistory, queryFn: getWatchHistory });
  const browsing = useQuery({ queryKey: archiveKeys.history, queryFn: getHistory });
  const clearWatching = useMutation({
    mutationFn: ({
      installmentId,
      episodeId,
    }: {
      installmentId?: string;
      episodeId?: string | null;
    }) => clearWatchHistory(installmentId, episodeId),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.watchHistory }),
  });
  const clearBrowsing = useMutation({
    mutationFn: () => clearHistory(),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.history }),
  });

  return (
    <div className="flex flex-col gap-12">
      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <PanelTitle
            title="سجل المشاهدة"
            description="كل ما شغّلته، مجمّعاً حسب اليوم، مع موضعك الحالي في كل عمل."
          />
          {watching.data?.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearWatching.mutate({})}
              disabled={clearWatching.isPending}
            >
              <TrashIcon data-icon="inline-start" />
              مسح السجل كاملاً
            </Button>
          ) : null}
        </div>
        {watching.isLoading ? (
          <PlaybackTileSkeleton count={4} />
        ) : watching.isError ? (
          <Failed retry={() => void watching.refetch()} />
        ) : watching.data?.length ? (
          <div className="flex flex-col gap-9">
            {groupByDay(watching.data).map(([day, items]) => (
              <div key={day}>
                <DayHeading label={day} count={items.length} />
                <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {items.map((item) => (
                    <PlaybackTile
                      key={`${item.installmentId}:${item.episodeId ?? "movie"}`}
                      item={item}
                      played={item.isPlayed}
                      footnote={timeFormat.format(new Date(item.playedAt ?? item.updatedAt))}
                      removing={clearWatching.isPending}
                      removeLabel={`حذف ${item.episodeLabel ?? item.title} من سجل المشاهدة`}
                      onRemove={() =>
                        clearWatching.mutate({
                          installmentId: item.installmentId,
                          episodeId: item.episodeId,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Blank icon={<ClockCounterClockwiseIcon />} title="لم تبدأ المشاهدة بعد">
            شغّل فيلماً أو حلقة وسيظهر تقدمك هنا تلقائياً.
          </Blank>
        )}
      </section>

      {browsing.data?.length ? (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <PanelTitle
              title="سجل التصفح"
              description="صفحات الأعمال التي فتحتها — منفصل عن سجل المشاهدة أعلاه."
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearBrowsing.mutate()}
              disabled={clearBrowsing.isPending}
              className="text-muted-foreground"
            >
              <TrashIcon data-icon="inline-start" />
              مسح سجل التصفح
            </Button>
          </div>
          <BrowsedList items={browsing.data} />
        </section>
      ) : null}
    </div>
  );
}

/** Deliberately quieter than the watch grid above: small poster chips in a wrapping row. This
 *  list answers "where have I been?", so it stays a reference strip rather than a second grid
 *  competing with the surface that actually resumes playback. */
function BrowsedList({ items }: { items: ViewHistoryItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.title.id}
          to="/titles/$titleId"
          params={{ titleId: item.title.id }}
          className="flex items-center gap-2.5 rounded-full border bg-card py-1 pe-3 ps-1 transition-colors hover:bg-muted/60"
        >
          <span className="size-8 shrink-0 overflow-hidden rounded-full bg-muted">
            {item.title.posterPath ? (
              <img src={item.title.posterPath} alt="" className="size-full object-cover" />
            ) : null}
          </span>
          <span className="max-w-40 truncate text-xs font-medium">{item.title.title}</span>
          {item.visitCount > 1 ? (
            <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
              ×{item.visitCount}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
