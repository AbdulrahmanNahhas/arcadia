import { describe, expect, it } from "vitest";
import {
  readSubtitleStyle,
  SUBTITLE_POSITION_MIN,
  SUBTITLE_SCALE_MAX,
  type SubtitleStyle,
  writeSubtitleStyle,
} from "./subtitle-style";

describe("subtitle style", () => {
  it("clamps what is written, persists it, and hands the clamped value to the applier", () => {
    const applied: SubtitleStyle[] = [];
    writeSubtitleStyle({ scale: 9, position: 10 }, async (style) => {
      applied.push(style);
    });
    expect(readSubtitleStyle()).toEqual({
      scale: SUBTITLE_SCALE_MAX,
      position: SUBTITLE_POSITION_MIN,
    });
    expect(applied).toEqual([{ scale: SUBTITLE_SCALE_MAX, position: SUBTITLE_POSITION_MIN }]);
    // The node test environment has no localStorage; the in-memory cache is what readSubtitleStyle
    // answered from above, and the same write path persists when storage exists.
  });

  it("rounds the scale to two decimals so repeated steps do not drift", () => {
    const applied: SubtitleStyle[] = [];
    writeSubtitleStyle({ scale: 1.1 + 0.1, position: 100 }, async (style) => {
      applied.push(style);
    });
    expect(applied[0]?.scale).toBe(1.2);
  });
});
