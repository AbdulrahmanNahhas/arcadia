import { desc, eq } from "drizzle-orm"
import { db } from "../src/db/client"
import { recordTrackingEntry } from "../src/db/repository"
import {
  personalState,
  trackingEntries,
  workSeasons,
  workUnits,
  works,
} from "../src/db/schema"

type Season = {
  title: string
  seasonNumber: number
  unitCount: number | null
}

type Structure = {
  title: string
  workId: string
  episodeCount: number
  seasons: Season[]
}

// Season and episode data from AniList's public catalog, retrieved 2026-07-27.
// Only released seasons are represented: announced seasons with no episode
// count are intentionally omitted until they can form a complete structure.
const structures: Structure[] = [
  {
    title: "Attack on Titan",
    workId: "obsidian-animation-tv-attack-on-titan",
    episodeCount: 89,
    seasons: [
      { title: "Season 1", seasonNumber: 1, unitCount: 25 },
      { title: "Season 2", seasonNumber: 2, unitCount: 12 },
      { title: "Season 3", seasonNumber: 3, unitCount: 22 },
      { title: "The Final Season", seasonNumber: 4, unitCount: 16 },
      { title: "The Final Season Part 2", seasonNumber: 4.1, unitCount: 12 },
      {
        title: "The Final Chapters Special 1",
        seasonNumber: 4.2,
        unitCount: 1,
      },
      {
        title: "The Final Chapters Special 2",
        seasonNumber: 4.3,
        unitCount: 1,
      },
    ],
  },
  {
    title: "Oshi No Ko",
    workId: "obsidian-animation-tv-oshi-no-ko",
    episodeCount: 35,
    seasons: [
      { title: "Season 1", seasonNumber: 1, unitCount: 11 },
      { title: "Season 2", seasonNumber: 2, unitCount: 13 },
      { title: "Season 3", seasonNumber: 3, unitCount: 11 },
    ],
  },
  {
    title: "Witch Hat Atelier",
    workId: "obsidian-animation-tv-witch-hat-atelier",
    episodeCount: 13,
    seasons: [{ title: "Season 1", seasonNumber: 1, unitCount: 13 }],
  },
  {
    title: "Black Clover",
    workId: "obsidian-animation-tv-black-clover",
    episodeCount: 170,
    seasons: [{ title: "Season 1", seasonNumber: 1, unitCount: 170 }],
  },
  {
    title: "Vinland Saga",
    workId: "obsidian-animation-tv-vinland-saga",
    episodeCount: 48,
    seasons: [
      { title: "Season 1", seasonNumber: 1, unitCount: 24 },
      { title: "Season 2", seasonNumber: 2, unitCount: 24 },
    ],
  },
  {
    title: "Hunter × Hunter (2011)",
    workId: "obsidian-animation-tv-hunter-hunter-2011",
    episodeCount: 148,
    seasons: [{ title: "Season 1", seasonNumber: 1, unitCount: 148 }],
  },
  {
    title: "Violet Evergarden",
    workId: "obsidian-animation-tv-violet-evergarden",
    episodeCount: 13,
    seasons: [{ title: "Season 1", seasonNumber: 1, unitCount: 13 }],
  },
  {
    title: "Frieren: Beyond Journey's End",
    workId: "obsidian-animation-tv-frieren-beyond-journeys-end",
    episodeCount: 38,
    seasons: [
      { title: "Season 1", seasonNumber: 1, unitCount: 28 },
      { title: "Season 2", seasonNumber: 2, unitCount: 10 },
    ],
  },
]

const now = Math.floor(Date.now() / 1000)

db.transaction((tx) => {
  for (const structure of structures) {
    tx.delete(workUnits).where(eq(workUnits.workId, structure.workId)).run()
    tx.delete(workSeasons).where(eq(workSeasons.workId, structure.workId)).run()
    tx.update(works)
      .set({ episodeCount: structure.episodeCount, updatedAt: now })
      .where(eq(works.id, structure.workId))
      .run()
    tx.insert(workSeasons)
      .values(
        structure.seasons.map((season, position) => ({
          id: `${structure.workId}-season-${position + 1}`,
          workId: structure.workId,
          title: season.title,
          seasonNumber: season.seasonNumber,
          position,
          unitCount: season.unitCount,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .run()
  }
})

const attackOnTitanId = "obsidian-animation-tv-attack-on-titan"
const finalChaptersEntry = db
  .select()
  .from(trackingEntries)
  .where(eq(trackingEntries.workId, attackOnTitanId))
  .orderBy(desc(trackingEntries.occurredOn), desc(trackingEntries.daySequence))
  .limit(1)
  .get()

if (
  !finalChaptersEntry ||
  finalChaptersEntry.occurredOn !== "2026-04-29" ||
  finalChaptersEntry.progress !== 89
) {
  recordTrackingEntry({
    workId: attackOnTitanId,
    progress: 89,
    status: "completed",
    occurredOn: "2026-04-29",
  })
}

for (const structure of structures) {
  const latest = db
    .select()
    .from(trackingEntries)
    .where(eq(trackingEntries.workId, structure.workId))
    .orderBy(
      desc(trackingEntries.occurredOn),
      desc(trackingEntries.daySequence)
    )
    .limit(1)
    .get()
  if (!latest) throw new Error(`${structure.title}: no watch log found.`)

  db.update(personalState)
    .set({
      status: latest.status,
      progress: latest.progress,
      progressTotal: structure.episodeCount,
      progressUnit: "episodes",
      completedAt:
        latest.status === "completed"
          ? Math.floor(Date.parse(`${latest.occurredOn}T00:00:00.000Z`) / 1000)
          : null,
      updatedAt: now,
    })
    .where(eq(personalState.workId, structure.workId))
    .run()
}

for (const structure of structures) {
  console.log(
    `${structure.title}: ${structure.seasons.length} seasons, ${structure.episodeCount} episodes`
  )
}
