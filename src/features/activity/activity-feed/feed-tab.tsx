import {
  BooksIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/features/library/components/tracking-form";
import { kindLabels } from "@/features/library/filtering";
import type { Work, WorkStructure } from "@/features/library/model";
import {
  activityAmount,
  isMovieStatusEvent,
  progressDirection,
  progressSegments,
} from "@/features/library/tracking";
import { removeTrackingEntry } from "@/server/library.functions";
import type { FeedGroup, FeedGrouping, FeedItem } from "../activity-feed-utils";
import { formatNumber, statusBadgeVariant } from "../activity-feed-utils";

export function FeedPanel({
  groups,
  grouping,
  worksById,
  structuresById,
  isPending,
  filtersActive,
}: {
  groups: FeedGroup[];
  grouping: FeedGrouping;
  worksById: Map<string, Work>;
  structuresById: Map<string, WorkStructure>;
  isPending: boolean;
  filtersActive: boolean;
}) {
  if (isPending) return <FeedLoadingState />;
  if (groups.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarBlankIcon />
          </EmptyMedia>
          <EmptyTitle>{filtersActive ? "لا يوجد نشاط ضمن التصفية" : "لا يوجد تتبع بعد"}</EmptyTitle>
          <EmptyDescription>
            {filtersActive
              ? "جرّب توسيع نطاق التاريخ أو اختيار حالة مختلفة."
              : "أضف تقدم اليوم أو سجّل عملاً شاهدته أو قرأته في تاريخ سابق."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-9">
      {groups.map((group) => {
        const updateCount = group.days.reduce((total, day) => total + day.items.length, 0);
        const displayItems =
          grouping === "day"
            ? group.days.flatMap((day) =>
                day.items.map((item) => ({
                  item,
                  combinedCount: 1,
                  combinedAmount: activityAmount(item.entry),
                })),
              )
            : combinePeriodItems(group);
        return (
          <section key={group.key} className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 className="shrink-0 font-heading text-sm font-semibold">{group.label}</h2>
              <Separator />
              <Badge variant="outline">
                {grouping === "day"
                  ? `${formatNumber(updateCount)} تحديثات`
                  : `${formatNumber(displayItems.length)} أعمال · ${formatNumber(updateCount)} تحديثات مدمجة`}
              </Badge>
            </div>

            <div dir="rtl" className="grid min-w-0 gap-3 md:grid-cols-2">
              {displayItems.map(({ item, combinedCount, combinedAmount }) => {
                const work = worksById.get(item.entry.workId);
                return work ? (
                  <TrackingCard
                    key={item.entry.id}
                    item={item}
                    work={work}
                    structure={structuresById.get(work.id)}
                    combinedCount={combinedCount}
                    combinedAmount={combinedAmount}
                  />
                ) : null;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function combinePeriodItems(group: FeedGroup) {
  const byWork = new Map<string, FeedItem[]>();
  for (const day of [...group.days].reverse()) {
    for (const item of day.items) {
      byWork.set(item.entry.workId, [...(byWork.get(item.entry.workId) ?? []), item]);
    }
  }
  return [...byWork.values()].flatMap((items) => {
    const firstItem = items[0];
    const latestItem = items.at(-1);
    if (!firstItem || !latestItem) return [];

    const first = firstItem.entry;
    const latest = latestItem.entry;
    return {
      item: {
        entry: {
          ...latest,
          id: `combined:${group.key}:${latest.workId}`,
          progressBefore: first.progressBefore,
          statusBefore: first.statusBefore,
        },
      },
      combinedCount: items.length,
      combinedAmount: items.reduce((total, { entry }) => total + activityAmount(entry), 0),
    };
  });
}

function FeedLoadingState() {
  return (
    <div className="flex flex-col gap-8">
      {[0, 1].map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((card) => (
              <Skeleton key={card} className="h-40" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TrackingCard({
  item,
  work,
  structure,
  combinedCount,
  combinedAmount,
}: {
  item: FeedItem;
  work: Work;
  structure?: WorkStructure;
  combinedCount: number;
  combinedAmount: number;
}) {
  const entry = item.entry;
  const queryClient = useQueryClient();
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
        queryClient.invalidateQueries({ queryKey: ["tracking-structures"] }),
      ]);
    },
  });
  const title = work.arabicTitle || work.title;
  const direction = progressDirection(entry);
  const segments = progressSegments(structure, entry.progressBefore, entry.progress);
  const movieWatched = isMovieStatusEvent(entry, work);

  return (
    <Card className="group min-w-0 gap-0 overflow-hidden border-border/60 bg-card p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Header */}
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {work.imagePath ? (
            <img
              src={work.imagePath}
              alt=""
              className="h-24 w-16 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-border/50"
            />
          ) : (
            <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-secondary/40 text-muted-foreground shadow-sm ring-1 ring-border/50">
              <BooksIcon className="h-6 w-6" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <CardTitle className="truncate text-lg leading-tight font-semibold">{title}</CardTitle>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-transparent px-2 py-0 text-[10px] font-medium">
                {kindLabels[work.kind]}
              </Badge>

              <Badge
                variant={statusBadgeVariant(entry.status)}
                className="px-2 py-0 text-[10px] font-medium"
              >
                {statusLabel(entry.status)}
              </Badge>
            </div>

            <CardDescription className="mt-2 text-xs">
              {combinedCount > 1
                ? `${formatNumber(combinedCount)} تحديثات مدمجة لهذا العمل.`
                : entry.statusBefore === entry.status
                  ? "استمرّت حالة المتابعة دون تغيير."
                  : `${statusLabel(entry.statusBefore)} ← ${statusLabel(entry.status)}`}
            </CardDescription>
          </div>
        </div>

        {combinedCount === 1 ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground opacity-60 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
            aria-label={`حذف تحديث ${title} بتاريخ ${entry.occurredOn}`}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ data: { entryId: entry.id } })}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>

      {/* Activity */}
      <CardContent className="px-5 pb-3">
        {movieWatched ? (
          <ActivityHeadline
            icon={CheckCircleIcon}
            title="اكتملت مشاهدة الفيلم"
            description="سُجّل الفيلم كمكتمل، ولا يحتاج إلى تتبّع للتقدم."
          />
        ) : direction === "forward" ? (
          <ActivityHeadline
            icon={CheckCircleIcon}
            title={activityTitle(work, combinedAmount)}
            description={`تقدّم من ${formatNumber(entry.progressBefore)} إلى ${formatNumber(entry.progress)}.`}
          />
        ) : direction === "correction" ? (
          <ActivityHeadline
            icon={PencilSimpleIcon}
            title="تم تصحيح التقدّم"
            description={`عُدّل التقدّم من ${formatNumber(entry.progressBefore)} إلى ${formatNumber(entry.progress)}. لا يُحتسب هذا كنشاط مشاهدة أو قراءة.`}
          />
        ) : (
          <ActivityHeadline
            icon={PencilSimpleIcon}
            title="تغيّرت حالة المتابعة"
            description={`بقي التقدّم عند ${formatNumber(entry.progress)}.`}
          />
        )}
      </CardContent>

      {/* Segments */}
      {segments && segments.length > 0 && (
        <CardFooter className="flex flex-col items-stretch gap-2 border-t border-border/40 bg-transparent p-3 pt-2!">
          {segments.map((segment) => (
            <div
              key={`${segment.seasonId ?? "work"}-${segment.firstUnit}`}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-muted/25 px-3 py-2"
            >
              {segment.seasonTitle && (
                <Badge
                  variant="outline"
                  className="bg-transparent text-[10px] text-muted-foreground"
                >
                  {seasonLabel(segment.seasonTitle, segment.seasonNumber)}
                </Badge>
              )}

              <span className="text-sm font-medium">
                {unitSequenceLabel(work, segment.firstUnit, segment.lastUnit)}
              </span>
            </div>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}

function ActivityHeadline({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CheckCircleIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>

      <div className="min-w-0">
        <p className="text-sm leading-none font-semibold">{title}</p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function activityTitle(work: Work, amount: number) {
  const unit = normalizedProgressUnit(work);
  if (unit === "chapter") return `قُرئ ${formatNumber(amount)} فصول`;
  return `شُوهد ${formatNumber(amount)} حلقات`;
}

function unitSequenceLabel(work: Work, first: number, last: number) {
  const unit = normalizedProgressUnit(work) === "chapter" ? "الفصول" : "الحلقات";
  const values =
    last - first <= 5
      ? Array.from({ length: last - first + 1 }, (_, index) => formatNumber(first + index)).join(
          "، ",
        )
      : `${formatNumber(first)}–${formatNumber(last)}`;
  return `${unit} ${values}`;
}

function normalizedProgressUnit(work: Work) {
  return work.progressUnit.trim().toLocaleLowerCase().startsWith("chapter") ? "chapter" : "episode";
}

function seasonLabel(title: string, number: number | null) {
  return number === null
    ? title
    : `الموسم ${new Intl.NumberFormat("ar", {
        maximumFractionDigits: 1,
      }).format(number)}`;
}
