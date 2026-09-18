import { describe, expect, it } from "vitest";
import { sourceHints } from "./source-hints";

describe("sourceHints", () => {
  it("reads dual audio and multi subs from a release name", () => {
    const hints = sourceHints({
      filename: "[Trix] SPY×FAMILY S03E05 [WEBRip 1080p AV1 Opus] (Dual Audio, Multi Subs).mkv",
      description: null,
      label: "NahhasArcadia · 1080p",
    });
    expect(hints.map((hint) => hint.key)).toEqual(["dual", "multi-subs"]);
  });

  it("prefers the specific Arabic dub hint over the generic one", () => {
    const hints = sourceHints({
      filename: "Film.2020.Arabic.Dubbed.mkv",
      description: null,
      label: "",
    });
    expect(hints.map((hint) => hint.key)).toEqual(["ar-dub"]);
  });

  it("returns nothing for an unannotated release", () => {
    expect(
      sourceHints({ filename: "Film.2020.1080p.x264.mkv", description: null, label: "" }),
    ).toEqual([]);
  });
});
