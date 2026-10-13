import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { gateway } from "@/lib/bridge";

export const avatarChoices = [
  { key: "nahhasio-library.svg", label: "المكتبة" },
  { key: "nahhasio-orbit.svg", label: "العوالم" },
];
export function AccountAvatar({
  name,
  avatarKey,
  className,
  rounded = false,
}: {
  name: string;
  avatarKey: string;
  className?: string;
  rounded?: boolean;
}) {
  const supported = avatarChoices.some((avatar) => avatar.key === avatarKey);
  const image = useQuery({
    queryKey: ["account-avatar", avatarKey],
    queryFn: ({ signal }) => gateway.avatar(avatarKey, signal),
    enabled: supported,
    staleTime: Infinity,
  });
  return (
    <Avatar className={cn(rounded && "rounded-lg after:rounded-lg", className)}>
      <AvatarImage src={image.data} alt={`صورة ${name}`} className={cn(rounded && "rounded-lg")} />
      <AvatarFallback className={cn(rounded && "rounded-lg")}>
        {name.trim().charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
}
