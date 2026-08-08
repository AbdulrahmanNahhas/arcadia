import { describe, expect, it } from "vitest";
import type { TrackingEntry, WorkSeasonDetail, WorkStructure } from "./model";
import { activityAmount, progressDirection, progressSegments } from "./tracking";

function season(id: string, seasonNumber: number, unitCount: number): WorkSeasonDetail {
  return {
    id,
    workId: "work",
    title: `Season ${seasonNumber}`,
    seasonNumber,
    position: seasonNumber - 1,
    runtimeMinutes: null,
    unitCount,
    releaseAt: null,
    progress: null,
    units: [],
  };
}

const structure: WorkStructure = {
  workId: "work",
  seasons: [season("s1", 1, 28), season("s2", 2, 10)],
  ungroupedUnits: [],
  completedUnits: 0,
  totalUnits: 38,
};

describe("tracking range semantics", () => {
  it("expands cumulative progress into season-local ordered units", () => {
    expect(progressSegments(structure, 28, 30)).toEqual([
      {
        seasonId: "s2",
        seasonTitle: "Season 2",
        seasonNumber: 2,
        firstUnit: 1,
        lastUnit: 2,
        count: 2,
      },
    ]);
    expect(progressSegments(structure, 30, 32)).toEqual([
      {
        seasonId: "s2",
        seasonTitle: "Season 2",
        seasonNumber: 2,
        firstUnit: 3,
        lastUnit: 4,
        count: 2,
      },
    ]);
  });

  it("splits a range exactly at a season boundary", () => {
    expect(progressSegments(structure, 27, 30)).toMatchObject([
      { seasonId: "s1", firstUnit: 28, lastUnit: 28, count: 1 },
      { seasonId: "s2", firstUnit: 1, lastUnit: 2, count: 2 },
    ]);
  });

  it("does not count corrections or status-only updates as activity", () => {
    const correction = {
      progressBefore: 5,
      progress: 3,
    } as TrackingEntry;
    const unchanged = {
      progressBefore: 3,
      progress: 3,
    } as TrackingEntry;

    expect(progressDirection(correction)).toBe("correction");
    expect(activityAmount(correction)).toBe(0);
    expect(progressDirection(unchanged)).toBe("unchanged");
    expect(activityAmount(unchanged)).toBe(0);
  });
});
