import { describe, expect, it } from "vitest";
import type { Work } from "../library/model";
import {
  buildCatalogFacetOptions,
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
  awards: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      organizationSlug: "academy-awards",
      organizationName: "Academy Awards — Oscars",
      category: "Best Animated Feature",
      year: 2024,
      result: "winner",
      isFeatured: true,
      installmentId: null,
      installmentTitle: null,
      sourceUrl: null,
      notes: null,
    },
  ],
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

  it("builds and applies country facets from title metadata", () => {
    const otherWork: Work = { ...work, id: "other", country: ["United States"] };
    const options = buildCatalogFacetOptions([work, otherWork]);
    expect(options.countries).toEqual([
      { value: "Japan", count: 1 },
      { value: "United States", count: 1 },
    ]);

    const filters = createCatalogFilters();
    filters.facets.countries.include = ["Japan"];
    expect(workMatchesCatalogFilters(work, filters)).toBe(true);
    expect(workMatchesCatalogFilters(otherWork, filters)).toBe(false);
  });

  it("keeps unrated works visible until a minimum rating is selected", () => {
    const unratedWork = { ...work, calculatedRating: null };
    const filters = createCatalogFilters();
    expect(workMatchesCatalogFilters(unratedWork, filters)).toBe(true);
    filters.minimumRating = 1;
    expect(workMatchesCatalogFilters(unratedWork, filters)).toBe(false);
  });

  it("filters award winners by program without losing title-level recognition", () => {
    const filters = createCatalogFilters();
    filters.facets.awardPrograms.include = ["Academy Awards — Oscars"];
    filters.facets.awardResults.include = ["winner"];
    expect(workMatchesCatalogFilters(work, filters)).toBe(true);
    filters.facets.awardResults.include = ["nominee"];
    expect(workMatchesCatalogFilters(work, filters)).toBe(false);
  });

  it("matches an award program, category, and result on the same recognition", () => {
    const mixedAwardsWork: Work = {
      ...work,
      awards: [
        ...work.awards,
        {
          ...work.awards[0],
          id: "00000000-0000-4000-8000-000000000002",
          organizationSlug: "annie-awards",
          organizationName: "Annie Awards",
          category: "Best Animated Feature — Independent",
          result: "nominee",
        },
      ],
    };
    const filters = createCatalogFilters();
    filters.facets.awardPrograms.include = ["Annie Awards"];
    filters.facets.awardResults.include = ["winner"];
    expect(workMatchesCatalogFilters(mixedAwardsWork, filters)).toBe(false);
    filters.facets.awardResults.include = ["nominee"];
    filters.facets.awardCategories.include = ["Best Animated Feature — Independent"];
    expect(workMatchesCatalogFilters(mixedAwardsWork, filters)).toBe(true);
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
