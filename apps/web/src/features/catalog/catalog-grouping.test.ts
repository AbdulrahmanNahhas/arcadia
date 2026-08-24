import { describe, expect, it } from "vitest";
import type { Work } from "../library/model";
import { groupWorks } from "./catalog-grouping";

function work(overrides: Partial<Work>): Work {
  // SAFETY: groupWorks only reads kind/year/releaseStatus/audience/age off a work, so this
  // partial fixture is complete for every test in this file despite not satisfying `Work` in full.
  return {
    id: "id",
    kind: "anime",
    year: 2024,
    releaseStatus: "completed",
    audience: "Teen",
    age: "13+",
    ...overrides,
  } as Work;
}

describe("groupWorks", () => {
  it("returns a single unlabeled group when grouping is off", () => {
    const works = [work({ id: "a" }), work({ id: "b" })];
    const groups = groupWorks(works, "none");
    expect(groups).toEqual([{ key: "all", label: "", works }]);
  });

  it("orders year groups by the requested direction and buckets unknown years last", () => {
    const works = [
      work({ id: "a", year: 2022 }),
      work({ id: "b", year: 2024 }),
      work({ id: "c", year: null }),
      work({ id: "d", year: 2023 }),
    ];
    const descending = groupWorks(works, "year", true);
    expect(descending.map((group) => group.key)).toEqual(["2024", "2023", "2022", "unknown"]);
    const ascending = groupWorks(works, "year", false);
    expect(ascending.map((group) => group.key)).toEqual(["2022", "2023", "2024", "unknown"]);
  });

  it("keeps a fixed audience order from most to least permissive, regardless of input order", () => {
    const works = [
      work({ id: "a", audience: "Adult" }),
      work({ id: "b", audience: "General" }),
      work({ id: "c", audience: null }),
      work({ id: "d", audience: "Teen" }),
    ];
    const groups = groupWorks(works, "audience");
    expect(groups.map((group) => group.key)).toEqual(["General", "Teen", "Adult", "unknown"]);
  });

  it("preserves each work's incoming sort order inside its group", () => {
    const works = [
      work({ id: "a", kind: "movie" }),
      work({ id: "b", kind: "anime" }),
      work({ id: "c", kind: "movie" }),
    ];
    const groups = groupWorks(works, "kind");
    const movies = groups.find((group) => group.key === "movie");
    expect(movies?.works.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
