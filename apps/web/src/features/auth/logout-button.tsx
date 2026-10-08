import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { logoutOwner } from "./auth.functions";

export function LogoutButton() {
  const router = useRouter();
  const logout = useMutation({
    mutationFn: () => logoutOwner(),
    onSuccess: async () => {
      router.options.context.queryClient.clear();
      await router.invalidate();
      await router.navigate({ to: "/login", replace: true });
    },
  });
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      title={logout.isError ? "تعذّر تسجيل الخروج؛ أعد المحاولة" : undefined}
    >
      <LogOutIcon data-icon="inline-start" />
      تسجيل الخروج
    </Button>
  );
}
