import { avatarKeySchema, type FamilyAccount } from "@arcadia/contracts";
import { z } from "zod";

const DEVICE_PROFILES_KEY = "arcadia:device-profiles";
const MAX_DEVICE_PROFILES = 12;

const deviceProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarKey: avatarKeySchema,
  lastUsedAt: z.string(),
});
const deviceProfilesSchema = z.array(deviceProfileSchema);

export type DeviceProfile = z.infer<typeof deviceProfileSchema>;

type ProfileStorage = Pick<Storage, "getItem" | "setItem">;

export function readDeviceProfiles(storage: ProfileStorage): DeviceProfile[] {
  try {
    const parsed = deviceProfilesSchema.safeParse(
      JSON.parse(storage.getItem(DEVICE_PROFILES_KEY) ?? "[]"),
    );
    if (!parsed.success) return [];
    return parsed.data.toSorted((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  } catch {
    return [];
  }
}

export function rememberDeviceProfile(
  account: Pick<FamilyAccount, "id" | "username" | "displayName" | "avatarKey">,
  storage: ProfileStorage,
  now = new Date(),
): DeviceProfile[] {
  if (!account.username) return readDeviceProfiles(storage);
  const remembered: DeviceProfile = {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    avatarKey: account.avatarKey,
    lastUsedAt: now.toISOString(),
  };
  const profiles = [
    remembered,
    ...readDeviceProfiles(storage).filter((profile) => profile.id !== account.id),
  ].slice(0, MAX_DEVICE_PROFILES);
  storage.setItem(DEVICE_PROFILES_KEY, JSON.stringify(profiles));
  return profiles;
}
