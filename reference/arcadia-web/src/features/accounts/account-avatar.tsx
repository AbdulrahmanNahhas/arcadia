import type { AvatarKey } from "@arcadia/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const accentColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

const legacyAvatarAssets = {
  "orbit-1": "anon-1.png",
  "orbit-2": "anon-2.png",
  "orbit-3": "anon-3.png",
  "orbit-4": "anon-4.png",
  "orbit-5": "anon-5.png",
} as const;

function isLegacyAvatarKey(avatarKey: AvatarKey): avatarKey is keyof typeof legacyAvatarAssets {
  return avatarKey in legacyAvatarAssets;
}

function avatarSource(avatarKey: AvatarKey) {
  const assetKey = isLegacyAvatarKey(avatarKey) ? legacyAvatarAssets[avatarKey] : avatarKey;
  return `/media/avatars/${assetKey}`;
}

/** A stable decorative accent for pickers; the image and account name remain the identity. */
export function avatarAccentFor(avatarKey: AvatarKey) {
  let hash = 0;
  for (const character of avatarKey) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return accentColors[hash % accentColors.length] ?? "var(--primary)";
}

export function AccountAvatar({
  avatarKey,
  label,
  className,
}: {
  avatarKey: AvatarKey;
  label: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-12 bg-background", className)}>
      <AvatarImage src={avatarSource(avatarKey)} alt={label} loading="lazy" />
      <AvatarFallback aria-label={label}>{label.trim().at(0) ?? "؟"}</AvatarFallback>
    </Avatar>
  );
}
