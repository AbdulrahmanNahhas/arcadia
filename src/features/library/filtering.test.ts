import { describe, expect, it } from "vitest"

import { matchesScoreFilters } from "./filtering"

describe("score filters", () => {
  it("matches scores at or above every active criterion minimum", () => {
    expect(
      matchesScoreFilters(
        { story: 8, depth: 6, craft: 9 },
        { story: 7, depth: 6 }
      )
    ).toBe(true)
    expect(
      matchesScoreFilters({ story: 8, depth: 5 }, { story: 7, depth: 6 })
    ).toBe(false)
  })

  it("does not match when an active criterion has no score", () => {
    expect(matchesScoreFilters({ story: 8 }, { depth: 6 })).toBe(false)
  })
})
