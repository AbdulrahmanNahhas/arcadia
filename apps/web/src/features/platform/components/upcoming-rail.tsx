import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { archiveKeys, getCalendar } from "@/features/archive/api";
import { ReleaseCard } from "@/features/archive/components/release-card";
import { sessionStartedAt } from "@/features/archive/components/shared";
import { posterTrackClass, RailHeader, RailScroller, railActionClass } from "./rail";

/**
 * Home page's "الإصدارات القادمة": the nearest dated releases across the whole catalog, not just
 * the ones this account follows — the full tab under My Space (`CalendarPanel`) is where following
 * happens, this is discovery. Posters only, no banners: an announced-but-unreleased installment
 * routinely has no banner or logo asset yet, so the card shape that always has *something* to show
 * is the one every other "coming soon" surface in the app already uses (`ReleaseCard`).
 */
export function UpcomingRail() {
  const query = useQuery({ queryKey: archiveKeys.calendar, queryFn: getCalendar });
  const upcoming = (query.data ?? [])
    .filter((item) => new Date(item.releaseDate).getTime() >= sessionStartedAt)
    .toSorted((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .slice(0, 7);
  if (!upcoming.length) return null;
  return (
    // No `overflow-hidden` here — it clipped the top off every card's hover/focus lift.
    <section className="scroll-mt-24" aria-labelledby="upcoming-rail-title">
      <RailHeader
        id="upcoming-rail-title"
        title="الإصدارات القادمة"
        description="أقرب الأفلام والمواسم المؤرَّخة في الكتالوج بأكمله."
        action={
          <Link to="/archive" search={{ tab: "calendar" }} className={railActionClass}>
            كل القادم
            <ArrowLeftIcon />
          </Link>
        }
      />
      <RailScroller className={posterTrackClass}>
        {upcoming.map((item) => (
          <ReleaseCard key={item.installmentId} item={item} />
        ))}
      </RailScroller>
    </section>
  );
}
