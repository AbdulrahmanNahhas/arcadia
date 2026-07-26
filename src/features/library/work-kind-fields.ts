import type { WorkKind } from "./model"

export type WorkKindField =
  | "runtimeMinutes"
  | "playtimeMinutes"
  | "pageCount"
  | "episodeCount"
  | "chapterCount"
  | "volumeCount"
  | "routeCount"
  | "publication"
  | "serialization"

export const workKindFieldConfig: Record<WorkKind, readonly WorkKindField[]> = {
  movie: ["runtimeMinutes"],
  series: ["episodeCount"],
  anime: ["episodeCount"],
  novel: ["pageCount", "publication"],
  manga: [
    "pageCount",
    "chapterCount",
    "volumeCount",
    "publication",
    "serialization",
  ],
  comic: [
    "pageCount",
    "chapterCount",
    "volumeCount",
    "publication",
    "serialization",
  ],
  game: ["playtimeMinutes"],
  "visual-novel": ["playtimeMinutes", "routeCount"],
}

export function fieldAppliesToKind(kind: WorkKind, field: WorkKindField) {
  return workKindFieldConfig[kind].includes(field)
}
