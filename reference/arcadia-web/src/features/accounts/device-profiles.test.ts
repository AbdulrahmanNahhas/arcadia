import { describe, expect, it } from "vitest";
import { readDeviceProfiles, rememberDeviceProfile } from "./device-profiles";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

function account(id: string, username: string | null, displayName = username ?? "Guest") {
  return {
    id,
    username,
    displayName,
    avatarKey: "orbit-1" as const,
  };
}

describe("device profiles", () => {
  it("keeps the most recently used profile first without storing credentials", () => {
    const storage = memoryStorage();
    rememberDeviceProfile(account("1", "one"), storage, new Date("2026-01-01"));
    rememberDeviceProfile(account("2", "two"), storage, new Date("2026-01-02"));
    rememberDeviceProfile(account("1", "one", "One updated"), storage, new Date("2026-01-03"));

    expect(readDeviceProfiles(storage)).toEqual([
      expect.objectContaining({ id: "1", displayName: "One updated", username: "one" }),
      expect.objectContaining({ id: "2", username: "two" }),
    ]);
    expect(JSON.stringify(readDeviceProfiles(storage))).not.toContain("password");
  });

  it("ignores malformed storage and accounts without usernames", () => {
    const storage = memoryStorage();
    storage.setItem("arcadia:device-profiles", "{broken");
    expect(readDeviceProfiles(storage)).toEqual([]);
    expect(rememberDeviceProfile(account("1", null), storage)).toEqual([]);
  });
});
