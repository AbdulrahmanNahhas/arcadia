import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BooksIcon, CalendarBlankIcon, TrashIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { kindLabels } from "@/features/library/filtering"
import { statusLabel } from "@/features/library/components/tracking-form"
import type { Work } from "@/features/library/model"
import { progressUnitLabelAr } from "@/features/library/translations"
import { removeTrackingEntry } from "@/server/library.functions"
import type { FeedGroup, FeedItem } from "../activity-feed-utils"
import {
  progressChangeLabel,
  progressWithTotalLabel,
  statusBadgeVariant,
} from "../activity-feed-utils"

export function FeedPanel({
  groups,
  worksById,
  isPending,
  filtersActive,
}: {
  groups: FeedGroup[]
  worksById: Map<string, Work>
  isPending: boolean
  filtersActive: boolean
}) {
  if (isPending) return <FeedLoadingState />
  if (groups.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarBlankIcon />
          </EmptyMedia>
          <EmptyTitle>
            {filtersActive ? "لا يوجد نشاط ضمن التصفية" : "لا يوجد تتبع بعد"}
          </EmptyTitle>
          <EmptyDescription>
            {filtersActive
              ? "جرّب توسيع نطاق التاريخ أو اختيار حالة مختلفة."
              : "أضف تقدم اليوم أو سجّل عملاً شاهدته أو قرأته في تاريخ سابق."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} className="grid min-w-0 gap-3">
          <div className="flex items-center gap-3">
            <time
              className="shrink-0 font-heading text-sm font-semibold"
              dateTime={group.key}
            >
              {group.label}
            </time>
            <Separator />
            <Badge variant="outline">{group.items.length}</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {group.items.map((item) => {
              const work = worksById.get(item.workId)
              return work ? (
                <TrackingCard key={item.workId} item={item} work={work} />
              ) : null
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function FeedLoadingState() {
  return (
    <div className="flex flex-col gap-8">
      {[0, 1].map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((card) => (
              <Skeleton key={card} className="h-32" />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function TrackingCard({ item, work }: { item: FeedItem; work: Work }) {
  const { latestEntry: entry } = item
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
  const title = work.arabicTitle || work.title
  const hasKnownTotal = work.progressTotal !== null && work.progressTotal > 0
  const progressValue = hasKnownTotal
    ? Math.min((entry.progress / work.progressTotal!) * 100, 100)
    : null

  return (
    <Card size="sm" className="min-w-0 transition-shadow hover:shadow-sm">
      <CardContent className="flex items-center gap-4">
        {work.imagePath ? (
          <img
            src={work.imagePath}
            alt=""
            className="h-20 w-14 shrink-0 rounded-lg object-cover ring-1 ring-foreground/10"
          />
        ) : (
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BooksIcon />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{kindLabels[work.kind]}</Badge>
            <Badge variant={statusBadgeVariant(entry.status)}>
              {statusLabel(entry.status)}
            </Badge>
          </div>
          <strong className="block truncate text-sm">{title}</strong>
          {progressValue === null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {progressChangeLabel(item)}{" "}
              {progressUnitLabelAr(work.progressUnit)}
            </p>
          ) : (
            <Progress value={progressValue} className="mt-2 gap-1.5">
              <ProgressLabel className="text-xs text-muted-foreground">
                التقدم
              </ProgressLabel>
              <ProgressValue>
                {() => progressWithTotalLabel(item, work.progressTotal!)}
              </ProgressValue>
            </Progress>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`حذف نقطة تقدم ${title} بتاريخ ${entry.occurredOn}`}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ data: { entryId: entry.id } })}
        >
          <TrashIcon />
        </Button>
      </CardContent>
    </Card>
  )
}
