import { describe, expect, it } from "vitest";
import type { TrackingEntry, Work } from "@/features/library/model";
import { groupEntries, summarizeEntries } from "./activity-feed-utils";

function entry(
  id: string,
  occurredOn: string,
  progressBefore: number,
  progress: number,
  daySequence = 0,
): TrackingEntry {
  return {
    id,
    workId: "oshi",
    progressBefore,
    progress,
    statusBefore: progressBefore === 0 ? "planned" : "in-progress",
    status: "in-progress",
    occurredOn,
    daySequence,
    recordedAt: 0,
  };
}

const anime = {
  id: "oshi",
  kind: "anime",
  progressUnit: "episodes",
  title: "Oshi No Ko",
  arabicTitle: null,
} as Work;

describe("activity aggregation", () => {
  it("counts watched episodes rather than cumulative snapshots", () => {
    const entries = [entry("second", "2026-04-06", 1, 5), entry("first", "2026-04-02", 0, 1)];
    const summary = summarizeEntries(entries, new Map([[anime.id, anime]]));

    expect(summary.updateCount).toBe(2);
    expect(summary.media.episodesWatched).toBe(5);
    expect(summary.periods.day).toMatchObject([
      { key: "2026-04-06", episodes: 4, total: 4 },
      { key: "2026-04-02", episodes: 1, total: 1 },
    ]);
  });

  it("retains day boundaries and same-day sequence inside week groups", () => {
    const entries = [
      entry("later", "2026-04-06", 3, 5, 1),
      entry("earlier", "2026-04-06", 1, 3, 0),
      entry("first-day", "2026-04-02", 0, 1),
    ];
    const groups = groupEntries(entries, "week");

    expect(groups.flatMap((group) => group.days.map((day) => day.date))).toEqual([
      "2026-04-06",
      "2026-04-02",
    ]);
    expect(groups[0].days[0].items.map(({ entry }) => entry.id)).toEqual(["earlier", "later"]);
  });
});
