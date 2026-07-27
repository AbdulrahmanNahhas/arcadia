import type { TrackingEntry, Work } from "@/features/library/model"

export const trackingStatuses = [
  "planned",
  "in-progress",
  "completed",
  "paused",
  "dropped",
] as const

export type FeedSummary = {
  entryCount: number
  monthEntryCount: number
  yearEntryCount: number
  uniqueWorkCount: number
  completedCount: number
  year: number
  maxMonthEntryCount: number
  months: Array<{ key: string; label: string; count: number }>
  latestWorkIds: string[]
  activeWorkIds: string[]
  statusCounts: Partial<Record<Work["status"], number>>
  media: {
    movieCount: number
    animeCount: number
    episodeProgress: number
    chapterProgress: number
  }
}

export type FeedGrouping = "day" | "week" | "month"

export type FeedItem = {
  workId: string
  latestEntry: TrackingEntry
  startProgress: number
  entryCount: number
}

export type FeedGroup = {
  key: string
  label: string
  items: FeedItem[]
}

export type CalendarDay = {
  date: string
  day: number
}

export const calendarWeekdays = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
] as const

export function summarizeEntries(
  entries: TrackingEntry[],
  worksById: Map<string, Work>
): FeedSummary {
  const now = new Date()
  const year = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth()
  const yearPrefix = `${year}-`
  const monthPrefix = `${year}-${String(currentMonth + 1).padStart(2, "0")}`
  const yearEntries = entries.filter((entry) =>
    entry.occurredOn.startsWith(yearPrefix)
  )
  const latestByWork = new Map<string, TrackingEntry>()
  for (const entry of entries) {
    if (!latestByWork.has(entry.workId)) latestByWork.set(entry.workId, entry)
  }
  const statusCounts: Partial<Record<Work["status"], number>> = {}
  for (const entry of latestByWork.values()) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1
  }
  const months = Array.from({ length: 12 }, (_, month) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`
    return {
      key,
      label: formatMonth(month),
      count: yearEntries.filter((entry) => entry.occurredOn.startsWith(key))
        .length,
    }
  })
  const media = {
    movieCount: 0,
    animeCount: 0,
    episodeProgress: 0,
    chapterProgress: 0,
  }
  for (const [workId, entry] of latestByWork) {
    const work = worksById.get(workId)
    if (!work) continue
    if (work.kind === "movie") media.movieCount += 1
    if (work.kind === "anime") media.animeCount += 1
    if (isProgressUnit(work.progressUnit, "episode")) {
      media.episodeProgress += entry.progress
    }
    if (isProgressUnit(work.progressUnit, "chapter")) {
      media.chapterProgress += entry.progress
    }
  }

  return {
    entryCount: entries.length,
    monthEntryCount: entries.filter((entry) =>
      entry.occurredOn.startsWith(monthPrefix)
    ).length,
    yearEntryCount: yearEntries.length,
    uniqueWorkCount: latestByWork.size,
    completedCount: statusCounts.completed ?? 0,
    year,
    maxMonthEntryCount: Math.max(...months.map((month) => month.count), 1),
    months,
    latestWorkIds: [...new Set(entries.map((entry) => entry.workId))].slice(
      0,
      5
    ),
    activeWorkIds: [...latestByWork.keys()],
    statusCounts,
    media,
  }
}

export function statusBadgeVariant(status: Work["status"]) {
  if (status === "completed") return "default"
  if (status === "dropped") return "destructive"
  if (status === "in-progress") return "secondary"
  return "outline"
}

export function monthBarHeight(count: number, max: number) {
  if (count === 0) return "h-1 bg-muted-foreground/25"
  const ratio = count / max
  if (ratio <= 0.25) return "h-2"
  if (ratio <= 0.5) return "h-5"
  if (ratio <= 0.75) return "h-9"
  return "h-full"
}

export function groupEntries(
  entries: TrackingEntry[],
  grouping: FeedGrouping
): FeedGroup[] {
  const groups = new Map<string, TrackingEntry[]>()
  for (const entry of entries) {
    const key = getGroupKey(entry.occurredOn, grouping)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups.entries()].map(([key, groupEntries]) => ({
    key,
    label: formatGroupLabel(key, grouping),
    items: consolidateEntries(groupEntries),
  }))
}

export function getGroupKey(value: string, grouping: FeedGrouping) {
  if (grouping === "day") return value
  if (grouping === "month") return value.slice(0, 7)

  const date = new Date(`${value}T00:00:00Z`)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  return date.toISOString().slice(0, 10)
}

export function formatGroupLabel(value: string, grouping: FeedGrouping) {
  if (grouping === "day") return formatDate(value)
  if (grouping === "month") return formatMonthYear(value)

  const weekStart = new Date(`${value}T00:00:00Z`)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  return `أسبوع ${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`
}

export function consolidateEntries(entries: TrackingEntry[]): FeedItem[] {
  const items = new Map<string, FeedItem>()
  for (const entry of entries) {
    const current = items.get(entry.workId)
    if (!current) {
      items.set(entry.workId, {
        workId: entry.workId,
        latestEntry: entry,
        startProgress: entry.progress,
        entryCount: 1,
      })
      continue
    }
    current.startProgress = entry.progress
    current.entryCount += 1
  }
  return [...items.values()]
}

export function progressChangeLabel(item: FeedItem) {
  if (item.startProgress === item.latestEntry.progress) {
    return `التقدم: ${item.latestEntry.progress}`
  }
  return `التقدم: ${item.startProgress} ← ${item.latestEntry.progress}`
}

export function progressWithTotalLabel(item: FeedItem, total: number) {
  if (item.startProgress === item.latestEntry.progress) {
    return `${item.latestEntry.progress} من ${total}`
  }
  return `${item.startProgress} ← ${item.latestEntry.progress} من ${total}`
}

export function isProgressUnit(value: string, unit: "episode" | "chapter") {
  const normalized = value.trim().toLocaleLowerCase()
  return normalized === unit || normalized === `${unit}s`
}

export function groupEntriesByDate(entries: TrackingEntry[]) {
  const groups = new Map<string, TrackingEntry[]>()
  for (const entry of entries) {
    groups.set(entry.occurredOn, [
      ...(groups.get(entry.occurredOn) ?? []),
      entry,
    ])
  }
  return groups
}

export function countEntriesByWork(entries: TrackingEntry[]) {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    counts.set(entry.workId, (counts.get(entry.workId) ?? 0) + 1)
  }
  return counts
}

export function countLatestStatus(
  entries: TrackingEntry[],
  status: Work["status"]
) {
  const latestByWork = new Map<string, TrackingEntry>()
  for (const entry of entries) {
    if (!latestByWork.has(entry.workId)) latestByWork.set(entry.workId, entry)
  }
  return [...latestByWork.values()].filter((entry) => entry.status === status)
    .length
}

export function buildCalendarDays(monthKey: string): Array<CalendarDay | null> {
  const [year, month] = monthKey.split("-").map(Number)
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const leadingDays = (firstDay.getUTCDay() + 1) % 7
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days: Array<CalendarDay | null> = Array.from(
    { length: leadingDays },
    () => null
  )
  for (let day = 1; day <= dayCount; day += 1) {
    days.push({
      date: `${monthKey}-${String(day).padStart(2, "0")}`,
      day,
    })
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

export function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export function summarizeCalendarYear(entries: TrackingEntry[], year: number) {
  return Array.from({ length: 12 }, (_, month) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`
    return {
      key,
      label: formatMonth(month),
      count: entries.filter((entry) => entry.occurredOn.startsWith(key)).length,
    }
  })
}

export function calendarActivityClass(count: number, max: number) {
  const ratio = count / max
  if (ratio <= 0.25) return "bg-primary/15 text-foreground hover:bg-primary/25"
  if (ratio <= 0.5) return "bg-primary/35 text-foreground hover:bg-primary/45"
  if (ratio <= 0.75)
    return "bg-primary/60 text-primary-foreground hover:bg-primary/70"
  return "bg-primary text-primary-foreground hover:bg-primary/90"
}

export function formatWorkNames(
  entries: TrackingEntry[],
  worksById: Map<string, Work>
) {
  const names = [...new Set(entries.map((entry) => entry.workId))]
    .map((workId) => worksById.get(workId))
    .filter((work): work is Work => Boolean(work))
    .map((work) => work.arabicTitle || work.title)
  return names.join("، ")
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ar").format(value)
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

export function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("ar", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value)
}

export function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("ar", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00Z`))
}

export function formatMonth(month: number) {
  return new Intl.DateTimeFormat("ar", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, month, 1)))
}
