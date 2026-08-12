import { describe, expect, it } from "vitest";
import type { Work } from "../library/model";
import {
  createCatalogFilters,
  cycleCatalogSelection,
  workMatchesCatalogFilters,
} from "./catalog-filtering";

const work = {
  kind: "anime",
  releaseStatus: "completed",
  isPrivate: false,
  year: 2024,
  calculatedRating: 8.2,
  scoreComponents: { depth: 8.5, story: 7.5 },
  audience: "Teen",
  genres: ["Drama"],
  tone: ["Reflective"],
  tags: ["Coming-of-Age"],
  country: ["Japan"],
  studios: ["Studio A"],
  contributors: [{ name: "Creator A" }],
  contentWarnings: "Violence",
  installmentId: null,
  episodeCount: 12,
  riskProfile: { sexuality: "low", behavioral: "medium", theology: "none" },
} as Work;

describe("catalog filtering", () => {
  it("cycles a facet through include, exclude, and neutral", () => {
    const included = cycleCatalogSelection({ include: [], exclude: [] }, "anime");
    expect(included).toEqual({ include: ["anime"], exclude: [] });
    const excluded = cycleCatalogSelection(included, "anime");
    expect(excluded).toEqual({ include: [], exclude: ["anime"] });
    expect(cycleCatalogSelection(excluded, "anime")).toEqual({ include: [], exclude: [] });
  });

  it("applies release status to title-level works", () => {
    const filters = createCatalogFilters();
    filters.facets.releaseStatuses.include = ["upcoming"];
    expect(workMatchesCatalogFilters(work, filters)).toBe(false);
    filters.facets.releaseStatuses.include = ["completed"];
    expect(workMatchesCatalogFilters(work, filters)).toBe(true);
  });

  it("filters title score averages by a specific criterion", () => {
    const filters = createCatalogFilters();
    filters.minimumScores.depth = 9;
    expect(workMatchesCatalogFilters(work, filters)).toBe(false);
    filters.minimumScores.depth = 8;
    expect(workMatchesCatalogFilters(work, filters)).toBe(true);
  });

  it("keeps unrated works visible until a minimum rating is selected", () => {
    const unratedWork = { ...work, calculatedRating: null };
    const filters = createCatalogFilters();
    expect(workMatchesCatalogFilters(unratedWork, filters)).toBe(true);
    filters.minimumRating = 1;
    expect(workMatchesCatalogFilters(unratedWork, filters)).toBe(false);
  });

  it("defaults to public works and supports all/private admin visibility", () => {
    const privateWork = { ...work, isPrivate: true };
    const filters = createCatalogFilters();
    expect(workMatchesCatalogFilters(privateWork, filters)).toBe(false);
    filters.privacy = "all";
    expect(workMatchesCatalogFilters(privateWork, filters)).toBe(true);
    filters.privacy = "private";
    expect(workMatchesCatalogFilters(work, filters)).toBe(false);
    expect(workMatchesCatalogFilters(privateWork, filters)).toBe(true);
  });
});
