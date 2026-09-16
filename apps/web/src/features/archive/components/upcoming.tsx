import type { ReleaseCalendarItem } from "@arcadia/contracts";
import { BellIcon, CalendarBlankIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { RailScroller } from "@/features/platform/components/rail";
import { cn } from "@/lib/utils";
import { archiveKeys, getCalendar, getFamilyEvents, getNotifications, toggleFollow } from "../api";
import { ReleaseCard } from "./release-card";
import {
  Blank,
  dateTimeFormat,
  Failed,
  monthYearFormat,
  PanelTitle,
  sessionStartedAt,
} from "./shared";

/** `releaseDate`-ordered items grouped into `"YYYY-MM"` buckets, insertion order preserved — the
 *  server already returns rows ordered by date, so a `Map` keeps every group chronological with
 *  no extra sort. */
function groupReleasesByMonth(items: ReleaseCalendarItem[]) {
  const groups = new Map<string, ReleaseCalendarItem[]>();
  for (const item of items) {
    const key = item.releaseDate.slice(0, 7);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries());
}

function upcomingOnly(items: ReleaseCalendarItem[] | undefined) {
  return (items ?? [])
    .filter((item) => new Date(item.releaseDate).getTime() >= sessionStartedAt)
    .toSorted((a, b) => a.releaseDate.localeCompare(b.releaseDate));
}

/** The one card width every calendar entry wraps at, in both the skeleton and the real grid — a
 *  fixed width lets sparse months (most of them: one release, not a full row) take up only the
 *  space they need instead of stretching across empty grid tracks. */
const CALENDAR_CARD_WIDTH = "w-36 xs:w-40 sm:w-44";

function CalendarSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تحميل التقويم" className="flex flex-wrap gap-4">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className={cn("flex flex-col gap-2.5", CALENDAR_CARD_WIDTH)}>
          <Skeleton className="aspect-2/3 w-full rounded-2xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Full "تقويم الإصدارات" tab: every dated release, grouped by month, with a follow toggle per card. */
export function CalendarPanel() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const follow = useMutation({
    mutationFn: toggleFollow,
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.calendar }),
  });
  return (
    <>
      <PanelTitle
        title="تقويم الإصدارات"
        description="كل الأفلام والمواسم المؤرَّخة القادمة، بلا سقف زمني تعسفي — بدءًا من الشهر الماضي."
      />
      {query.isLoading ? (
        <CalendarSkeleton />
      ) : query.isError ? (
        <Failed retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <div className="flex flex-col gap-8">
          {groupReleasesByMonth(query.data).map(([month, items]) => (
            <section key={month}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {monthYearFormat.format(new Date(items[0]?.releaseDate ?? month))}
              </h3>
              {/* `flex-wrap`, not a grid: most months here carry a single release (never a full
               *  row), so a fixed card width lets those months take up only their own width
               *  instead of stretching across grid tracks that stay empty either way. */}
              <div className="flex flex-wrap gap-4">
                {items.map((item) => (
                  <ReleaseCard
                    key={item.installmentId}
                    item={item}
                    pending={follow.isPending}
                    onToggleFollow={() => follow.mutate(item.titleId)}
                    className={CALENDAR_CARD_WIDTH}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Blank icon={<CalendarBlankIcon />} title="لا مواعيد قريبة">
          لا توجد أجزاء مؤرخة ضمن النافذة الحالية.
        </Blank>
      )}
    </>
  );
}

/** Compact "القادم" sidebar card for the Overview tab: the soonest family event, an unread-alerts
 *  shortcut when there is one, then a horizontal strip of the nearest dated releases — each a full
 *  `ReleaseCard` rather than a text row, so it reads as the same kind of card as the rest of the
 *  archive instead of a plain link list. */
export function ComingNextPreview() {
  const calendar = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const events = useQuery({ queryKey: archiveKeys.events, queryFn: getFamilyEvents });
  const notifications = useQuery({
    queryKey: archiveKeys.notifications,
    queryFn: getNotifications,
  });
  if (calendar.isLoading && events.isLoading && notifications.isLoading) {
    return <CalendarSkeleton />;
  }
  if (calendar.isError && events.isError && notifications.isError) {
    return (
      <Failed
        retry={() => {
          void calendar.refetch();
          void events.refetch();
          void notifications.refetch();
        }}
      />
    );
  }
  const upcoming = upcomingOnly(calendar.data).slice(0, 6);
  const nextEvent = (events.data ?? [])
    .filter(
      (item) => item.scheduledFor && new Date(item.scheduledFor).getTime() >= sessionStartedAt,
    )
    .toSorted((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)))
    .at(0);
  const unreadCount = (notifications.data ?? []).filter((item) => item.readAt === null).length;
  if (!upcoming.length && !nextEvent && unreadCount === 0) {
    return (
      <Blank icon={<CalendarBlankIcon />} title="لا مواعيد قريبة">
        تابع عملاً أو خطط لسهرة عائلية لتظهر الخطوة القادمة هنا.
      </Blank>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {nextEvent ? (
        <Link
          to="/archive"
          search={{ tab: "family" }}
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UsersThreeIcon />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm">{nextEvent.name}</strong>
            <span className="block truncate text-xs text-muted-foreground">
              سهرة عائلية ·{" "}
              {dateTimeFormat.format(new Date(nextEvent.scheduledFor ?? sessionStartedAt))}
            </span>
          </span>
        </Link>
      ) : null}
      {unreadCount > 0 ? (
        <Link
          to="/archive"
          search={{ tab: "notifications" }}
          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellIcon />
          </span>
          <span>
            <strong className="block text-sm">{unreadCount} تنبيهات غير مقروءة</strong>
            <span className="text-xs text-muted-foreground">افتح مركز التنبيهات</span>
          </span>
        </Link>
      ) : null}
      {upcoming.length ? (
        <RailScroller className="auto-cols-30 gap-3 px-0.5 pb-1">
          {upcoming.map((item) => (
            <ReleaseCard key={item.installmentId} item={item} />
          ))}
        </RailScroller>
      ) : null}
      {upcoming.length ? (
        <Link
          to="/archive"
          search={{ tab: "calendar" }}
          className="text-xs font-medium text-primary hover:underline"
        >
          فتح التقويم كاملًا
        </Link>
      ) : null}
    </div>
  );
}
