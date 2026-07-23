import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowsInIcon,
  ArrowsOutIcon,
  ArrowSquareOutIcon,
  CaretDownIcon,
  HeartIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  getWorkStructure,
  getWorkTrackingEntries,
} from "@/server/library.functions"
import { kindLabels } from "../filtering"
import type { Work, WorkStructure } from "../model"
import { progressText, WorkArtwork } from "./work-artwork"
import { TrackingForm, statusLabel } from "./tracking-form"

export function WorkDetailDialog({
  work,
  open,
  onOpenChange,
  toggleFavorite,
  favoritePending,
  openRelated,
}: {
  work: Work | null
  open: boolean
  onOpenChange: (open: boolean) => void
  toggleFavorite: (work: Work) => void
  favoritePending: boolean
  openRelated: (id: string) => void
}) {
  const [fullScreen, setFullScreen] = useState(false)
  const structureQuery = useQuery({
    queryKey: ["work-structure", work?.id],
    queryFn: () => getWorkStructure({ data: { workId: work!.id } }),
    enabled: open && Boolean(work),
  })
  const activityQuery = useQuery({
    queryKey: ["work-tracking", work?.id],
    queryFn: () =>
      getWorkTrackingEntries({ data: { workId: work!.id, limit: 12 } }),
    enabled: open && Boolean(work),
  })

  useEffect(() => {
    if (!open) {
      setFullScreen(false)
    }
  }, [open])

  if (!work) return null

  const structure = structureQuery.data
  const releaseSpan =
    work.releaseStart &&
    work.releaseEnd &&
    work.releaseStart !== work.releaseEnd
      ? `${formatDateString(work.releaseStart)} — ${formatDateString(work.releaseEnd)}`
      : formatDateString(work.releaseStart ?? work.releaseEnd)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "grid h-[94dvh] max-h-245 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-6xl",
          fullScreen &&
            "full-screen h-screen max-h-screen w-screen rounded-none sm:max-w-none"
        )}
      >
        <DialogTitle className="sr-only">{work.title}</DialogTitle>
        <header className="flex h-12 items-center justify-between border-b bg-background/95 px-4">
          <p className="truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            Archive record · {work.id}
            {work.curation ? ` · ${work.curation.status}` : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setFullScreen((value) => !value)}
              aria-label={fullScreen ? "Exit full screen" : "Open full screen"}
            >
              {fullScreen ? <ArrowsInIcon /> : <ArrowsOutIcon />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close details"
            >
              <XIcon />
            </Button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <section className="relative overflow-hidden border-b bg-muted/20 px-5 py-7 sm:px-8">
            {work.bannerPath && (
              <div className="absolute inset-0 opacity-[0.08]">
                <img
                  className="size-full object-cover blur-sm"
                  src={work.bannerPath}
                  alt=""
                />
              </div>
            )}
            <div className="relative mx-auto grid max-w-5xl gap-6 sm:grid-cols-[160px_1fr]">
              <WorkArtwork work={work} className="w-36 shadow-xl sm:w-full" />
              <div className="flex min-w-0 flex-col justify-center">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge>{kindLabels[work.kind]}</Badge>
                  <Badge variant="outline">{work.year ?? "Unreleased"}</Badge>
                  <Badge variant="secondary" className="capitalize">
                    {work.releaseStatus}
                  </Badge>
                </div>
                {work.logoPath ? (
                  <img
                    className="mb-3 max-h-16 max-w-xs object-contain object-left dark:brightness-110"
                    src={work.logoPath}
                    alt={work.title}
                  />
                ) : (
                  <h1 className="text-3xl leading-none font-semibold tracking-tight sm:text-4xl">
                    {work.title}
                  </h1>
                )}
                {work.subtitle && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {work.subtitle}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={work.favorite ? "default" : "outline"}
                    disabled={favoritePending}
                    onClick={() => toggleFavorite(work)}
                  >
                    <HeartIcon weight={work.favorite ? "fill" : "regular"} />
                    {work.favorite ? "Favorite" : "Add to favorites"}
                  </Button>
                  <Badge variant="secondary">{statusLabel(work.status)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {progressText(work)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto grid max-w-5xl gap-4 p-5 sm:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] sm:p-8">
            <TrackerLedger work={work} structure={structure} />

            <Panel title="Catalog facts">
              <dl>
                <Property label="Creators">{work.creator}</Property>
                <Property label="Release">
                  {releaseSpan || work.year || "—"}
                </Property>
                <Property label="Country">
                  {work.country.join(", ") || "—"}
                </Property>
                {work.runtimeMinutes !== null && (
                  <Property label="Runtime">
                    {formatMinutes(work.runtimeMinutes)}
                  </Property>
                )}
                {work.pageCount !== null && (
                  <Property label="Pages">
                    {work.pageCount.toLocaleString()}
                  </Property>
                )}
                {work.episodeCount !== null && (
                  <Property label="Episodes">
                    {work.episodeCount.toLocaleString()}
                  </Property>
                )}
                {work.chapterCount !== null && (
                  <Property label="Chapters">
                    {work.chapterCount.toLocaleString()}
                  </Property>
                )}
                {work.aliases.length > 0 && (
                  <Property label="Also known as">
                    {work.aliases.join(" · ")}
                  </Property>
                )}
              </dl>
            </Panel>

            <Panel title="Primary credits">
              <div className="divide-y">
                {work.credits.map((credit) => (
                  <div
                    key={`${credit.entityId}-${credit.role}`}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span className="font-medium">{credit.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {credit.role.replace("-", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            {work.summary && (
              <Panel title="Synopsis">
                <p dir="auto" className="text-sm leading-6 text-foreground/80">
                  {work.summary}
                </p>
              </Panel>
            )}
            <Panel title="Personal record">
              <dl>
                <Property label="Status">{statusLabel(work.status)}</Property>
                <Property label="Progress">{progressText(work)}</Property>
                <Property label="Tracked">
                  {work.trackedOn ? formatDateString(work.trackedOn) : "Never"}
                </Property>
              </dl>
            </Panel>

            {(work.genres.length > 0 ||
              work.tags.length > 0 ||
              work.tone.length > 0) && (
              <Panel title="Classification">
                <TaxonomyRow label="Genres" items={work.genres} emphasized />
                <TaxonomyRow label="Tone" items={work.tone} />
                <TaxonomyRow label="Themes" items={work.tags} />
              </Panel>
            )}

            {(work.publication || work.sourceMaterial) && (
              <Panel title="Publication & source">
                <dl>
                  {work.publication?.format && (
                    <Property label="Format">
                      {work.publication.format}
                    </Property>
                  )}
                  {work.publication?.publisher && (
                    <Property label="Publisher">
                      {work.publication.publisher}
                    </Property>
                  )}
                  {work.publication?.imprint && (
                    <Property label="Imprint">
                      {work.publication.imprint}
                    </Property>
                  )}
                  {work.publication?.serialization.length ? (
                    <Property label="Serialization">
                      {work.publication.serialization.join(", ")}
                    </Property>
                  ) : null}
                  {work.sourceMaterial && (
                    <Property label="Source">
                      <span className="capitalize">
                        {work.sourceMaterial.type}
                        {work.sourceMaterial.publication
                          ? ` · ${work.sourceMaterial.publication}`
                          : ""}
                      </span>
                    </Property>
                  )}
                </dl>
              </Panel>
            )}

            {(work.contentWarnings ||
              work.analysisNotes ||
              work.riskProfile) && (
              <Panel title="Content dossier">
                {work.contentWarnings && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Content notes
                    </p>
                    <p dir="auto" className="text-sm leading-6">
                      {work.contentWarnings}
                    </p>
                  </div>
                )}
                {work.analysisNotes && (
                  <div className="mt-4 border-l-2 border-amber-500/70 pl-3">
                    <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Curator analysis
                    </p>
                    <p
                      dir="auto"
                      className="text-sm leading-6 text-muted-foreground"
                    >
                      {work.analysisNotes}
                    </p>
                  </div>
                )}
                {work.riskProfile && (
                  <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2">
                    <Risk
                      label="Sexuality"
                      level={work.riskProfile.sexuality}
                    />
                    <Risk
                      label="Behavioral"
                      level={work.riskProfile.behavioral}
                    />
                    <Risk label="Theology" level={work.riskProfile.theology} />
                    <Risk
                      label="Fan service"
                      level={fanServiceLevel(work.riskProfile.fanService)}
                      value={
                        work.riskProfile.fanService === null
                          ? "Unknown"
                          : `${work.riskProfile.fanService} / 10`
                      }
                    />
                  </div>
                )}
              </Panel>
            )}

            {activityQuery.data && activityQuery.data.length > 0 && (
              <Panel title="Activity ledger">
                <ol className="flex flex-col gap-3">
                  {activityQuery.data.map((event) => (
                    <li
                      key={event.id}
                      className="grid grid-cols-[8px_1fr] gap-3 text-sm"
                    >
                      <span className="mt-1.5 size-2 rounded-full bg-amber-500" />
                      <span>
                        <strong className="block font-medium">
                          Progress checkpoint
                        </strong>
                        <small className="text-muted-foreground">
                          {formatDateString(event.occurredOn)} ·{" "}
                          {event.progress} {work.progressUnit} ·{" "}
                          {statusLabel(event.status)}
                        </small>
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            {work.relations.length > 0 && (
              <Panel title="Related works">
                <div className="flex flex-col gap-2">
                  {work.relations.map((relation) => (
                    <button
                      key={relation.id}
                      type="button"
                      onClick={() => openRelated(relation.workId)}
                      className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span>
                        <strong className="block text-sm">
                          {relation.work.title}
                        </strong>
                        <small className="text-muted-foreground capitalize">
                          {relation.relationType.replace("-", " ")}
                        </small>
                      </span>
                      <ArrowSquareOutIcon className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {work.externalLinks.length > 0 && (
              <Panel title="Canonical links">
                <div className="grid gap-2 sm:grid-cols-1">
                  {work.externalLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {link.label}
                      <ArrowSquareOutIcon className="size-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </Panel>
            )}

            {work.curation && (
              <div className="flex items-center justify-between gap-4 border-t px-1 pt-3 text-[11px] text-muted-foreground sm:col-span-2">
                <span>
                  Curated {formatDateString(work.curation.reviewedAt)}
                </span>
                <span className="capitalize">{work.curation.status}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TrackerLedger({
  work,
  structure,
}: {
  work: Work
  structure?: WorkStructure
}) {
  const total = structure?.totalUnits || work.progressTotal
  const percentage = total
    ? Math.min(100, Math.round((work.progress / total) * 100))
    : 0

  return (
    <section className="rounded-xl border bg-card p-5 pb-0! shadow-xs sm:col-span-2">
      <Collapsible className="flex flex-col gap-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">Track progress</h2>
              <p className="text-sm text-muted-foreground">
                Your current checkpoint for this work.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{statusLabel(work.status)}</Badge>
              <Badge variant="outline">{progressText(work)}</Badge>
            </div>
          </div>

          <Progress value={percentage}>
            <ProgressLabel>Overall progress</ProgressLabel>
            <ProgressValue>{() => `${percentage}%`}</ProgressValue>
          </Progress>

          <CollapsibleTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="group mx-auto w-full rounded-t-md! rounded-b-none! border-b-0 sm:w-fit"
              />
            }
          >
            Update progress
            <CaretDownIcon
              data-icon="inline-end"
              className="transition-transform group-data-[state=open]:rotate-180!"
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-0 flex flex-col gap-5 border-t py-5">
          <TrackingForm work={work} structure={structure} />
          {structure?.seasons.length ? (
            <div className="grid gap-2 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3">
              {structure.seasons.map((season) => {
                const completed = season.units.filter(
                  (unit) => unit.progress
                ).length
                const seasonTotal = season.units.length || season.unitCount || 0
                return (
                  <div
                    key={season.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="truncate text-sm font-medium">
                      {season.title}
                    </span>
                    <Badge
                      variant={
                        seasonTotal > 0 && completed === seasonTotal
                          ? "default"
                          : "outline"
                      }
                    >
                      {completed} / {seasonTotal || "—"}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="mb-4 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[105px_1fr] gap-3 border-b py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function TaxonomyRow({
  label,
  items,
  emphasized = false,
}: {
  label: string
  items: string[]
  emphasized?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge
            key={`${label}-${item}`}
            variant={emphasized ? "default" : "secondary"}
            className="font-normal"
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}

type RiskLevel = "none" | "low" | "medium" | "high" | "unknown"

const riskConfig: Record<
  RiskLevel,
  { label: string; dotColor: string; textColor: string }
> = {
  none: {
    label: "None",
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-600 dark:text-emerald-400",
  },
  low: {
    label: "Low",
    dotColor: "bg-sky-500",
    textColor: "text-sky-600 dark:text-sky-400",
  },
  medium: {
    label: "Medium",
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  high: {
    label: "High",
    dotColor: "bg-rose-500",
    textColor: "text-rose-600 dark:text-rose-400",
  },
  unknown: {
    label: "Unknown",
    dotColor: "bg-slate-400",
    textColor: "text-muted-foreground",
  },
}

function Risk({
  label,
  level,
  value,
}: {
  label: string
  level: RiskLevel
  value?: string
}) {
  const config = riskConfig[level]

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Badge variant="outline" className={config.textColor}>
        <span className={cn("size-1.5 rounded-full", config.dotColor)} />
        {value ?? config.label}
      </Badge>
    </div>
  )
}

function fanServiceLevel(value: number | null): RiskLevel {
  if (value === null) return "unknown"
  if (value === 0) return "none"
  if (value <= 3) return "low"
  if (value <= 6) return "medium"
  return "high"
}

function formatDateString(value: string | null) {
  if (!value) return ""
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date)
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return hours
    ? `${hours}h ${minutes ? `${minutes}m` : ""}`.trim()
    : `${value}m`
}
