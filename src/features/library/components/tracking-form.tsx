import {
  CalendarBlankIcon,
  CheckIcon,
  CircleNotchIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Work, WorkStructure } from "@/features/library/model";
import { personalStatuses } from "@/features/library/model";
import {
  isDiscreteProgressWork,
  progressSegments,
  seasonCapacity,
} from "@/features/library/tracking";
import { statusLabelsAr } from "@/features/library/translations";
import { getTrackingBaseline, recordTracking } from "@/server/library.functions";

export function TrackingForm({
  work,
  structure,
  onSaved,
  compact = false,
}: {
  work: Work;
  structure?: WorkStructure;
  onSaved?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const statusOnly = !isDiscreteProgressWork(work);
  const total = statusOnly ? null : ((structure?.totalUnits || work.progressTotal) ?? null);
  const [progress, setProgress] = useState(statusOnly ? 0 : Math.trunc(work.progress));
  const [status, setStatus] = useState<Work["status"]>(work.status);
  const [occurredOn, setOccurredOn] = useState(today());
  const baselineQuery = useQuery({
    queryKey: ["tracking-baseline", work.id, occurredOn],
    queryFn: () => getTrackingBaseline({ data: { workId: work.id, occurredOn } }),
    enabled: Boolean(occurredOn),
  });
  const baselineProgress = statusOnly
    ? 0
    : (baselineQuery.data?.progress ?? Math.trunc(work.progress));
  const numericProgress = statusOnly ? 0 : Math.max(0, Math.trunc(progress || 0));
  const error = useMemo(() => {
    if (!occurredOn) return "اختر تاريخ حدوث هذا التقدم.";
    if (total !== null && numericProgress > total) {
      return `لا يمكن أن يتجاوز التقدم ${total}.`;
    }
    if (["saved", "planned"].includes(status) && numericProgress !== 0) {
      return "يجب أن يكون التقدم صفراً للعمل المحفوظ أو المخطّط له.";
    }
    if (total !== null && total > 0 && status === "completed" && numericProgress !== total) {
      return `يتطلب الاكتمال وصول التقدم إلى ${total}.`;
    }
    if (total !== null && total > 0 && numericProgress === total && status !== "completed") {
      return "تتطلب الوحدة الأخيرة اختيار حالة مكتمل.";
    }
    return "";
  }, [numericProgress, occurredOn, status, total]);

  useEffect(() => {
    setProgress(statusOnly ? 0 : Math.trunc(work.progress));
    setStatus(work.status);
    setOccurredOn(today());
  }, [statusOnly, work.progress, work.status]);

  useEffect(() => {
    if (!baselineQuery.data) return;
    setProgress(statusOnly ? 0 : baselineQuery.data.progress);
    setStatus(baselineQuery.data.status);
  }, [baselineQuery.data, statusOnly]);

  const mutation = useMutation({
    mutationFn: recordTracking,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["works"] }),
        queryClient.invalidateQueries({ queryKey: ["tracking-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["work-tracking", work.id] }),
        queryClient.invalidateQueries({
          queryKey: ["work-structure", work.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["tracking-structures"] }),
        queryClient.invalidateQueries({
          queryKey: ["tracking-baseline", work.id],
        }),
      ]);
      await onSaved?.();
    },
  });

  const chooseProgress = (next: number) => {
    const bounded = Math.max(0, total !== null ? Math.min(next, total) : next);
    setProgress(bounded);
    if (status === "paused" || status === "dropped") return;
    if (bounded === 0) setStatus("planned");
    else if (total !== null && total > 0 && bounded === total) setStatus("completed");
    else setStatus("in-progress");
  };

  const percentage = total !== null && total > 0 ? Math.round((numericProgress / total) * 100) : 0;
  const segments = progressSegments(structure, baselineProgress, numericProgress);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (error) return;
        mutation.mutate({
          data: {
            workId: work.id,
            progress: numericProgress,
            status,
            occurredOn,
          },
        });
      }}
    >
      {compact ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">تسجيل التقدم</h3>
              <Badge variant="secondary">{statusLabelsAr[work.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              اختر موضع النهاية، وسنحفظ كل ما بينه وبين الموضع السابق.
            </p>
          </div>
          {!statusOnly && total !== null ? (
            <Badge variant="outline">
              {formatNumber(numericProgress)} / {formatNumber(total)}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {!statusOnly && total !== null && total > 0 ? (
        <Progress value={percentage}>
          <ProgressLabel>التقدم الإجمالي</ProgressLabel>
          <ProgressValue />
        </Progress>
      ) : null}

      <FieldGroup className={compact ? "gap-4" : "gap-5 sm:grid sm:grid-cols-2"}>
        {!statusOnly ? (
          <Field data-invalid={Boolean(error && !error.includes("تاريخ"))}>
            <FieldLabel htmlFor={`tracking-progress-${work.id}`}>موضع النهاية الإجمالي</FieldLabel>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => chooseProgress(numericProgress - 1)}
                disabled={numericProgress === 0 || mutation.isPending}
                aria-label="إنقاص موضع التقدم"
              >
                <MinusIcon />
              </Button>
              <Input
                id={`tracking-progress-${work.id}`}
                type="number"
                min={0}
                max={total ?? undefined}
                step={1}
                value={progress}
                aria-invalid={Boolean(error && !error.includes("تاريخ"))}
                onChange={(event) => chooseProgress(Number(event.target.value))}
                className="text-center font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => chooseProgress(numericProgress + 1)}
                disabled={Boolean(total !== null && numericProgress >= total) || mutation.isPending}
                aria-label="زيادة موضع التقدم"
              >
                <PlusIcon />
              </Button>
            </div>
            <FieldDescription>
              الموضع السابق في هذا التاريخ:{" "}
              {baselineQuery.isPending ? "جارٍ التحميل…" : formatNumber(baselineProgress)}
            </FieldDescription>
          </Field>
        ) : null}

        <Field data-invalid={Boolean(error?.includes("تاريخ"))}>
          <FieldLabel htmlFor={`tracking-date-${work.id}`}>التاريخ</FieldLabel>
          <Input
            id={`tracking-date-${work.id}`}
            type="date"
            value={occurredOn}
            max={today()}
            aria-invalid={Boolean(error?.includes("تاريخ"))}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={() => setOccurredOn(today())}>
              اليوم
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setOccurredOn(daysAgo(1))}
            >
              أمس
            </Button>
          </div>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>حالة المتابعة بعد الحفظ</FieldLabel>
          <ToggleGroup
            value={[status]}
            multiple={false}
            variant="outline"
            size="sm"
            className="w-full flex-wrap"
            aria-label="حالة المتابعة"
            onValueChange={(value) => {
              if (value[0]) setStatus(value[0] as Work["status"]);
            }}
          >
            {personalStatuses.map((value) => (
              <ToggleGroupItem key={value} value={value} className="min-w-fit flex-1">
                {statusLabelsAr[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </FieldGroup>

      <TrackingPreview
        work={work}
        structure={structure}
        statusOnly={statusOnly}
        baselineProgress={baselineProgress}
        progress={numericProgress}
        segments={segments}
      />

      {error ? <FieldError>{error}</FieldError> : null}
      {mutation.error ? (
        <Alert variant="destructive">
          <AlertTitle>تعذر حفظ التحديث</AlertTitle>
          <AlertDescription>{mutation.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        disabled={Boolean(error) || mutation.isPending || baselineQuery.isPending}
      >
        {mutation.isPending ? (
          <>
            <CircleNotchIcon data-icon="inline-start" className="animate-spin" />
            جارٍ الحفظ…
          </>
        ) : (
          <>
            {occurredOn === today() ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CalendarBlankIcon data-icon="inline-start" />
            )}
            حفظ التحديث
          </>
        )}
      </Button>
    </form>
  );
}

function TrackingPreview({
  work,
  structure,
  statusOnly,
  baselineProgress,
  progress,
  segments,
}: {
  work: Work;
  structure?: WorkStructure;
  statusOnly: boolean;
  baselineProgress: number;
  progress: number;
  segments: ReturnType<typeof progressSegments>;
}) {
  const correction = progress < baselineProgress;
  const unchanged = progress === baselineProgress;

  return (
    <Alert>
      <AlertTitle>
        {statusOnly
          ? work.kind === "movie"
            ? "تتبع الفيلم بالحالة فقط"
            : "تتبع هذا العمل بالحالة فقط"
          : correction
            ? "سيُحفظ تصحيح للتقدم"
            : unchanged
              ? "لا توجد وحدات جديدة"
              : "الوحدات التي ستُضاف إلى هذا اليوم"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        {statusOnly ? (
          <p>لن تُستخدم مدة التشغيل أو الصفحات كوحدة تقدم.</p>
        ) : correction ? (
          <p>
            سيتغير الموضع من {formatNumber(baselineProgress)} إلى {formatNumber(progress)} من دون
            احتسابه كنشاط مشاهدة أو قراءة.
          </p>
        ) : unchanged ? (
          <p>سيُحفظ تغيير الحالة فقط عند الموضع الحالي.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {segments.map((segment) => (
              <div
                key={`${segment.seasonId ?? "work"}-${segment.firstUnit}`}
                className="flex flex-wrap items-center gap-2"
              >
                {segment.seasonTitle ? (
                  <Badge variant="outline">
                    {seasonLabel(segment.seasonTitle, segment.seasonNumber)}
                  </Badge>
                ) : null}
                <strong className="font-medium text-foreground">
                  {unitSequenceLabel(work, segment.firstUnit, segment.lastUnit)}
                </strong>
              </div>
            ))}
          </div>
        )}

        {!statusOnly && structure?.seasons.length ? (
          <div className="flex flex-wrap gap-2">
            {seasonProgressAt(structure, progress).map((season) => (
              <Badge
                key={season.id}
                variant={
                  season.total > 0 && season.progress === season.total ? "default" : "secondary"
                }
              >
                {season.label}: {formatNumber(season.progress)}/{formatNumber(season.total)}
              </Badge>
            ))}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function seasonProgressAt(structure: WorkStructure, progress: number) {
  let offset = 0;
  return structure.seasons.map((season) => {
    const total = seasonCapacity(season);
    const completed = Math.min(Math.max(progress - offset, 0), total);
    offset += total;
    return {
      id: season.id,
      label: seasonLabel(season.title, season.seasonNumber),
      progress: completed,
      total,
    };
  });
}

function unitSequenceLabel(work: Work, first: number, last: number) {
  const isChapter = work.progressUnit.trim().toLocaleLowerCase().startsWith("chapter");
  const unit = isChapter ? "الفصول" : "الحلقات";
  const values =
    last - first <= 5
      ? Array.from({ length: last - first + 1 }, (_, index) => formatNumber(first + index)).join(
          "، ",
        )
      : `${formatNumber(first)}–${formatNumber(last)}`;
  return `${unit} ${values}`;
}

function seasonLabel(title: string, number: number | null) {
  return number === null
    ? title
    : `الموسم ${new Intl.NumberFormat("ar", {
        maximumFractionDigits: 1,
      }).format(number)}`;
}

export function statusLabel(status: Work["status"]) {
  return statusLabelsAr[status];
}

export function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value);
}
