import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  type Icon,
  StarIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { archiveKeys, getLibrary, getWatchStats } from "./api";
import { ContinueWatchingRow } from "./components/continue-watching";
import { RecommendationsPreview } from "./components/recommendations-preview";
import { ActiveTransferWidget } from "./components/transfer-widget";
import { ComingNextPreview } from "./components/upcoming";

/**
 * A section heading with an optional cross-link to the tab that owns the full list. The overview
 * is a briefing, not a second copy of the archive: anything that needs browsing, filtering, or
 * bulk action lives in its own tab and is reached from here, rather than re-implemented here with
 * a different card design.
 */
function SectionHead({
  title,
  description,
  to,
  linkLabel,
}: {
  title: string;
  description: string;
  to?: "library" | "history" | "calendar" | "family" | "notifications";
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {to && linkLabel ? (
        <Link
          from="/archive"
          to="/archive"
          search={(previous) => ({ ...previous, tab: to })}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowLeftIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

/** One consistent stat tile. The previous overview mixed two different tile treatments inside a
 *  single grid; there is only one here, and every tile carries the same three parts. */
function StatTile({
  label,
  value,
  detail,
  icon: TileIcon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: Icon;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <TileIcon className="size-4 text-primary" />
      </div>
      <strong className="mt-3 block font-mono text-3xl tabular-nums">{value}</strong>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

export function ArchiveOverview() {
  const stats = useQuery({ queryKey: archiveKeys.watchStats, queryFn: getWatchStats }).data;
  const library = useQuery({ queryKey: archiveKeys.library, queryFn: getLibrary }).data ?? [];

  /* Deliberately retrospective. The page header above already reports what is *pending* —
   * unfinished works, replies owed, unread alerts, dated releases — so repeating those numbers
   * here would answer the same question twice on one screen. These four look backwards instead. */
  const tiles = [
    {
      label: "شوهدت هذا الشهر",
      value: stats?.watchedThisMonth ?? 0,
      detail: "حلقات وأفلام مكتملة",
      icon: CheckCircleIcon,
    },
    {
      label: "ساعات المشاهدة",
      value: stats ? Number(stats.totalHoursWatched.toFixed(1)) : 0,
      detail: "إجمالي الوقت المسجَّل",
      icon: ClockIcon,
    },
    {
      label: "قيّمتها بنفسك",
      value: library.filter((item) => item.personalRating !== null).length,
      detail: "تقييمك الخاص، لا التحريري",
      icon: StarIcon,
    },
    {
      label: "في المفضلة",
      value: library.filter((item) => item.isFavorite).length,
      detail: "أعمال وضعت عليها علامة القلب",
      icon: HeartIcon,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-12">
      <section>
        <SectionHead
          title="أكمل المشاهدة"
          description="عد مباشرة إلى الحلقة أو الفيلم من حيث توقفت."
          to="history"
          linkLabel="سجل المشاهدة"
        />
        <ContinueWatchingRow />
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <SectionHead
            title="يحتاج ردّك"
            description="توصيات وصلت إليك من العائلة مع سبب الاختيار."
            to="family"
            linkLabel="كل التوصيات"
          />
          <RecommendationsPreview />
        </section>
        <section>
          <SectionHead
            title="القادم"
            description="أقرب الإصدارات والمواعيد للأعمال التي تتابعها."
            to="calendar"
            linkLabel="التقويم كاملاً"
          />
          <ComingNextPreview />
        </section>
      </div>

      <section>
        <SectionHead
          title="نظرة على مشاهدتك"
          description="ما راكمته حتى الآن — منفصل تماماً عن التقييم التحريري للأرشيف."
          to="library"
          linkLabel="افتح مكتبتي"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              detail={tile.detail}
              icon={tile.icon}
            />
          ))}
        </div>
      </section>

      <ActiveTransferWidget />
    </div>
  );
}
