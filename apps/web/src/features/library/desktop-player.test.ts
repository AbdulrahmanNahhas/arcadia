import { describe, expect, it } from "vitest";
import { knownLanguageTracks, type PlayerTrack } from "./desktop-player";

/**
 * Coverage for the one pure function in this module — everything else here talks to the Tauri IPC
 * boundary, which isn't unit-tested (see the player-page/player-controls manual test notes).
 */
function track(overrides: Partial<PlayerTrack>): PlayerTrack {
  return { id: "1", lang: null, title: null, selected: false, ...overrides };
}

describe("knownLanguageTracks", () => {
  it("keeps only the curated audio languages, labelled in Arabic", () => {
    const tracks = [
      track({ id: "1", lang: "jpn" }),
      track({ id: "2", lang: "fre" }),
      track({ id: "3", lang: "eng" }),
    ];
    expect(knownLanguageTracks(tracks, "audio")).toEqual([
      { ...tracks[0], label: "اليابانية" },
      { ...tracks[2], label: "الإنجليزية" },
    ]);
  });

  it("restricts subtitles to Arabic/English only, even languages audio would allow", () => {
    const tracks = [track({ id: "1", lang: "jpn" }), track({ id: "2", lang: "ara" })];
    expect(knownLanguageTracks(tracks, "sub")).toEqual([{ ...tracks[1], label: "العربية" }]);
  });

  it("drops a track with no language at all", () => {
    expect(knownLanguageTracks([track({ lang: null })], "audio")).toEqual([]);
  });
});
