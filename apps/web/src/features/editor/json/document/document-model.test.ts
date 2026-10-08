import { describe, expect, it } from "vitest";

import {
  documentChanges,
  equalValue,
  projectDocuments,
  projectionSchema,
} from "@/features/editor/json/document/document-model";

describe("document projection and review", () => {
  it("accepts a full library projection beyond fifty works", () => {
    const records = Array.from({ length: 223 }, (_, index) => ({
      id: `work-${index}`,
      canonicalTitle: `Work ${index}`,
      titleAr: `عمل ${index}`,
    }));
    const projection = projectDocuments(records, ["titleAr"]);
    expect(projectionSchema.parse(projection).records).toHaveLength(223);
  });
  it("keeps identity while withholding fields outside the selected scope", () => {
    const projection = projectDocuments(
      [{ id: "work-a", canonicalTitle: "Work", titleAr: "عمل", summary: "Private draft" }],
      ["titleAr"],
    );
    expect(projection.records).toEqual([{ id: "work-a", titleAr: "عمل" }]);
    expect(projection.records[0]).not.toHaveProperty("summary");
  });
  it("compares object values independently of key ordering", () => {
    expect(equalValue({ id: "a", title: "A" }, { title: "A", id: "a" })).toBe(true);
    expect(equalValue(["a", "b"], ["b", "a"])).toBe(false);
  });
  it("matches nested episodes by identity and reports the changed field", () => {
    const before = {
      installments: [
        {
          id: "season",
          episodes: [
            { id: "one", title: "First" },
            { id: "two", title: "Second" },
          ],
        },
      ],
    };
    const after = {
      installments: [
        {
          id: "season",
          episodes: [
            { id: "two", title: "Second" },
            { id: "one", title: "Revised" },
          ],
        },
      ],
    };
    expect(documentChanges(before, after)).toEqual([
      { path: "installments[season].episodes[one].title", before: "First", after: "Revised" },
    ]);
  });
  it("distinguishes a new record and an explicit null value", () => {
    expect(documentChanges({ titleAr: "عمل" }, { titleAr: null })).toEqual([
      { path: "titleAr", before: "عمل", after: null },
    ]);
    expect(documentChanges({ episodes: [] }, { episodes: [{ id: "new", title: "New" }] })).toEqual([
      { path: "episodes[new]", before: null, after: { id: "new", title: "New" } },
    ]);
  });
});
