import { describe, expect, it } from "vitest";
import { formatBytes, formatEpisodeCode, formatTime } from "./format";

describe("formatTime", () => {
  it("pads minutes only once an hour is shown", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3_725)).toBe("1:02:05");
  });

  it("treats garbage as the start", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-4)).toBe("0:00");
  });
});

describe("formatBytes", () => {
  it("switches units at a gigabyte", () => {
    expect(formatBytes(700 * 1024 ** 2)).toBe("700 م.ب");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.50 غ.ب");
  });
});

describe("formatEpisodeCode", () => {
  it("omits the season for a title with none", () => {
    expect(formatEpisodeCode(null, 3)).toBe("الحلقة 3");
    expect(formatEpisodeCode(2, 3)).toBe("الموسم 2 · الحلقة 3");
  });
});
