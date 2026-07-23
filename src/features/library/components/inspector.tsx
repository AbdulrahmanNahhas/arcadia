import { ArrowsOutIcon, StarIcon, XIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { kindLabels } from "../filtering"
import type { Work } from "../model"
import { progressText, usesProgress, WorkArtwork } from "./work-artwork"

export function Inspector({
  work,
  close,
  open,
}: {
  work: Work
  close: () => void
  open: () => void
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-card/90 px-4 backdrop-blur">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Inspector
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={open}
                  aria-label="Open full details"
                />
              }
            >
              <ArrowsOutIcon />
            </TooltipTrigger>
            <TooltipContent>Open full details</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={close}
            aria-label="Close inspector"
          >
            <XIcon />
          </Button>
        </div>
      </header>

      <div className="space-y-5 p-4">
        <WorkArtwork
          work={work}
          compact
          className="mx-auto w-full max-w-44 shadow-md"
        />

        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{kindLabels[work.kind]}</Badge>
            <Badge variant="outline">{work.year ?? "Unreleased"}</Badge>
          </div>
          <h2 className="text-lg leading-tight font-semibold tracking-tight">
            {work.title}
          </h2>
          {work.subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">
              {work.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/25 p-3">
          <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
            <StarIcon className="size-4 text-amber-500" weight="fill" />
            {work.rating?.toFixed(1) ?? "—"}
            <small className="text-xs font-normal text-muted-foreground">
              / 10
            </small>
          </span>
          <Button variant="outline" size="sm" onClick={open}>
            Open record
          </Button>
        </div>

        <Separator />

        <dl className="space-y-3 text-xs">
          <Property label="Status">
            <span className="inline-flex items-center gap-1.5 capitalize">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  work.status === "completed" && "bg-emerald-500",
                  work.status === "in-progress" && "bg-blue-500",
                  work.status === "planned" && "bg-slate-400",
                  work.status === "paused" && "bg-amber-500",
                  work.status === "dropped" && "bg-rose-500"
                )}
              />
              {work.status.replace("-", " ")}
            </span>
          </Property>
          {usesProgress(work) && (
            <Property label="Progress">{progressText(work)}</Property>
          )}
          <Property label="Creator">{work.creator || "Unknown"}</Property>
          <Property label="Released">{work.year ?? "Unknown"}</Property>
        </dl>

        {work.summary && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Summary
            </h3>
            <p className="line-clamp-6 text-xs leading-5 text-foreground/80">
              {work.summary}
            </p>
          </section>
        )}

        {work.tags.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {work.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Property({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}
