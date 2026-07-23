import {
  ChartDonutIcon,
  CheckCircleIcon,
  StarIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { kindLabels } from "../filtering"
import { workKinds } from "../model"
import type { Work } from "../model"

export function Statistics({ works }: { works: Work[] }) {
  const completed = works.filter((work) => work.status === "completed").length
  const rated = works.filter((work) => work.rating !== null)
  const average =
    rated.reduce((sum, work) => sum + (work.rating ?? 0), 0) /
    Math.max(1, rated.length)
  const completion = Math.round((completed / Math.max(1, works.length)) * 100)
  const byKind = workKinds
    .map((kind) => ({
      kind,
      count: works.filter((work) => work.kind === kind).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
  const largestGroup = Math.max(1, ...byKind.map((item) => item.count))

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
      <article className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Completion
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {completion}%
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircleIcon className="size-5" weight="duotone" />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {completed} of {works.length} works completed
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </article>

      <article className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Average rating
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {average.toFixed(1)}
            </p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <StarIcon className="size-5" weight="duotone" />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Across {rated.length} rated works
        </p>
        <div className="mt-5 flex gap-1.5">
          {[2, 4, 6, 8, 10].map((value) => (
            <span
              key={value}
              className={`h-2 flex-1 rounded-full ${average >= value ? "bg-amber-500" : "bg-muted"}`}
            />
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-card p-5 shadow-sm md:col-span-2">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Library composition</h2>
            <p className="text-xs text-muted-foreground">
              Works grouped by format
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <ChartDonutIcon className="size-3.5" /> {byKind.length} formats
          </Badge>
        </div>
        <div className="space-y-3">
          {byKind.map((item) => (
            <div
              key={item.kind}
              className="grid grid-cols-[100px_1fr_32px] items-center gap-3 text-xs"
            >
              <span className="truncate text-muted-foreground">
                {kindLabels[item.kind]}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/75"
                  style={{ width: `${(item.count / largestGroup) * 100}%` }}
                />
              </div>
              <strong className="text-right tabular-nums">{item.count}</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}
