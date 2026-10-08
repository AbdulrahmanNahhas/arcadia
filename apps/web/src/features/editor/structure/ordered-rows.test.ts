import { describe, expect, it } from "vitest";

import { moveOrderedRow, withPositions } from "@/features/editor/structure/ordered-rows";

describe("editor ordering", () => {
  const rows = [
    { id: "a", position: 2 },
    { id: "b", position: 5 },
    { id: "c", position: 8 },
  ];
  it("moves a row and stores consecutive positions while preserving its identity", () => {
    expect(moveOrderedRow(rows, 1, -1)).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
      { id: "c", position: 2 },
    ]);
    expect(rows[1]).toEqual({ id: "b", position: 5 });
    expect(moveOrderedRow(rows, 1, 1).map((row) => row.id)).toEqual(["a", "c", "b"]);
  });
  it("keeps boundary actions safe", () => {
    expect(moveOrderedRow(rows, 0, -1)).toEqual(rows);
    expect(moveOrderedRow(rows, 2, 1)).toEqual(rows);
    expect(moveOrderedRow([], 0, 1)).toEqual([]);
  });
  it("reindexes after adding or removing rows", () => {
    expect(withPositions(rows.filter((row) => row.id !== "b"))).toEqual([
      { id: "a", position: 0 },
      { id: "c", position: 1 },
    ]);
  });
});
