import { describe, expect, it } from "vitest"
import { getCollection, workBelongsToCollection } from "./collections"
import type { Work, WorkKind } from "./model"

function work(kind: WorkKind, tags: string[] = []) {
  return { kind, tags } as Work
}

describe("library collections", () => {
  it("groups every series and Western animated movies together", () => {
    const collection = getCollection("western-cartoons")

    expect(workBelongsToCollection(work("series"), collection)).toBe(true)
    expect(
      workBelongsToCollection(work("movie", ["Animated Movie"]), collection)
    ).toBe(true)
    expect(
      workBelongsToCollection(work("movie", ["Anime Movie"]), collection)
    ).toBe(false)
    expect(workBelongsToCollection(work("anime"), collection)).toBe(false)
  })

  it("groups anime series and anime movies together", () => {
    const collection = getCollection("eastern-cartoons")

    expect(workBelongsToCollection(work("anime"), collection)).toBe(true)
    expect(
      workBelongsToCollection(work("movie", ["Anime Movie"]), collection)
    ).toBe(true)
    expect(
      workBelongsToCollection(work("movie", ["Animated Movie"]), collection)
    ).toBe(false)
    expect(workBelongsToCollection(work("series"), collection)).toBe(false)
  })

  it("keeps reading media and games in their type-based collections", () => {
    const reading = getCollection("books-comics")
    const games = getCollection("games")

    for (const kind of ["novel", "manga", "comic", "visual-novel"] as const) {
      expect(workBelongsToCollection(work(kind), reading)).toBe(true)
    }
    expect(workBelongsToCollection(work("game"), games)).toBe(true)
    expect(workBelongsToCollection(work("movie"), games)).toBe(false)
  })
})
