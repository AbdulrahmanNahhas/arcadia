import { describe, expect, it } from "vitest";
import { effectivePolicy, isVisibleToPolicy, visibleTitleKindsSchema } from "./policy";
import { type TitleKind, titleFormatOf, titleKindOf, titleKinds, titleShapeOf } from "./title-kind";

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
      allowedKinds: new Set(titleKinds),
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

  it("hides a title whose type the account turned off, and keeps the ones it kept", () => {
    const base = {
      maximum: adult,
      allowedKinds: new Set<TitleKind>(["live-action-movie", "live-action-series"]),
      blockedTitleIds: new Set<string>(),
      blockedTagIds: new Set<string>(),
      blockedGenreIds: new Set<string>(),
      blockedEntityIds: new Set<string>(),
      blockedPlanetIds: new Set<string>(),
    };
    const visible = (kind: TitleKind) =>
      isVisibleToPolicy({ id: "title", classification: adult, kind }, base);
    expect(visible("animated-series")).toBe(false);
    expect(visible("animated-movie")).toBe(false);
    expect(visible("live-action-movie")).toBe(true);
    expect(visible("live-action-series")).toBe(true);
    // A candidate that carries no type at all (an installment, an entity) is never filtered here.
    expect(isVisibleToPolicy({ id: "title", classification: adult }, base)).toBe(true);
  });
});

describe("visibleTitleKindsSchema", () => {
  it("rejects an empty selection rather than emptying the whole catalog", () => {
    expect(visibleTitleKindsSchema.safeParse([]).success).toBe(false);
  });

  it("rejects an unknown type and de-duplicates a repeated one", () => {
    expect(visibleTitleKindsSchema.safeParse(["anime"]).success).toBe(false);
    expect(visibleTitleKindsSchema.parse(["animated-movie", "animated-movie"])).toEqual([
      "animated-movie",
    ]);
  });
});

describe("titleKindOf", () => {
  it("composes the four types from the stored format and the derived shape", () => {
    expect(titleKindOf("animated", "series")).toBe("animated-series");
    expect(titleKindOf("animated", "movie")).toBe("animated-movie");
    expect(titleKindOf("live-action", "series")).toBe("live-action-series");
    expect(titleKindOf("live-action", "movie")).toBe("live-action-movie");
  });

  it("round-trips back to the two axes it was built from", () => {
    for (const kind of titleKinds)
      expect(titleKindOf(titleFormatOf(kind), titleShapeOf(kind))).toBe(kind);
  });
});
