import { describe, expect, it } from "vitest";
import { groupWorks } from "./grouping";
import type { Work } from "./model";

function work(id: string, overrides: Partial<Work> = {}) {
  return {
    id,
    title: id,
    calculatedRating: null,
    audience: null,
    genres: [],
    kind: "movie",
    status: "planned",
    year: null,
    scoreComponents: {},
    ...overrides,
  } as Work;
}

describe("library grouping", () => {
  it("builds descending rating bands and keeps unrated works separate", () => {
    const groups = groupWorks(
      [
        work("great", { calculatedRating: 9.4 }),
        work("good", { calculatedRating: 8.7 }),
        work("unknown"),
      ],
      "rating",
    );
    expect(groups.map(({ label }) => label)).toEqual(["9–10", "8–8.9", "غير مقيّم"]);
  });

  it("groups by depth score independently of the total rating", () => {
    const groups = groupWorks(
      [
        work("deep", { scoreComponents: { depth: 9 } }),
        work("light", { scoreComponents: { depth: 5 } }),
      ],
      "depth",
    );
    expect(groups.map(({ works }) => works[0]?.id)).toEqual(["deep", "light"]);
  });
});
