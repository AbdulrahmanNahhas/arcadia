import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { AwardsManagementPage } from "@/features/admin/pages/awards-management-page";

export const Route = createFileRoute("/admin/awards")({
  component: AwardsManagementPage,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});
