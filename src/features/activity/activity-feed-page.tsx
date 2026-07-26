import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CalendarBlankIcon,
  ClockCounterClockwiseIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import {
  TrackingForm,
  statusLabel,
} from "@/features/library/components/tracking-form"
import { kindLabels } from "@/features/library/filtering"
import type { TrackingEntry, Work } from "@/features/library/model"
import { progressUnitLabelAr } from "@/features/library/translations"
import {
  getTrackingPage,
  getWorkStructure,
  getWorks,
  removeTrackingEntry,
} from "@/server/library.functions"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

export function ActivityFeedPage() {
  const { data: works } = useSuspenseQuery({
    queryKey: ["works"],
    queryFn: () => getWorks(),
  })
  const [workId, setWorkId] = useState("all")
  const [status, setStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
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
  const groups = useMemo(() => groupEntries(entries), [entries])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link to="/" />}
            >
              <span className="sr-only">العودة إلى المكتبة</span>
              <ArrowLeftIcon />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">سجل المتابعة</p>
              <h1 className="text-sm font-semibold">النشاط</h1>
            </div>
          </div>
          <Button size="sm" onClick={() => setEntryOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            إضافة تقدم
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>سجل التقدم</CardTitle>
            <CardDescription>
              كل إدخال لقطة مؤرخة للتقدم. يمكنك إضافة نقاط أقدم لاحقاً دون
              استبدال التقدم الأحدث.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-3 sm:grid sm:grid-cols-4">
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
                      {(
                        [
                          "planned",
                          "in-progress",
                          "completed",
                          "paused",
                          "dropped",
                        ] as const
                      ).map((value) => (
                        <SelectItem key={value} value={value}>
                          {statusLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-from">من</FieldLabel>
                <Input
                  id="feed-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="feed-to">إلى</FieldLabel>
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
        {!query.isPending && groups.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarBlankIcon />
              </EmptyMedia>
              <EmptyTitle>لا يوجد تتبع بعد</EmptyTitle>
              <EmptyDescription>
                أضف تقدم اليوم أو سجل بتاريخ سابق عملاً شاهدته أو قرأته.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(([date, dayEntries]) => (
              <section key={date} className="grid gap-3">
                <header>
                  <time
                    className="sticky top-20 text-sm font-semibold"
                    dateTime={date}
                  >
                    {formatDate(date)}
                  </time>
                </header>
                <div className="grid gap-2 md:grid-cols-2">
                  {dayEntries.map((entry) => {
                    const work = worksById.get(entry.workId)
                    if (!work) return null
                    return (
                      <TrackingCard key={entry.id} entry={entry} work={work} />
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {query.hasNextPage ? (
          <Button
            variant="outline"
            className="self-center"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            <ClockCounterClockwiseIcon data-icon="inline-start" />
            {query.isFetchingNextPage ? "جارٍ التحميل…" : "تحميل الأقدم"}
          </Button>
        ) : null}
      </main>

      <AddTrackingDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        works={works}
      />
    </div>
  )
}

function TrackingCard({ entry, work }: { entry: TrackingEntry; work: Work }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: removeTrackingEntry,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tracking-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["works"] }),
        queryClient.invalidateQueries({ queryKey: ["work-tracking", work.id] }),
        queryClient.invalidateQueries({
          queryKey: ["work-structure", work.id],
        }),
      ])
    },
  })
  return (
    <Card className="p-2">
      <CardContent className="flex items-center gap-4 p-2">
        {work.imagePath ? (
          <img
            src={work.imagePath}
            alt=""
            className="h-auto w-16 rounded-md object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1 gap-2">
          <div className="border-px mb-2 flex flex-wrap items-center gap-0">
            <Badge variant="outline" className="rounded-r-none">
              {kindLabels[work.kind]}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-l-none",
                entry.status === "in-progress" &&
                  "bg-blue-400/15 text-blue-400",
                entry.status === "completed" &&
                  "bg-green-400/15 text-green-400",
                entry.status === "dropped" && "bg-red-400/15 text-red-400/50",
                entry.status === "paused" && "bg-gray-400/15 text-gray-400",
                entry.status === "planned" && "bg-yellow-400/15 text-yellow-400"
              )}
            >
              {statusLabel(entry.status)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate text-sm">
              {work.arabicTitle || work.title}
            </strong>
          </div>
          <div className="group relative flex flex-col gap-2">
            <p
              className={cn(
                "mt-1 text-sm text-muted-foreground",
                work.progressTotal && "opacity-0 group-hover:opacity-100!"
              )}
            >
              التقدم {entry.progress}
              {work.progressTotal ? ` من ${work.progressTotal}` : ""}{" "}
              {progressUnitLabelAr(work.progressUnit)}
            </p>
            {work.progressTotal && (
              <>
                <Progress
                  value={(entry.progress / work.progressTotal) * 100}
                  className={"absolute bottom-0 w-full group-hover:opacity-0"}
                />
              </>
            )}
          </div>
        </div>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label={`حذف نقطة تقدم ${work.arabicTitle || work.title} بتاريخ ${entry.occurredOn}`}
          disabled={mutation.isPending}
          className={"bg-transparent! hover:bg-destructive/10!"}
          onClick={() => mutation.mutate({ data: { entryId: entry.id } })}
        >
          <TrashIcon />
        </Button>
      </CardContent>
    </Card>
  )
}

function AddTrackingDialog({
  open,
  onOpenChange,
  works,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  works: Work[]
}) {
  const [workId, setWorkId] = useState(works[0]?.id ?? "")
  const work = works.find((item) => item.id === workId)
  const structure = useQuery({
    queryKey: ["work-structure", workId],
    queryFn: () => getWorkStructure({ data: { workId } }),
    enabled: open && Boolean(workId),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>إضافة تقدم</DialogTitle>
          <DialogDescription>
            اختر العمل ومقدار التقدم والحالة وتاريخ حدوثه.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="tracking-work">العمل</FieldLabel>
          <Select
            value={workId}
            onValueChange={(value) => value && setWorkId(value)}
          >
            <SelectTrigger id="tracking-work" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {works.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.arabicTitle || item.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {work ? (
          <TrackingForm
            key={work.id}
            work={work}
            structure={structure.data}
            compact
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function groupEntries(entries: TrackingEntry[]) {
  const groups = new Map<string, TrackingEntry[]>()
  for (const entry of entries)
    groups.set(entry.occurredOn, [
      ...(groups.get(entry.occurredOn) ?? []),
      entry,
    ])
  return [...groups.entries()]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}
