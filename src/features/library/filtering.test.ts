import { describe, expect, it } from "vitest";
import {
  compareWorks,
  createDefaultFilters,
  matchesScoreFilters,
  workMatchesFilters,
} from "./filtering";
import type { Work } from "./model";

function work(overrides: Partial<Work> = {}): Work {
  return {
    id: "work",
    title: "Work",
    arabicTitle: null,
    kind: "series",
    year: 2026,
    releaseStatus: "released",
    status: "planned",
    calculatedRating: null,
    favorite: false,
    scoreComponents: {},
    genres: [],
    tags: [],
    tones: [],
    tone: [],
    studios: [],
    contributors: [],
    externalLinks: [],
    sharedWith: [],
    country: [],
    audience: null,
    publication: null,
    sourceMaterial: null,
    riskProfile: null,
    aliases: [],
    isSequelMovie: false,
    addedAt: 0,
    ...overrides,
  } as Work;
}

describe("score filters", () => {
  it("matches scores at or above every active criterion minimum", () => {
    expect(matchesScoreFilters({ story: 8, depth: 6, craft: 9 }, { story: 7, depth: 6 })).toBe(
      true,
    );
    expect(matchesScoreFilters({ story: 8, depth: 5 }, { story: 7, depth: 6 })).toBe(false);
  });

  it("does not match when an active criterion has no score", () => {
    expect(matchesScoreFilters({ story: 8 }, { depth: 6 })).toBe(false);
  });
});

describe("default discovery visibility", () => {
  it("shows saved, announced, and sequel works by default", () => {
    const filters = createDefaultFilters();
    expect(workMatchesFilters(work({ status: "saved" }), filters)).toBe(true);
    expect(workMatchesFilters(work({ releaseStatus: "announced" }), filters)).toBe(true);
    expect(workMatchesFilters(work({ kind: "movie", isSequelMovie: true }), filters)).toBe(true);
  });

  it("hides private works until the private filter is enabled", () => {
    expect(workMatchesFilters(work({ isPrivate: true }), createDefaultFilters())).toBe(false);
    expect(
      workMatchesFilters(work({ isPrivate: true }), {
        ...createDefaultFilters(),
        privateOnly: true,
      }),
    ).toBe(true);
  });
});

describe("work sorting", () => {
  it("sorts rating descending with unrated works last and localized title ties", () => {
    const values = [
      work({ id: "u", title: "Unrated", calculatedRating: null }),
      work({ id: "b", title: "Beta", calculatedRating: 8 }),
      work({ id: "a", title: "Alpha", calculatedRating: 8 }),
      work({ id: "top", title: "Top", calculatedRating: 9 }),
    ];
    expect(
      values.sort((left, right) => compareWorks(left, right, "rating", "desc")).map(({ id }) => id),
    ).toEqual(["top", "a", "b", "u"]);
  });

  it("sorts individual score components while keeping missing scores last", () => {
    const values = [
      work({ id: "missing", title: "Missing", scoreComponents: {} }),
      work({ id: "deep", title: "Deep", scoreComponents: { depth: 9 } }),
      work({ id: "light", title: "Light", scoreComponents: { depth: 6 } }),
    ];
    expect(
      values.sort((left, right) => compareWorks(left, right, "depth", "desc")).map(({ id }) => id),
    ).toEqual(["deep", "light", "missing"]);
  });
});
