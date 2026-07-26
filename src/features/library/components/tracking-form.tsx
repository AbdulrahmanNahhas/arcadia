import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CalendarBlankIcon,
  CheckIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { personalStatuses } from "@/features/library/model"
import type { Work, WorkStructure } from "@/features/library/model"
import { statusLabelsAr } from "@/features/library/translations"
import { recordTracking } from "@/server/library.functions"

export function TrackingForm({
  work,
  structure,
  onSaved,
  compact = false,
}: {
  work: Work
  structure?: WorkStructure
  onSaved?: () => void | Promise<void>
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  const total = structure?.totalUnits || work.progressTotal
  const [progress, setProgress] = useState(Math.trunc(work.progress))
  const [status, setStatus] = useState<Work["status"]>(work.status)
  const [occurredOn, setOccurredOn] = useState(today())
  const numericProgress = Math.max(0, Math.trunc(progress || 0))
  const error = useMemo(() => {
    if (!occurredOn) return "اختر تاريخ حدوث هذا التقدم."
    if (total !== null && numericProgress > total) {
      return `لا يمكن أن يتجاوز التقدم ${total}.`
    }
    if (status === "planned" && numericProgress !== 0) {
      return "يجب أن يكون التقدم صفراً للعمل المخطط له."
    }
    if (total && status === "completed" && numericProgress !== total) {
      return `يتطلب الاكتمال وصول التقدم إلى ${total}.`
    }
    if (total && numericProgress === total && status !== "completed") {
      return "تتطلب الوحدة الأخيرة اختيار حالة مكتمل."
    }
    return ""
  }, [numericProgress, occurredOn, status, total])

  useEffect(() => {
    setProgress(Math.trunc(work.progress))
    setStatus(work.status)
  }, [work.id, work.progress, work.status])

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
      ])
      await onSaved?.()
    },
  })

  const chooseProgress = (next: number) => {
    const bounded = Math.max(0, total ? Math.min(next, total) : next)
    setProgress(bounded)
    if (status === "paused" || status === "dropped") return
    if (bounded === 0) setStatus("planned")
    else if (total && bounded === total) setStatus("completed")
    else setStatus("in-progress")
  }

  const unit = singularUnit(work.progressUnit)
  const percentage = total ? Math.round((numericProgress / total) * 100) : 0

  return (
    <form
      className="relative flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (error) return
        mutation.mutate({
          data: {
            workId: work.id,
            progress: numericProgress,
            status,
            occurredOn,
          },
        })
      }}
    >
      {compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">تسجيل التقدم</h3>
              <Badge variant="secondary">{statusLabelsAr[work.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              احفظ نقطة تقدم لأي تاريخ.
            </p>
          </div>
          {total ? (
            <Badge variant="outline">
              {numericProgress} / {total} {work.progressUnit}
            </Badge>
          ) : null}
        </div>
      )}

      {compact && total ? (
        <Progress value={percentage}>
          <ProgressLabel>التقدم الإجمالي</ProgressLabel>
          <ProgressValue />
        </Progress>
      ) : null}

      <FieldGroup
        className={compact ? "gap-4" : "gap-5 sm:grid sm:grid-cols-3"}
      >
        <Field data-invalid={Boolean(error && !error.includes("تاريخ"))}>
          <FieldLabel htmlFor={`tracking-progress-${work.id}`}>
            حتى {unit}
          </FieldLabel>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => chooseProgress(numericProgress - 1)}
              disabled={numericProgress === 0 || mutation.isPending}
              aria-label={`إنقاص تقدم ${unit}`}
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
              disabled={
                Boolean(total && numericProgress >= total) || mutation.isPending
              }
              aria-label={`زيادة تقدم ${unit}`}
            >
              <PlusIcon />
            </Button>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor={`tracking-status-${work.id}`}>الحالة</FieldLabel>
          <Select
            value={status}
            onValueChange={(value) => value && setStatus(value)}
          >
            <SelectTrigger id={`tracking-status-${work.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {personalStatuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabelsAr[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field data-invalid={Boolean(error && error.includes("تاريخ"))}>
          <FieldLabel htmlFor={`tracking-date-${work.id}`}>التاريخ</FieldLabel>
          <Input
            id={`tracking-date-${work.id}`}
            type="date"
            value={occurredOn}
            max={today()}
            aria-invalid={Boolean(error && error.includes("تاريخ"))}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setOccurredOn(today())}
            >
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
      </FieldGroup>

      {error ? (
        <FieldError className="absolute bottom-12">{error}</FieldError>
      ) : null}
      {mutation.error ? (
        <Alert variant="destructive">
          <AlertDescription>{mutation.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={Boolean(error) || mutation.isPending}>
        {mutation.isPending ? (
          "جارٍ الحفظ…"
        ) : (
          <>
            {occurredOn === today() ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CalendarBlankIcon data-icon="inline-start" />
            )}
            حفظ نقطة التقدم
          </>
        )}
      </Button>
    </form>
  )
}

export function statusLabel(status: Work["status"]) {
  return statusLabelsAr[status]
}

export function today() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function singularUnit(value: string) {
  const normalized = value.trim().toLocaleLowerCase()
  const arabicUnits: Record<string, string> = {
    episode: "الحلقة",
    episodes: "الحلقة",
    chapter: "الفصل",
    chapters: "الفصل",
    volume: "المجلد",
    volumes: "المجلد",
    page: "الصفحة",
    pages: "الصفحة",
    route: "المسار",
    routes: "المسار",
  }
  if (arabicUnits[normalized]) return arabicUnits[normalized]
  if (normalized.endsWith("ies")) return `${normalized.slice(0, -3)}y`
  if (normalized.endsWith("s")) return normalized.slice(0, -1)
  return normalized || "الوحدة"
}
