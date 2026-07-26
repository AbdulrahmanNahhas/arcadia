import { describe, expect, it } from "vitest"
import { calculatedRating } from "./scoring"

describe("calculatedRating", () => {
  it("uses the shared weighted formula and rounds to one decimal", () => {
    expect(
      calculatedRating({
        story: 8,
        characters: 9,
        depth: 7,
        worldBuilding: 8,
        originality: 6,
        craft: 9,
      })
    ).toBe(8.1)
  })

  it("stays incomplete until all six components are present", () => {
    expect(calculatedRating({ story: 10, characters: 10 })).toBeNull()
  })

  it("accepts boundary values", () => {
    expect(
      calculatedRating({
        story: 0,
        characters: 0,
        depth: 0,
        worldBuilding: 0,
        originality: 0,
        craft: 0,
      })
    ).toBe(0)
  })
})
