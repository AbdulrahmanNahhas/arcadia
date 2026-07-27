import { useState } from "react"
import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TrackingEntry, Work } from "@/features/library/model"
import { cn } from "@/lib/utils"
import { formatYear } from "@/features/library/components/work-detail-dialog"
import {
  buildCalendarDays,
  calendarActivityClass,
  calendarWeekdays,
  countEntriesByWork,
  countLatestStatus,
  formatDate,
  formatMonthYear,
  formatNumber,
  formatWorkNames,
  groupEntriesByDate,
  shiftMonth,
  summarizeCalendarYear,
} from "../activity-feed-utils"

export function ActivityCalendarPanel({
  entries,
  worksById,
}: {
  entries: TrackingEntry[]
  worksById: Map<string, Work>
}) {
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const suggestedMonth = entries.some((entry) =>
    entry.occurredOn.startsWith(currentMonthKey)
  )
    ? currentMonthKey
    : (entries[0]?.occurredOn.slice(0, 7) ?? currentMonthKey)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const monthKey = selectedMonth ?? suggestedMonth
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const monthEntries = entries.filter((entry) =>
    entry.occurredOn.startsWith(monthKey)
  )
  const entriesByDay = groupEntriesByDate(monthEntries)
  const calendarDays = buildCalendarDays(monthKey)
  const maxDayActivity = Math.max(
    ...[...entriesByDay.values()].map((dayEntries) => dayEntries.length),
    1
  )
  const focusedEntries = selectedDate
    ? (entriesByDay.get(selectedDate) ?? [])
    : monthEntries
  const focusedWorkCounts = countEntriesByWork(focusedEntries)
  const focusedWorks = [...focusedWorkCounts.entries()]
    .map(([workId, count]) => ({ work: worksById.get(workId), count }))
    .filter((item): item is { work: Work; count: number } => Boolean(item.work))
    .sort((left, right) => right.count - left.count)
  const activeYear = Number(monthKey.slice(0, 4))
  const yearMonths = summarizeCalendarYear(entries, activeYear)

  const changeMonth = (offset: number) => {
    setSelectedMonth(shiftMonth(monthKey, offset))
    setSelectedDate(null)
  }

  if (entries.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarBlankIcon />
          </EmptyMedia>
          <EmptyTitle>لا يوجد نشاط لعرضه في التقويم</EmptyTitle>
          <EmptyDescription>
            ستظهر أيام المشاهدة والقراءة هنا بعد إضافة أول نقطة تقدم.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{formatMonthYear(monthKey)}</CardTitle>
          <CardDescription>
            مرّر فوق يوم نشط للتفاصيل، أو اختره لعرض ملخصه.
          </CardDescription>
          <CardAction className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="الشهر السابق"
              onClick={() => changeMonth(-1)}
            >
              <CaretRightIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="الشهر التالي"
              onClick={() => changeMonth(1)}
            >
              <CaretLeftIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-7 gap-1">
            {calendarWeekdays.map((weekday) => (
              <span
                key={weekday}
                className="py-1 text-center text-xs text-muted-foreground"
              >
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:min-h-100">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-10" />
              }

              const dayEntries = entriesByDay.get(day.date) ?? []
              const workCount = new Set(dayEntries.map((entry) => entry.workId))
                .size
              const isSelected = selectedDate === day.date

              if (dayEntries.length === 0) {
                return (
                  <span
                    key={day.date}
                    className="flex aspect-square h-auto items-center justify-center rounded-full text-xs text-muted-foreground"
                  >
                    {formatNumber(day.day)}
                  </span>
                )
              }

              return (
                <Tooltip key={day.date}>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        className={cn(
                          "aspect-square h-auto w-full rounded-full px-0 text-xs tabular-nums",
                          calendarActivityClass(
                            dayEntries.length,
                            maxDayActivity
                          ),
                          isSelected && "ring-2 ring-ring ring-offset-2"
                        )}
                        aria-label={`${formatDate(day.date)}: ${dayEntries.length} نقاط تقدم`}
                        onClick={() => setSelectedDate(day.date)}
                      />
                    }
                  >
                    {formatNumber(day.day)}
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex max-w-56 flex-col gap-1">
                      <strong>{formatDate(day.date)}</strong>
                      <span>
                        {formatNumber(dayEntries.length)} نقاط تقدم ·{" "}
                        {formatNumber(workCount)} أعمال
                      </span>
                      <span className="truncate text-background/75">
                        {formatWorkNames(dayEntries, worksById)}
                      </span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>أقل نشاطاً</span>
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={cn(
                  "size-3 rounded-sm",
                  calendarActivityClass(level, 4)
                )}
              />
            ))}
            <span>أكثر نشاطاً</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              {selectedDate ? formatDate(selectedDate) : "خلاصة الشهر"}
            </CardTitle>
            <CardDescription>
              {selectedDate
                ? "تفاصيل النشاط المسجل في هذا اليوم."
                : `النشاط المسجل خلال ${formatMonthYear(monthKey)}.`}
            </CardDescription>
            {selectedDate ? (
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(null)}
                >
                  الشهر كله
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <CalendarMetric
                label="نقاط التقدم"
                value={focusedEntries.length}
              />
              <CalendarMetric label="الأعمال" value={focusedWorkCounts.size} />
              <CalendarMetric
                label="الأيام النشطة"
                value={
                  selectedDate
                    ? Number(focusedEntries.length > 0)
                    : entriesByDay.size
                }
              />
              <CalendarMetric
                label="الحالات المكتملة"
                value={countLatestStatus(focusedEntries, "completed")}
              />
            </div>
            {focusedWorks.length > 0 ? (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    الأكثر حضوراً
                  </p>
                  {focusedWorks.slice(0, 5).map(({ work, count }) => (
                    <div
                      key={work.id}
                      className="flex min-w-0 items-center justify-between gap-3"
                    >
                      <span className="truncate text-sm">
                        {work.arabicTitle || work.title}
                      </span>
                      <Badge variant="outline">{formatNumber(count)}</Badge>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا يوجد نشاط مسجل في هذا النطاق.
              </p>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>أشهر سنة {formatNumber(activeYear)}</CardTitle>
            <CardDescription>
              اختر شهراً للانتقال إليه، والرقم هو عدد نقاط التقدم.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-1">
            {yearMonths.map((month) => (
              <Button
                key={month.key}
                variant={month.key === monthKey ? "secondary" : "ghost"}
                size="sm"
                className="justify-between"
                onClick={() => {
                  setSelectedMonth(month.key)
                  setSelectedDate(null)
                }}
              >
                {month.label}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatYear(month.count)}
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CalendarMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
        {formatNumber(value)}
      </p>
    </div>
  )
}
