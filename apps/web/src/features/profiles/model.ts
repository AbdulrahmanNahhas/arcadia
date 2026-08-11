import type { Classification } from "@arcadia/domain";

export type DemoProfile = {
  id: string;
  accountKind: "admin" | "family" | "individual";
  name: string;
  initials: string;
  description: string;
  policy: Classification;
};

export const demoProfiles: DemoProfile[] = [
  {
    id: "demo-admin",
    accountKind: "admin",
    name: "مدير أركاديا",
    initials: "أ",
    description: "كل العناوين وأدوات إدارة الكتالوج",
    policy: {
      audience: "adult",
      age: "18+",
      sexuality: "high",
      behavioral: "high",
      theology: "high",
    },
  },
  {
    id: "demo-family",
    accountKind: "family",
    name: "ليلة العائلة",
    initials: "ع",
    description: "اختيارات عائلية بصوت عربي أولاً",
    policy: {
      audience: "teen",
      age: "13+",
      sexuality: "low",
      behavioral: "medium",
      theology: "low",
    },
  },
  {
    id: "demo-individual",
    accountKind: "individual",
    name: "المستكشف",
    initials: "م",
    description: "ملف فردي مرن للأنمي والأفلام",
    policy: {
      audience: "young-adult",
      age: "16+",
      sexuality: "medium",
      behavioral: "high",
      theology: "medium",
    },
  },
];

export type LocalSettings = {
  arabicOnly: boolean;
  subtitles: boolean;
  canSwitchTracks: boolean;
  theme: "dark" | "light";
  policy?: Classification;
};
export const defaultSettings: LocalSettings = {
  arabicOnly: false,
  subtitles: true,
  canSwitchTracks: true,
  theme: "dark",
};
export const selectedProfileKey = "arcadia:demo-profile";
export const settingsKey = (profileId: string) => `arcadia:settings:${profileId}`;

export function currentProfile(): DemoProfile {
  const fallback = demoProfiles.find((profile) => profile.id === "demo-family");
  if (!fallback) throw new Error("Demo family profile fixture is missing");
  if (typeof window === "undefined") return fallback;
  const id = window.localStorage.getItem(selectedProfileKey);
  return demoProfiles.find((profile) => profile.id === id) ?? fallback;
}

export function readSettings(profileId: string): LocalSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(window.localStorage.getItem(settingsKey(profileId)) ?? "{}"),
    };
  } catch {
    return defaultSettings;
  }
}

export function localPolicy(profile: DemoProfile) {
  return readSettings(profile.id).policy ?? profile.policy;
}
