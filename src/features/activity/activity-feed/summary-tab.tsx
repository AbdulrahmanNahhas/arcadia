import {
  BookOpenTextIcon,
  type CalendarBlankIcon,
  CalendarDotsIcon,
  ChartBarIcon,
  FilmSlateIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { statusLabel } from "@/features/library/components/tracking-form";
import type { Work } from "@/features/library/model";
import { cn } from "@/lib/utils";
import type { ActivityPeriod, FeedGrouping, FeedSummary } from "../activity-feed-utils";
import {
  formatNumber,
  monthBarHeight,
  statusBadgeVariant,
  trackingStatuses,
} from "../activity-feed-utils";

export function SummaryPanel({
  summary,
  worksById,
}: {
  summary: FeedSummary;
  worksById: Map<string, Work>;
}) {
  const [grouping, setGrouping] = useState<FeedGrouping>("week");
  const latestWorkTitles = summary.latestWorkIds
    .map((workId) => worksById.get(workId))
    .filter((work): work is Work => Boolean(work));
  const busiestMonth = summary.months.reduce(
    (busiest, month) => (month.count > busiest.count ? month : busiest),
    summary.months[0],
  );

  if (summary.updateCount === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartBarIcon />
          </EmptyMedia>
          <EmptyTitle>لا توجد بيانات للملخص</EmptyTitle>
          <EmptyDescription>
            سيظهر هنا عدد الحلقات والفصول والأفلام لكل يوم وأسبوع وشهر.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          icon={TelevisionSimpleIcon}
          label="حلقات شوهدت"
          value={summary.media.episodesWatched}
          note="فروق التقدم الموجبة فقط"
        />
        <SummaryMetric
          icon={BookOpenTextIcon}
          label="فصول قُرئت"
          value={summary.media.chaptersRead}
          note="من دون احتساب التصحيحات"
        />
        <SummaryMetric
          icon={FilmSlateIcon}
          label="أفلام شوهدت"
          value={summary.media.moviesWatched}
          note="عند الانتقال إلى مكتمل"
        />
        <SummaryMetric
          icon={CalendarDotsIcon}
          label="أيام نشطة"
          value={summary.activeDayCount}
          note="ضمن السجل المعروض"
        />
      </div>

      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle>دفتر النشاط</CardTitle>
          <CardDescription>
            الأعداد الفعلية في كل فترة؛ لا تُحسب نقطة التقدم الواحدة كحلقة واحدة.
          </CardDescription>
          <CardAction>
            <ToggleGroup
              value={[grouping]}
              multiple={false}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="فترة ملخص النشاط"
              onValueChange={(value) => {
                if (value[0]) setGrouping(value[0] as FeedGrouping);
              }}
            >
              <ToggleGroupItem value="day">يوم</ToggleGroupItem>
              <ToggleGroupItem value="week">أسبوع</ToggleGroupItem>
              <ToggleGroupItem value="month">شهر</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col">
          {summary.periods[grouping].map((period, index) => (
            <div key={period.key}>
              {index > 0 ? <Separator /> : null}
              <PeriodRow period={period} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card size="sm" className="min-w-0">
        <CardHeader>
          <CardTitle>إيقاع سنة {formatNumber(summary.year)}</CardTitle>
          <CardDescription>مجموع الحلقات والفصول والأفلام المسجلة فعلياً في كل شهر.</CardDescription>
          {busiestMonth.count > 0 ? (
            <CardAction>
              <Badge variant="secondary">
                الأعلى: {busiestMonth.label} · {formatNumber(busiestMonth.count)}
              </Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 items-end gap-2 sm:grid-cols-12">
            {summary.months.map((month) => (
              <div key={month.key} className="flex min-w-0 flex-col gap-1.5">
                <span className="text-center text-xs text-muted-foreground tabular-nums">
                  {formatNumber(month.count)}
                </span>
                <div className="flex h-14 items-end rounded-lg bg-muted/50 p-1">
                  <div
                    className={cn(
                      "w-full rounded-md bg-primary/80 transition-all",
                      monthBarHeight(month.count, summary.maxMonthActivityCount),
                    )}
                    title={`${month.label}: ${month.count}`}
                  />
                </div>
                <span className="truncate text-center text-xs text-muted-foreground">
                  {month.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الحالة الأخيرة</CardTitle>
            <CardDescription>أحدث حالة لكل عمل ضمن نطاق التصفية الحالي.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trackingStatuses.map((value) => (
              <Badge key={value} variant={statusBadgeVariant(value)}>
                {statusLabel(value)} {formatNumber(summary.statusCounts[value] ?? 0)}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر ما واصلتَه</CardTitle>
            <CardDescription>أحدث الأعمال في السجل الحالي، مرتبة زمنياً.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {latestWorkTitles.map((work) => (
              <Badge key={work.id} variant="outline">
                {work.arabicTitle || work.title}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PeriodRow({ period }: { period: ActivityPeriod }) {
  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold">{period.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatNumber(period.total)} وحدات نشاط
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {period.episodes > 0 ? (
          <Badge variant="secondary">{formatNumber(period.episodes)} حلقات</Badge>
        ) : null}
        {period.chapters > 0 ? (
          <Badge variant="secondary">{formatNumber(period.chapters)} فصول</Badge>
        ) : null}
        {period.movies > 0 ? (
          <Badge variant="secondary">{formatNumber(period.movies)} أفلام</Badge>
        ) : null}
      </div>
    </div>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof CalendarBlankIcon;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <CardAction>
          <Icon className="text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-3xl font-semibold tabular-nums">{formatNumber(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
