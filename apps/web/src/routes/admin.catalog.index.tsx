import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { AdminCatalogPage } from "@/features/admin/pages/catalog-page";

export const Route = createFileRoute("/admin/catalog/")({
  component: AdminCatalogPage,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});
