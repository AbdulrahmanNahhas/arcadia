import { describe, expect, it } from "vitest"
import { parsePastedWorks } from "./add-works-dialog"

describe("parsePastedWorks", () => {
  it("parses valid rows and preserves the chosen personal status", () => {
    const result = parsePastedWorks(
      "Pluto | anime | 2023 | completed | Mystery, Science Fiction | Studio M2"
    )

    expect(result.errors).toEqual([])
    expect(result.works).toEqual([
      expect.objectContaining({
        title: "Pluto",
        kind: "anime",
        year: 2023,
        status: "completed",
        genres: ["Mystery", "Science Fiction"],
        studios: ["Studio M2"],
      }),
    ])
  })

  it("reports row-specific errors without importing invalid rows", () => {
    const result = parsePastedWorks(
      "Valid | movie | 2024 | planned\nBroken | unknown | nope | later"
    )

    expect(result.works).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain("السطر 2")
    expect(result.errors[0]).toContain("النوع")
    expect(result.errors[0]).toContain("السنة")
    expect(result.errors[0]).toContain("الحالة")
  })
})
