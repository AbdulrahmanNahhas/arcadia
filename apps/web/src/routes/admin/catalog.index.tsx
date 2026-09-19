import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { catalogGaps } from "@/features/admin/catalog-gaps";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { AdminCatalogPage } from "@/features/admin/pages/catalog-page";

export const Route = createFileRoute("/admin/catalog/")({
  validateSearch: z.object({ gap: z.enum(catalogGaps).optional().catch(undefined) }),
  component: CatalogRoute,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});

function CatalogRoute() {
  const { gap } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminCatalogPage gap={gap ?? null} onClearGap={() => void navigate({ search: {} })} />;
}
