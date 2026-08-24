import { describe, expect, it } from "vitest";
import { installmentReleaseStatus } from "./compat";

describe("installmentReleaseStatus", () => {
  it("maps an installment's own status instead of borrowing the parent title's umbrella status", () => {
    // A "returning" title (an ongoing, multi-season show) still has individual seasons that
    // are each announced/airing/completed — installment-mode browsing must filter on that, not
    // on the title-level "returning" bucket, or an announced next season never surfaces under
    // an "upcoming" filter. See database-page.tsx / catalog-filtering.ts releaseStatuses facet.
    expect(installmentReleaseStatus("announced")).toBe("upcoming");
    expect(installmentReleaseStatus("airing")).toBe("airing");
    expect(installmentReleaseStatus("completed")).toBe("completed");
    expect(installmentReleaseStatus("unknown")).toBe("unknown");
  });
});
