import type { SubtitleCandidate } from "@arcadia/contracts";
import { describe, expect, it } from "vitest";
import type { PlayerTrack } from "../desktop-player";
import { CURATED_AUDIO_LANGUAGES, CURATED_SUBTITLE_LANGUAGES } from "./languages";
import { groupPlayerTracks, groupSubtitleCandidates, trackVariantLabel } from "./track-groups";

function track(overrides: Partial<PlayerTrack>): PlayerTrack {
  return { id: "1", lang: null, title: null, selected: false, ...overrides };
}

function candidate(overrides: Partial<SubtitleCandidate>): SubtitleCandidate {
  return {
    fileId: 1,
    fileName: null,
    language: "en",
    release: null,
    downloadCount: null,
    matchedBy: "imdb",
    ...overrides,
  };
}

describe("groupPlayerTracks", () => {
  it("merges 639-1 and 639-2 spellings of one language into a single group", () => {
    const tracks = [
      track({ id: "1", lang: "eng", title: "Full" }),
      track({ id: "2", lang: "en", title: "SDH" }),
      track({ id: "3", lang: "ara" }),
    ];
    const { visible } = groupPlayerTracks(tracks, {
      curated: CURATED_SUBTITLE_LANGUAGES,
      showAll: false,
    });
    expect(visible.map((group) => group.language.code)).toEqual(["ar", "en"]);
    expect(visible[1]?.items.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("hides languages outside the curated set until show-all, but never the selected one", () => {
    const tracks = [
      track({ id: "1", lang: "jpn", selected: true }),
      track({ id: "2", lang: "fre" }),
      track({ id: "3", lang: "eng" }),
    ];
    const hidden = groupPlayerTracks(tracks, {
      curated: CURATED_SUBTITLE_LANGUAGES,
      showAll: false,
    });
    expect(hidden.visible.map((group) => group.language.code)).toEqual(["en", "ja"]);
    expect(hidden.hiddenCount).toBe(1);

    const all = groupPlayerTracks(tracks, { curated: CURATED_SUBTITLE_LANGUAGES, showAll: true });
    expect(all.visible.map((group) => group.language.code)).toEqual(["en", "fr", "ja"]);
    expect(all.hiddenCount).toBe(0);
  });

  it("orders curated languages by their configured rank", () => {
    const tracks = [
      track({ id: "1", lang: "ja" }),
      track({ id: "2", lang: "en" }),
      track({ id: "3", lang: "ar" }),
    ];
    const { visible } = groupPlayerTracks(tracks, {
      curated: CURATED_AUDIO_LANGUAGES,
      showAll: false,
    });
    expect(visible.map((group) => group.language.code)).toEqual(["ar", "en", "ja"]);
  });

  it("keeps a language-less track visible as 'undetermined' when showing all", () => {
    const { visible } = groupPlayerTracks([track({ id: "1" })], {
      curated: CURATED_AUDIO_LANGUAGES,
      showAll: true,
    });
    expect(visible[0]?.language.code).toBe("und");
  });
});

describe("groupSubtitleCandidates", () => {
  it("groups several downloads of one language into one expandable row", () => {
    const { visible } = groupSubtitleCandidates(
      [
        candidate({ fileId: 1, language: "en" }),
        candidate({ fileId: 2, language: "en" }),
        candidate({ fileId: 3, language: "ar" }),
      ],
      { curated: CURATED_SUBTITLE_LANGUAGES, showAll: false },
    );
    expect(visible.map((group) => [group.language.code, group.items.length])).toEqual([
      ["ar", 1],
      ["en", 2],
    ]);
  });
});

describe("trackVariantLabel", () => {
  it("prefers the container title and falls back to a numbered row", () => {
    expect(trackVariantLabel(track({ title: "SDH" }), 0)).toBe("SDH");
    expect(trackVariantLabel(track({ title: "  " }), 1)).toBe("المسار 2");
  });
});
