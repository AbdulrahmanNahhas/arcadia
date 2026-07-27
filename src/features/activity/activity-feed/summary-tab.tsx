import {
  BookOpenTextIcon,
  BooksIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  ChartBarIcon,
  CheckCircleIcon,
  FilmSlateIcon,
  TelevisionSimpleIcon,
  TrendUpIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { kindLabels } from "@/features/library/filtering"
import { statusLabel } from "@/features/library/components/tracking-form"
import type { Work } from "@/features/library/model"
import { cn } from "@/lib/utils"
import type { FeedSummary } from "../activity-feed-utils"
import {
  formatNumber,
  monthBarHeight,
  statusBadgeVariant,
  trackingStatuses,
} from "../activity-feed-utils"

export function SummaryPanel({
  summary,
  worksById,
}: {
  summary: FeedSummary
  worksById: Map<string, Work>
}) {
  const latestWorkTitles = summary.latestWorkIds
    .map((workId) => worksById.get(workId))
    .filter((work): work is Work => Boolean(work))
  const activeWorks = summary.activeWorkIds
    .map((workId) => worksById.get(workId))
    .filter((work): work is Work => Boolean(work))
  const kindCounts = activeWorks.reduce(
    (counts, work) => counts.set(work.kind, (counts.get(work.kind) ?? 0) + 1),
    new Map<Work["kind"], number>()
  )
  const kindMix = [...kindCounts.entries()].sort(
    ([, left], [, right]) => right - left
  )
  const busiestMonth = summary.months.reduce(
    (busiest, month) => (month.count > busiest.count ? month : busiest),
    summary.months[0]
  )

  if (summary.entryCount === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartBarIcon />
          </EmptyMedia>
          <EmptyTitle>لا توجد بيانات للملخص</EmptyTitle>
          <EmptyDescription>
            سيظهر هنا إيقاع الشهر والسنة بعد إضافة نشاط إلى السجل.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          icon={CalendarDotsIcon}
          label="هذا الشهر"
          value={summary.monthEntryCount}
          note="نقاط تقدم موثقة"
        />
        <SummaryMetric
          icon={TrendUpIcon}
          label={`سنة ${summary.year}`}
          value={summary.yearEntryCount}
          note="إدخالاً في السجل"
        />
        <SummaryMetric
          icon={BooksIcon}
          label="أعمال في السجل"
          value={summary.uniqueWorkCount}
          note="ضمن السجل المعروض"
        />
        <SummaryMetric
          icon={CheckCircleIcon}
          label="مكتمل"
          value={summary.completedCount}
          note="بحسب آخر حالة"
        />
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>لقطة الوسائط</CardTitle>
          <CardDescription>
            أرقام مباشرة من أحدث تقدم للأعمال الظاهرة، بلا تحويل إلى وقت مشاهدة.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MediaStat
            icon={FilmSlateIcon}
            label="أفلام"
            value={summary.media.movieCount}
            note="أعمال ظاهرة"
          />
          <MediaStat
            icon={TelevisionSimpleIcon}
            label="أنمي"
            value={summary.media.animeCount}
            note="أعمال ظاهرة"
          />
          <MediaStat
            icon={CalendarCheckIcon}
            label="حلقات"
            value={summary.media.episodeProgress}
            note="إجمالي التقدم المسجل"
          />
          <MediaStat
            icon={BookOpenTextIcon}
            label="فصول"
            value={summary.media.chapterProgress}
            note="إجمالي التقدم المسجل"
          />
        </CardContent>
      </Card>

      <Card size="sm" className="min-w-0">
        <CardHeader>
          <CardTitle>إيقاع السنة</CardTitle>
          <CardDescription>
            نظرة مختصرة إلى توزيع نقاط التقدم على أشهر السنة الحالية.
          </CardDescription>
          {busiestMonth.count > 0 ? (
            <CardAction>
              <Badge variant="secondary">
                الأعلى: {busiestMonth.label} ·{" "}
                {formatNumber(busiestMonth.count)}
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
                      monthBarHeight(month.count, summary.maxMonthEntryCount)
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

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>الحالة الأخيرة</CardTitle>
            <CardDescription>
              أحدث حالة لكل عمل ظاهر في السجل الحالي.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trackingStatuses.map((value) => (
              <Badge key={value} variant={statusBadgeVariant(value)}>
                {statusLabel(value)}{" "}
                {formatNumber(summary.statusCounts[value] ?? 0)}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>تنوع السجل</CardTitle>
            <CardDescription>
              توزيع الأعمال الظاهرة حسب صيغتها، بأرقام واضحة.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {kindMix.map(([kind, count]) => (
              <div key={kind} className="flex min-w-0 items-center gap-3">
                <Badge variant="outline" className="shrink-0">
                  {kindLabels[kind]}
                </Badge>
                <Progress
                  value={(count / Math.max(activeWorks.length, 1)) * 100}
                  className="min-w-0 flex-1"
                  aria-label={`${kindLabels[kind]}: ${count}`}
                />
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {formatNumber(count)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر ما واصلتَه</CardTitle>
            <CardDescription>
              أحدث الأعمال في السجل الحالي، مرتبة زمنياً.
            </CardDescription>
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
  )
}

function MediaStat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof CalendarDotsIcon
  label: string
  value: number
  note: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-muted/50 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
        <Icon />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-xl font-semibold tabular-nums">
          {formatNumber(value)}
        </p>
        <p className="truncate text-xs text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof CalendarDotsIcon
  label: string
  value: number
  note: string
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
        <p className="font-heading text-3xl font-semibold tabular-nums">
          {formatNumber(value)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}
