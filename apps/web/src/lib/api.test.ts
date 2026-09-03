import { describe, expect, it } from "vitest";
import { apiBaseUrl, rewriteMediaUrls } from "./api";

describe("rewriteMediaUrls", () => {
  it("rewrites a *Path field pointing at the API's own media route to an absolute URL", () => {
    expect(rewriteMediaUrls({ imagePath: "/media/uploads/posters/x.jpg" })).toEqual({
      imagePath: `${apiBaseUrl}/media/uploads/posters/x.jpg`,
    });
  });

  it("walks arrays and nested objects", () => {
    expect(
      rewriteMediaUrls({
        items: [{ posterPath: "/media/library/a.jpg" }, { posterPath: null }],
        studio: { logoPath: "/media/entities/b.png" },
      }),
    ).toEqual({
      items: [{ posterPath: `${apiBaseUrl}/media/library/a.jpg` }, { posterPath: null }],
      studio: { logoPath: `${apiBaseUrl}/media/entities/b.png` },
    });
  });

  it("leaves a field that already carries an absolute URL alone", () => {
    const value = { imagePath: "https://cdn.example.com/poster.jpg" };
    expect(rewriteMediaUrls(value)).toEqual(value);
  });

  it("leaves *Path fields that are not our own media route untouched", () => {
    const value = { routePath: "/titles/abc" };
    expect(rewriteMediaUrls(value)).toEqual(value);
  });

  it("passes through primitives and null unchanged", () => {
    expect(rewriteMediaUrls(null)).toBeNull();
    expect(rewriteMediaUrls(42)).toBe(42);
    expect(rewriteMediaUrls("plain string")).toBe("plain string");
  });
});
