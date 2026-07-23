"use client"

import { useMemo, useState } from "react"
import {
  ChartBarIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardTextIcon,
  DatabaseIcon,
  HeartIcon,
  StarIcon,
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
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { kindLabels } from "../filtering"
import { personalStatuses, workKinds } from "../model"
import type { Work } from "../model"

type CountItem = { label: string; count: number; percentage: number }

function percentage(count: number, total: number) {
  return Math.round((count / Math.max(1, total)) * 100)
}

function distribution(values: Array<string | null | undefined>): CountItem[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const total = values.length
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, total),
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label)
    )
}

function taxonomyDistribution(works: Work[], select: (work: Work) => string[]) {
  return distribution(works.flatMap(select))
}

function buildStatistics(works: Work[]) {
  const total = works.length
  const rated = works.filter((work) => work.rating !== null)
  const verified = works.filter(
    (work) => work.curation?.status === "verified"
  ).length
  const completed = works.filter((work) => work.status === "completed").length
  const tracked = works.filter((work) => work.trackedOn !== null).length
  const favorite = works.filter((work) => work.favorite).length
  const averageRating = rated.length
    ? rated.reduce((sum, work) => sum + (work.rating ?? 0), 0) / rated.length
    : 0

  const kinds = workKinds
    .map((kind) => ({
      label: kindLabels[kind],
      count: works.filter((work) => work.kind === kind).length,
      percentage: percentage(
        works.filter((work) => work.kind === kind).length,
        total
      ),
    }))
    .filter(({ count }) => count > 0)
    .sort((left, right) => right.count - left.count)

  const trackingStatuses = personalStatuses
    .map((status) => ({
      label: status.replace("-", " "),
      count: works.filter((work) => work.status === status).length,
      percentage: percentage(
        works.filter((work) => work.status === status).length,
        total
      ),
    }))
    .filter(({ count }) => count > 0)

  const decades = distribution(
    works.map((work) =>
      work.year === null ? "Unknown" : `${Math.floor(work.year / 10) * 10}s`
    )
  ).sort((left, right) => left.label.localeCompare(right.label))

  const risk = {
    sexuality: distribution(
      works.map((work) => work.riskProfile?.sexuality ?? "not assessed")
    ),
    behavioral: distribution(
      works.map((work) => work.riskProfile?.behavioral ?? "not assessed")
    ),
    theology: distribution(
      works.map((work) => work.riskProfile?.theology ?? "not assessed")
    ),
    fanService: distribution(
      works.map((work) => {
        const value = work.riskProfile?.fanService
        if (value === null || value === undefined) return "not assessed"
        if (value === 0) return "none"
        if (value <= 3) return "low (1–3)"
        if (value <= 6) return "medium (4–6)"
        return "high (7–10)"
      })
    ),
  }

  const coverage = [
    ["Release year", works.filter((work) => work.year !== null).length],
    [
      "Release date range",
      works.filter((work) => work.releaseStart || work.releaseEnd).length,
    ],
    ["Poster artwork", works.filter((work) => work.imagePath).length],
    ["Banner artwork", works.filter((work) => work.bannerPath).length],
    ["Logo artwork", works.filter((work) => work.logoPath).length],
    ["Credits", works.filter((work) => work.credits.length > 0).length],
    [
      "External links",
      works.filter((work) => work.externalLinks.length > 0).length,
    ],
    ["Related works", works.filter((work) => work.relations.length > 0).length],
    [
      "Risk assessment",
      works.filter((work) => work.riskProfile !== null).length,
    ],
    [
      "Publication metadata",
      works.filter((work) => work.publication !== null).length,
    ],
    [
      "Source material",
      works.filter((work) => work.sourceMaterial !== null).length,
    ],
    ["Country", works.filter((work) => work.country.length > 0).length],
    ["Audience", works.filter((work) => work.audience.length > 0).length],
  ].map(([label, count]) => ({
    label: label as string,
    count: count as number,
    percentage: percentage(count as number, total),
  }))

  const totals = {
    aliases: works.reduce((sum, work) => sum + work.aliases.length, 0),
    credits: works.reduce((sum, work) => sum + work.credits.length, 0),
    externalLinks: works.reduce(
      (sum, work) => sum + work.externalLinks.length,
      0
    ),
    relations: works.reduce((sum, work) => sum + work.relations.length, 0),
    publicationContents: works.reduce(
      (sum, work) => sum + (work.publication?.contents.length ?? 0),
      0
    ),
    serializationSources: works.reduce(
      (sum, work) =>
        sum +
        (work.publication?.serialization.length ?? 0) +
        (work.sourceMaterial?.serialization.length ?? 0),
      0
    ),
    knownEpisodes: works.reduce(
      (sum, work) => sum + (work.episodeCount ?? 0),
      0
    ),
    knownChapters: works.reduce(
      (sum, work) => sum + (work.chapterCount ?? 0),
      0
    ),
    knownPages: works.reduce((sum, work) => sum + (work.pageCount ?? 0), 0),
    knownRuntimeMinutes: works.reduce(
      (sum, work) => sum + (work.runtimeMinutes ?? 0),
      0
    ),
  }

  return {
    overview: {
      entries: total,
      verified,
      verifiedPercentage: percentage(verified, total),
      completed,
      completionPercentage: percentage(completed, total),
      tracked,
      trackedPercentage: percentage(tracked, total),
      favorites: favorite,
      rated: rated.length,
      averageRating: Number(averageRating.toFixed(2)),
    },
    composition: {
      kinds,
      trackingStatuses,
      releaseStatuses: distribution(works.map((work) => work.releaseStatus)),
      decades,
      audiences: taxonomyDistribution(works, (work) => work.audience),
      countries: taxonomyDistribution(works, (work) => work.country),
      publicationFormats: distribution(
        works.map((work) => work.publication?.format)
      ),
      sourceTypes: distribution(works.map((work) => work.sourceMaterial?.type)),
    },
    taxonomy: {
      tags: taxonomyDistribution(works, (work) => work.tags),
      genres: taxonomyDistribution(works, (work) => work.genres),
      tones: taxonomyDistribution(works, (work) => work.tone),
    },
    credits: {
      roles: distribution(
        works.flatMap((work) => work.credits.map((credit) => credit.role))
      ),
      entityTypes: distribution(
        works.flatMap((work) => work.credits.map((credit) => credit.entityType))
      ),
    },
    risk,
    coverage,
    totals,
  }
}

export function Statistics({ works }: { works: Work[] }) {
  const [copied, setCopied] = useState(false)
  const statistics = useMemo(() => buildStatistics(works), [works])
  const { overview } = statistics

  const copyStatistics = async () => {
    const document = {
      schemaVersion: 1,
      privacy:
        "Aggregate statistics only; titles, IDs, and free-text fields are excluded.",
      statistics,
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(document, null, 2))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-10">
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Catalog telemetry</Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {overview.entries} records
            </span>
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Library atlas
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Aggregate catalog, tracking, taxonomy, risk, and data-quality
            signals. Titles, identifiers, and free-text fields are intentionally
            excluded.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={copyStatistics}>
              {copied ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <ClipboardTextIcon data-icon="inline-start" />
              )}
              {copied ? "Copied JSON" : "Copy statistics JSON"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div
            className="flex h-4 overflow-hidden rounded-full bg-muted"
            aria-label="Catalog composition by format"
          >
            {statistics.composition.kinds.map((item, index) => (
              <span
                key={item.label}
                className="h-full bg-primary"
                style={{
                  width: `${item.percentage}%`,
                  opacity: Math.max(0.28, 1 - index * 0.1),
                }}
                title={`${item.label}: ${item.count} (${item.percentage}%)`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {statistics.composition.kinds.map((item) => (
              <Badge key={item.label} variant="secondary">
                {item.label} · {item.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Verified"
          value={`${overview.verifiedPercentage}%`}
          detail={`${overview.verified} of ${overview.entries} entries`}
          progress={overview.verifiedPercentage}
          icon={<CheckCircleIcon weight="duotone" />}
        />
        <MetricCard
          label="Completed"
          value={`${overview.completionPercentage}%`}
          detail={`${overview.completed} completed`}
          progress={overview.completionPercentage}
          icon={<ChartBarIcon weight="duotone" />}
        />
        <MetricCard
          label="Tracked"
          value={`${overview.trackedPercentage}%`}
          detail={`${overview.tracked} with checkpoints`}
          progress={overview.trackedPercentage}
          icon={<DatabaseIcon weight="duotone" />}
        />
        <MetricCard
          label="Average rating"
          value={overview.averageRating.toFixed(1)}
          detail={`${overview.rated} rated entries`}
          progress={overview.averageRating * 10}
          icon={<StarIcon weight="duotone" />}
        />
        <MetricCard
          label="Favorites"
          value={overview.favorites.toLocaleString()}
          detail={`${percentage(overview.favorites, overview.entries)}% of catalog`}
          progress={percentage(overview.favorites, overview.entries)}
          icon={<HeartIcon weight="duotone" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionCard
          title="Formats"
          description="Entry types across the catalog"
          items={statistics.composition.kinds}
        />
        <DistributionCard
          title="Tracking states"
          description="Current personal progress status"
          items={statistics.composition.trackingStatuses}
        />
        <DistributionCard
          title="Release states"
          description="Canonical publication or broadcast status"
          items={statistics.composition.releaseStatuses}
        />
        <DistributionCard
          title="Release decades"
          description="Entries grouped by known release year"
          items={statistics.composition.decades}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <FrequencyCard
          title="All tags"
          description={`${statistics.taxonomy.tags.length} unique tags`}
          items={statistics.taxonomy.tags}
        />
        <FrequencyCard
          title="All genres"
          description={`${statistics.taxonomy.genres.length} unique genres`}
          items={statistics.taxonomy.genres}
        />
        <FrequencyCard
          title="All tones"
          description={`${statistics.taxonomy.tones.length} unique tones`}
          items={statistics.taxonomy.tones}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CoverageCard items={statistics.coverage} />
        <Card>
          <CardHeader>
            <CardTitle>Normalized record totals</CardTitle>
            <CardDescription>
              Counts across structured, non-text fields
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {Object.entries(statistics.totals).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground capitalize">
                  {label.replace(/([A-Z])/g, " $1")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {value.toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <DistributionCard
          title="Sexuality risk"
          description="Assessment levels"
          items={statistics.risk.sexuality}
          compact
        />
        <DistributionCard
          title="Behavioral risk"
          description="Assessment levels"
          items={statistics.risk.behavioral}
          compact
        />
        <DistributionCard
          title="Theology risk"
          description="Assessment levels"
          items={statistics.risk.theology}
          compact
        />
        <DistributionCard
          title="Fan service"
          description="Score bands"
          items={statistics.risk.fanService}
          compact
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FrequencyCard
          title="Audiences"
          description="Controlled audience labels"
          items={statistics.composition.audiences}
          compact
        />
        <FrequencyCard
          title="Countries"
          description="Catalog origin values"
          items={statistics.composition.countries}
          compact
        />
        <FrequencyCard
          title="Publication formats"
          description="Structured publication formats"
          items={statistics.composition.publicationFormats}
          compact
        />
        <FrequencyCard
          title="Source types"
          description="Source material categories"
          items={statistics.composition.sourceTypes}
          compact
        />
        <FrequencyCard
          title="Credit roles"
          description="Normalized contribution roles"
          items={statistics.credits.roles}
          compact
        />
        <FrequencyCard
          title="Entity types"
          description="People and organizations in credits"
          items={statistics.credits.entityTypes}
          compact
        />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  progress,
  icon,
}: {
  label: string
  value: string
  detail: string
  progress: number
  icon: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant="secondary">{icon}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{detail}</p>
        <Progress value={progress} aria-label={`${label}: ${value}`} />
      </CardContent>
    </Card>
  )
}

function DistributionCard({
  title,
  description,
  items,
  compact = false,
}: {
  title: string
  description: string
  items: CountItem[]
  compact?: boolean
}) {
  return (
    <Card size={compact ? "sm" : "default"}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[minmax(90px,0.8fr)_1fr_auto] items-center gap-3"
            >
              <span className="truncate text-xs text-muted-foreground capitalize">
                {item.label}
              </span>
              <Progress
                value={item.percentage}
                aria-label={`${item.label}: ${item.percentage}%`}
              />
              <strong className="w-8 text-right text-xs tabular-nums">
                {item.count}
              </strong>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No data recorded.</p>
        )}
      </CardContent>
    </Card>
  )
}

function FrequencyCard({
  title,
  description,
  items,
  compact = false,
}: {
  title: string
  description: string
  items: CountItem[]
  compact?: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent
        className={
          compact
            ? "max-h-72 overflow-y-auto px-0"
            : "max-h-105 overflow-y-auto px-0"
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.label}>
                <TableCell className="max-w-52 truncate font-medium">
                  {item.label}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.count}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {item.percentage}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CoverageCard({ items }: { items: CountItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalog coverage</CardTitle>
        <CardDescription>
          How completely structured fields are populated
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field group</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead className="text-right">Records</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.label}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell className="min-w-40">
                  <div className="flex items-center gap-3">
                    <Progress
                      value={item.percentage}
                      aria-label={`${item.label}: ${item.percentage}%`}
                    />
                    <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                      {item.percentage}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
