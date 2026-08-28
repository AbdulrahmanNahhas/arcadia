import { describe, expect, it } from "vitest";
import { catalogTermLabel } from "./work-detail-page";

// `server/compat.ts` maps API slugs (`science-fiction`, `general`) to the legacy `Work` model's
// English display labels ("Science Fiction", "General") before this page ever sees them, so
// `catalogTermLabel` must resolve those *labels*, not slugs — this pins the regression where the
// page called the DB-backed, slug-keyed `taxonomyLabel` on these values and silently rendered the
// untranslated English label instead of Arabic.
describe("catalogTermLabel", () => {
  it("translates an English genre label to Arabic", () => {
    expect(catalogTermLabel("genre", "Science Fiction")).toBe("خيال علمي");
    expect(catalogTermLabel("genre", "Adventure")).toBe("مغامرة");
  });

  it("translates an English tone label to Arabic", () => {
    expect(catalogTermLabel("tone", "Wholesome")).toBe("دافئ");
  });

  it("translates an English tag label to Arabic", () => {
    expect(catalogTermLabel("tag", "Friendship")).toBe("صداقة");
  });

  it("translates an English audience label to Arabic", () => {
    expect(catalogTermLabel("audience", "General")).toBe("عام");
    expect(catalogTermLabel("audience", "Young Adult")).toBe("شباب بالغون");
  });

  it("translates a known English country label to Arabic", () => {
    expect(catalogTermLabel("country", "Japan")).toBe("اليابان");
  });

  it("falls back to the input value for an unknown vocabulary or value", () => {
    expect(catalogTermLabel("unknown-vocabulary", "Anything")).toBe("Anything");
    expect(catalogTermLabel("genre", "Not A Real Genre")).toBe("Not A Real Genre");
  });
});
