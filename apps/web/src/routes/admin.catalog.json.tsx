import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { CatalogJsonPage } from "@/features/admin/json-editor/json-editor-page";

const searchSchema = z.object({
  ids: z.array(z.string()).default([]),
  scope: z.enum(["ids", "all"]).default("ids"),
  preset: z.string().optional(),
});

export const Route = createFileRoute("/admin/catalog/json")({
  validateSearch: searchSchema,
  component: JsonEditorRoute,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});

function JsonEditorRoute() {
  const { ids, scope, preset } = Route.useSearch();
  return <CatalogJsonPage ids={ids} scope={scope} preset={preset} />;
}
