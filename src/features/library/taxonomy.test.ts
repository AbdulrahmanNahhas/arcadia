import { describe, expect, it } from "vitest";
import { normalizeTaxonomy } from "./taxonomy";

describe("normalizeTaxonomy", () => {
  it("uses one canonical genre vocabulary and moves subgenres into tags", () => {
    expect(
      normalizeTaxonomy({
        genres: ["Science Fiction", "Martial Arts", "Dark fantasy"],
        tags: ["action", "super-hero"],
        tone: ["Action-heavy"],
      }),
    ).toEqual({
      genres: ["Science Fiction", "Action", "Fantasy"],
      tags: ["special-abilities", "martial-arts", "dark-fantasy"],
      tone: ["Energetic"],
    });
  });

  it("removes guidance severity duplicated as tags", () => {
    expect(
      normalizeTaxonomy({
        genres: ["Drama"],
        tags: ["low-fanservice", "high-BehavioralRisk", "found family"],
        tone: ["Heartfelt"],
      }),
    ).toEqual({
      genres: ["Drama"],
      tags: ["found-family"],
      tone: ["Emotional", "Wholesome"],
    });
  });
});
