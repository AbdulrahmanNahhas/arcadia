import type {
  TrackingEntry,
  Work,
  WorkSeasonDetail,
  WorkStructure,
} from "./model"

export type ProgressDirection = "forward" | "unchanged" | "correction"

export type ProgressSegment = {
  seasonId: string | null
  seasonTitle: string | null
  seasonNumber: number | null
  firstUnit: number
  lastUnit: number
  count: number
}

export function progressDirection(
  entry: Pick<TrackingEntry, "progressBefore" | "progress">
): ProgressDirection {
  if (entry.progress > entry.progressBefore) return "forward"
  if (entry.progress < entry.progressBefore) return "correction"
  return "unchanged"
}

export function activityAmount(
  entry: Pick<TrackingEntry, "progressBefore" | "progress">
) {
  return Math.max(entry.progress - entry.progressBefore, 0)
}

export function seasonCapacity(season: WorkSeasonDetail) {
  return Math.max(season.units.length, season.unitCount ?? 0)
}

export function progressSegments(
  structure: WorkStructure | undefined,
  progressBefore: number,
  progressAfter: number
): ProgressSegment[] {
  if (progressAfter <= progressBefore) return []

  const segments: ProgressSegment[] = []
  let offset = 0
  for (const season of structure?.seasons ?? []) {
    const capacity = seasonCapacity(season)
    appendIntersection(
      segments,
      progressBefore,
      progressAfter,
      offset,
      capacity,
      season
    )
    offset += capacity
  }

  const ungroupedCapacity = structure?.ungroupedUnits.length ?? 0
  appendIntersection(
    segments,
    progressBefore,
    progressAfter,
    offset,
    ungroupedCapacity,
    null
  )
  offset += ungroupedCapacity

  if (progressAfter > offset) {
    const firstGlobalUnit = Math.max(progressBefore + 1, offset + 1)
    if (firstGlobalUnit <= progressAfter) {
      segments.push({
        seasonId: null,
        seasonTitle: null,
        seasonNumber: null,
        firstUnit: firstGlobalUnit,
        lastUnit: progressAfter,
        count: progressAfter - firstGlobalUnit + 1,
      })
    }
  }

  return segments
}

export function isDiscreteProgressWork(work: Work) {
  const unit = work.progressUnit.trim().toLocaleLowerCase()
  return ["episode", "episodes", "chapter", "chapters"].includes(unit)
}

export function isMovieStatusEvent(
  entry: Pick<TrackingEntry, "statusBefore" | "status">,
  work: Work
) {
  return (
    work.kind === "movie" &&
    entry.status === "completed" &&
    entry.statusBefore !== "completed"
  )
}

function appendIntersection(
  segments: ProgressSegment[],
  progressBefore: number,
  progressAfter: number,
  offset: number,
  capacity: number,
  season: WorkSeasonDetail | null
) {
  if (capacity <= 0) return

  const firstGlobalUnit = Math.max(progressBefore + 1, offset + 1)
  const lastGlobalUnit = Math.min(progressAfter, offset + capacity)
  if (firstGlobalUnit > lastGlobalUnit) return

  segments.push({
    seasonId: season?.id ?? null,
    seasonTitle: season?.title ?? null,
    seasonNumber: season?.seasonNumber ?? null,
    firstUnit: firstGlobalUnit - offset,
    lastUnit: lastGlobalUnit - offset,
    count: lastGlobalUnit - firstGlobalUnit + 1,
  })
}
