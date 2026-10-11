import { describe, expect, it } from "vitest";

import { episodeNumberLabel } from "./format";

describe("episode number labels", () => {
  it.each([
    ["5.00", "5"],
    ["5.0", "5"],
    ["5", "5"],
    ["12.50", "12.5"],
    ["12.05", "12.05"],
    ["0.00", "0"],
    ["12345678901234567890.00", "12345678901234567890"],
    ["3.1400", "3.14"],
    ["unknown", "unknown"],
    ["", ""],
    ["5.00 extra", "5.00 extra"],
  ])("formats %s without rounding or losing precision", (value, expected) => {
    expect(episodeNumberLabel(value)).toBe(expected);
  });
});
