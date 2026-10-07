import { createFileRoute, redirect } from "@tanstack/react-router";
import { currentAccountQueryOptions } from "@/features/accounts/api";
import { AdminShell } from "@/features/admin/admin-shell";

export const Route = createFileRoute("/admin")({
  // Family profiles never load the admin bundle: the role is checked before the route resolves,
  // and a missing session goes to sign-in with a way back. AdminShell keeps its own gate for the
  // in-page capability messaging.
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient
      .ensureQueryData(currentAccountQueryOptions())
      .catch(() => null);
    if (!session) throw redirect({ to: "/login", search: { next: location.href } });
    const role = session.account.role;
    if (role !== "owner" && role !== "editor") throw redirect({ to: "/" });
  },
  component: AdminShell,
});
