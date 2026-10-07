import { describe, expect, it } from "vitest";
import { type PlayableInstallment, unplayableReason } from "./play-button";

/**
 * `unplayableReason` is the single gate every play control in the app routes through
 * (`PlayFilmButton`, used by both the work-detail hero and the episode-tab installment card).
 * These are the two regressions Phase C exists to close: a film with no catalog identifier, and
 * one that has merely been announced, must never resolve to a live `/player/...` link.
 */
describe("unplayableReason", () => {
  const releasedYesterday = Date.now() - 24 * 60 * 60 * 1000;
  const releasedTomorrow = Date.now() + 24 * 60 * 60 * 1000;

  const playable: PlayableInstallment = {
    releaseStatus: "completed",
    releaseAt: releasedYesterday,
    imdbId: "tt0133093",
    tmdbId: null,
  };

  it("allows a released film that carries an IMDb id", () => {
    expect(unplayableReason(playable)).toBeNull();
  });

  it("allows a released film that carries only a TMDB id", () => {
    expect(unplayableReason({ ...playable, imdbId: null, tmdbId: 603 })).toBeNull();
  });

  it("blocks a released film with neither an IMDb nor a TMDB id", () => {
    expect(unplayableReason({ ...playable, imdbId: null, tmdbId: null })).toBe(
      "لا يتوفر معرّف تشغيل بعد",
    );
  });

  it("blocks a film whose release status is still 'announced', even with an id on file", () => {
    expect(unplayableReason({ ...playable, releaseStatus: "announced" })).toBe("لم يُصدر بعد");
  });

  it("blocks a film with no release date recorded", () => {
    expect(unplayableReason({ ...playable, releaseAt: null })).toBe("لم يُصدر بعد");
  });

  it("blocks a film whose release date is in the future", () => {
    expect(unplayableReason({ ...playable, releaseAt: releasedTomorrow })).toBe("لم يُصدر بعد");
  });

  it("treats missing release/id fields (e.g. an omitted prop) as unreleased, not playable", () => {
    expect(unplayableReason({})).toBe("لم يُصدر بعد");
  });

  it("reports the unreleased reason ahead of the missing-id reason when both are true", () => {
    expect(unplayableReason({ releaseStatus: "announced", releaseAt: null })).toBe("لم يُصدر بعد");
  });
});
