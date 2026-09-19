import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { catalogGaps } from "@/features/admin/catalog-gaps";
import {
  type CatalogView,
  catalogFormats,
  catalogSorts,
  catalogStructures,
  catalogVisibilities,
  catalogWorkflows,
  isEmptyView,
  recallCatalogView,
  rememberCatalogView,
} from "@/features/admin/catalog-view";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { AdminCatalogPage } from "@/features/admin/pages/catalog-page";

const viewSchema = z.object({
  q: z.string().optional().catch(undefined),
  view: z.enum(["table", "grid"]).optional().catch(undefined),
  sort: z.enum(catalogSorts).optional().catch(undefined),
  structure: z.enum(catalogStructures).optional().catch(undefined),
  format: z.enum(catalogFormats).optional().catch(undefined),
  visibility: z.enum(catalogVisibilities).optional().catch(undefined),
  workflow: z.enum(catalogWorkflows).optional().catch(undefined),
  planet: z.string().optional().catch(undefined),
  gap: z.enum(catalogGaps).optional().catch(undefined),
});

export const Route = createFileRoute("/admin/catalog/")({
  validateSearch: viewSchema,
  // Opened bare (sidebar click, bookmark) → restore the last view this browser used.
  beforeLoad: ({ search }) => {
    if (!isEmptyView(search)) return;
    const remembered = recallCatalogView();
    if (remembered && !isEmptyView(remembered)) {
      // A `redirect` would loop on an invalid remembered value; the schema's `.catch` already
      // drops anything unknown, so the page simply receives the recalled view.
      return { recalled: viewSchema.parse(remembered) };
    }
    return;
  },
  component: CatalogRoute,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});

function CatalogRoute() {
  const search = Route.useSearch();
  const context = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const recalled = "recalled" in context ? context.recalled : null;
  const view: CatalogView = isEmptyView(search) && recalled ? recalled : search;
  return (
    <AdminCatalogPage
      view={view}
      onViewChange={(next) => {
        const cleaned = Object.fromEntries(
          Object.entries(next).filter(([, value]) => value !== undefined && value !== ""),
        );
        rememberCatalogView(cleaned);
        void navigate({ search: cleaned, replace: true });
      }}
    />
  );
}
