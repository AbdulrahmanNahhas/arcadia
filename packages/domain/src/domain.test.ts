import { describe, expect, it } from "vitest";
import {
  effectiveClassification,
  effectivePolicy,
  installmentRating,
  languagePolicySchema,
  taxonomySeeds,
  titleRating,
} from ".";

const general = {
  audience: "general",
  age: "all",
  sexuality: "none",
  behavioral: "low",
  theology: "none",
} as const;
const adult = {
  audience: "adult",
  age: "18+",
  sexuality: "high",
  behavioral: "high",
  theology: "high",
} as const;

describe("domain policies", () => {
  it("inherits nullable installment classifications", () =>
    expect(effectiveClassification(general, { age: "10+", theology: null })).toEqual({
      ...general,
      age: "10+",
    }));
  it("intersects visible and hidden policy limits", () =>
    expect(effectivePolicy(adult, general)).toEqual(general));
  it("validates ordered language rules", () =>
    expect(
      languagePolicySchema.safeParse({
        preferredAudio: ["ar"],
        allowedAudio: ["en"],
        subtitleMode: "off",
        canSwitchTracks: false,
      }).success,
    ).toBe(false));
});

describe("catalog definitions", () => {
  it("generates deterministic bilingual seeds", () =>
    expect(taxonomySeeds()[0]).toEqual({
      vocabulary: "genres",
      slug: "action",
      labelEn: "Action",
      labelAr: "أكشن",
      position: 0,
    }));
  it("uses editorial weights for installments and a simple title mean", () => {
    const complete = {
      story: 8,
      characters: 7,
      depth: 6,
      worldBuilding: 5,
      originality: 9,
      craft: 7,
    };
    expect(installmentRating(complete)).toBe(7.1);
    expect(titleRating([complete, { story: 9 }])).toEqual({ rating: 7.1, scored: 1, total: 2 });
  });
});
