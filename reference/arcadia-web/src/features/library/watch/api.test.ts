import { describe, expect, it } from "vitest";
import { parseImdbInput, watchLabel } from "./api";

describe("parseImdbInput", () => {
  it("accepts an id, an IMDb URL, or the bare digits", () => {
    expect(parseImdbInput("tt0133093")).toBe("tt0133093");
    expect(parseImdbInput("  TT0133093 ")).toBe("tt0133093");
    expect(parseImdbInput("https://www.imdb.com/title/tt0944947/?ref_=nv_sr_srsg_0")).toBe(
      "tt0944947",
    );
    expect(parseImdbInput("0133093")).toBe("tt0133093");
  });

  it("rejects anything else", () => {
    expect(parseImdbInput("")).toBeNull();
    expect(parseImdbInput("The Matrix")).toBeNull();
    expect(parseImdbInput("tt12")).toBeNull();
  });
});

describe("watchLabel", () => {
  it("names the episode when there is one", () => {
    expect(watchLabel({ imdbId: "tt0944947", season: 1, episode: 2 })).toBe(
      "tt0944947 · الموسم 1 · الحلقة 2",
    );
    expect(watchLabel({ imdbId: "tt0133093", season: null, episode: null })).toBe("tt0133093");
  });
});
