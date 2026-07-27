import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  ListBulletsIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { statusLabel } from "@/features/library/components/tracking-form"
import type { Work } from "@/features/library/model"
import { getTrackingPage, getWorks } from "@/server/library.functions"
import { AddTrackingDialog } from "./activity-feed/add-tracking-dialog"
import { ActivityCalendarPanel } from "./activity-feed/calendar-tab"
import { FeedPanel } from "./activity-feed/feed-tab"
import { SummaryPanel } from "./activity-feed/summary-tab"
import {
  groupEntries,
  summarizeEntries,
  type FeedGrouping,
} from "./activity-feed-utils"

const trackingStatuses = [
  "planned",
  "in-progress",
  "completed",
  "paused",
  "dropped",
] as const

export function ActivityFeedPage() {
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  })
  const [workId, setWorkId] = useState("all")
  const [status, setStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [grouping, setGrouping] = useState<FeedGrouping>("week")
  const [entryOpen, setEntryOpen] = useState(false)
  const query = useInfiniteQuery({
    queryKey: ["tracking-feed", workId, status, dateFrom, dateTo],
    initialPageParam: undefined as
      { occurredOn: string; daySequence: number; id: string } | undefined,
    queryFn: ({ pageParam }) =>
      getTrackingPage({
        data: {
          limit: 50,
          cursor: pageParam,
          workId: workId === "all" ? undefined : workId,
          statuses: status === "all" ? undefined : [status as Work["status"]],
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const entries = query.data?.pages.flatMap((page) => page.items) ?? []
  const worksById = useMemo(
    () => new Map(works.map((work) => [work.id, work])),
    [works]
  )
  const groups = useMemo(
    () => groupEntries(entries, grouping),
    [entries, grouping]
  )
  const summary = useMemo(
    () => summarizeEntries(entries, worksById),
    [entries, worksById]
  )
  const filtersActive =
    workId !== "all" || status !== "all" || Boolean(dateFrom || dateTo)

  const clearFilters = () => {
    setWorkId("all")
    setStatus("all")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-x-clip bg-background text-foreground"
    >
      <header className="sticky top-1 z-10 mx-auto max-w-6xl rounded-full border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link to="/" />}
            >
              <span className="sr-only">العودة إلى المكتبة</span>
              <ArrowRightIcon />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold tracking-tight">
                النشاط
              </h1>
            </div>
          </div>
          <Button size="sm" onClick={() => setEntryOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            إضافة تقدم
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl min-w-0 flex-col gap-6 overflow-x-clip px-4 py-6 sm:px-6 lg:py-8">
        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader className="border-b">
            <CardTitle>اعرض السجل كما تحتاج</CardTitle>
            <CardDescription>
              اختر عملاً أو حالة أو نطاقاً زمنياً. يؤثر التحديد في السجل والملخص
              والتقويم معاً.
            </CardDescription>
            {filtersActive ? (
              <CardAction>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  مسح التصفية
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="feed-work">العمل</FieldLabel>
                <Select
                  value={workId}
                  onValueChange={(value) => value && setWorkId(value)}
                >
                  <SelectTrigger id="feed-work" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">كل الأعمال</SelectItem>
                      {works.map((work) => (
                        <SelectItem key={work.id} value={work.id}>
                          {work.arabicTitle || work.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-status">الحالة</FieldLabel>
                <Select
                  value={status}
                  onValueChange={(value) => value && setStatus(value)}
                >
                  <SelectTrigger id="feed-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {trackingStatuses.map((value) => (
                        <SelectItem key={value} value={value}>
                          {statusLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-from">من تاريخ</FieldLabel>
                <Input
                  id="feed-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-to">إلى تاريخ</FieldLabel>
                <Input
                  id="feed-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {query.error ? (
          <Alert variant="destructive">
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="feed" className="min-w-0 gap-6">
          <TabsList aria-label="عرض النشاط" className="max-w-full">
            <TabsTrigger value="feed">
              <ListBulletsIcon data-icon="inline-start" />
              السجل
              <Badge variant="secondary" className="ms-1">
                {entries.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="summary">
              <ChartBarIcon data-icon="inline-start" />
              ملخص
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarBlankIcon data-icon="inline-start" />
              التقويم
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="min-w-0">
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">تنظيم السجل</p>
                <p className="text-xs text-muted-foreground">
                  تُجمع تحديثات العمل المتكررة في الفترة نفسها لتظهر نقطة
                  البداية والنهاية بوضوح.
                </p>
              </div>
              <ToggleGroup
                value={[grouping]}
                multiple={false}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="طريقة تنظيم السجل"
                onValueChange={(value) => {
                  if (value[0]) setGrouping(value[0] as FeedGrouping)
                }}
              >
                <ToggleGroupItem value="week">أسبوعي</ToggleGroupItem>
                <ToggleGroupItem value="day">يومي</ToggleGroupItem>
                <ToggleGroupItem value="month">شهري</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <FeedPanel
              groups={groups}
              worksById={worksById}
              isPending={query.isPending}
              filtersActive={filtersActive}
            />
            {query.hasNextPage ? (
              <Button
                variant="outline"
                className="mx-auto mt-6"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                <ClockCounterClockwiseIcon data-icon="inline-start" />
                {query.isFetchingNextPage ? "جارٍ التحميل…" : "تحميل الأقدم"}
              </Button>
            ) : null}
          </TabsContent>

          <TabsContent value="summary" className="min-w-0">
            <SummaryPanel summary={summary} worksById={worksById} />
          </TabsContent>

          <TabsContent value="calendar" className="min-w-0">
            <ActivityCalendarPanel entries={entries} worksById={worksById} />
          </TabsContent>
        </Tabs>
      </main>

      <AddTrackingDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        works={works}
      />
    </div>
  )
}
