import { describe, expect, it } from "vitest";
import { titleReleaseStatusFromInstallments } from "./repository";

describe("titleReleaseStatusFromInstallments", () => {
  it.each([
    [["announced"], "upcoming"],
    [["airing"], "airing"],
    [["completed", "announced"], "returning"],
    [["completed"], "completed"],
    [["unknown", "completed"], "unknown"],
    [[], "unknown"],
  ] as const)("calculates %j as %s", (installments, expected) => {
    expect(titleReleaseStatusFromInstallments(installments)).toBe(expected);
  });
});
