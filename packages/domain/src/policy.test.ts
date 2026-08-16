import { describe, expect, it } from "vitest";
import { effectivePolicy, isVisibleToPolicy } from "./policy";

const adult = {
  audience: "adult",
  age: "18+",
  sexuality: "high",
  behavioral: "high",
  theology: "high",
} as const;

describe("family visibility policy", () => {
  it("uses the stricter value from personal and administrator limits", () => {
    expect(
      effectivePolicy(adult, {
        audience: "teen",
        age: "13+",
        sexuality: "low",
        behavioral: "medium",
        theology: "low",
      }),
    ).toEqual({
      audience: "teen",
      age: "13+",
      sexuality: "low",
      behavioral: "medium",
      theology: "low",
    });
  });

  it("rejects a title when any hidden rule matches", () => {
    const base = {
      maximum: adult,
      blockedTitleIds: new Set<string>(),
      blockedTagIds: new Set(["dark"]),
      blockedGenreIds: new Set<string>(),
      blockedEntityIds: new Set<string>(),
      blockedPlanetIds: new Set<string>(),
    };
    expect(isVisibleToPolicy({ id: "title", classification: adult, tagIds: ["dark"] }, base)).toBe(
      false,
    );
    expect(isVisibleToPolicy({ id: "safe", classification: adult, tagIds: ["bright"] }, base)).toBe(
      true,
    );
  });
});
