import { describe, expect, it } from "vitest";
import { AUTO_WATCHED_THRESHOLD, isAutoWatched, nextIsPlayed } from "./playback";

describe("isAutoWatched", () => {
  it("is false with no known duration", () => expect(isAutoWatched(500, null)).toBe(false));
  it("is false with a zero or negative duration", () => {
    expect(isAutoWatched(0, 0)).toBe(false);
    expect(isAutoWatched(10, -1)).toBe(false);
  });
  it("is false just under the threshold", () => expect(isAutoWatched(89, 100)).toBe(false));
  it("is true exactly at the threshold", () => expect(isAutoWatched(90, 100)).toBe(true));
  it("is true past the threshold", () => expect(isAutoWatched(3200, 3300)).toBe(true));
  it("uses the shared constant, not a hardcoded ratio", () =>
    expect(isAutoWatched(AUTO_WATCHED_THRESHOLD * 100, 100)).toBe(true));
});

describe("nextIsPlayed", () => {
  it("auto-computes from position/duration when never manually toggled", () => {
    expect(
      nextIsPlayed({
        positionSeconds: 95,
        durationSeconds: 100,
        previouslyPlayedManually: false,
        previouslyIsPlayed: false,
      }),
    ).toBe(true);
    expect(
      nextIsPlayed({
        positionSeconds: 10,
        durationSeconds: 100,
        previouslyPlayedManually: false,
        previouslyIsPlayed: false,
      }),
    ).toBe(false);
  });

  it("keeps a manual watched flag even when the fresh position is far below the threshold", () => {
    expect(
      nextIsPlayed({
        positionSeconds: 5,
        durationSeconds: 100,
        previouslyPlayedManually: true,
        previouslyIsPlayed: true,
      }),
    ).toBe(true);
  });

  it("keeps a manual unwatched flag even when the fresh position crosses the threshold", () => {
    expect(
      nextIsPlayed({
        positionSeconds: 99,
        durationSeconds: 100,
        previouslyPlayedManually: true,
        previouslyIsPlayed: false,
      }),
    ).toBe(false);
  });
});
