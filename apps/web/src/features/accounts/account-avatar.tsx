import type { AvatarKey } from "@arcadia/contracts";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const positions: Record<AvatarKey, string> = {
  "orbit-1": "0% 0%",
  "orbit-2": "50% 0%",
  "orbit-3": "100% 0%",
  "orbit-4": "0% 100%",
  "orbit-5": "50% 100%",
};

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
      <span
        role="img"
        aria-label={label}
        className="size-full rounded-full bg-cover"
        style={{
          backgroundImage: "url('/media/account-avatar-sprite.webp')",
          backgroundPosition: positions[avatarKey],
          backgroundSize: "300% 200%",
        }}
      />
    </Avatar>
  );
}
