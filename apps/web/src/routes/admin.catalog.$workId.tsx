import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { AdminWorkEditorPage } from "@/features/admin/pages/work-editor-page";

export const Route = createFileRoute("/admin/catalog/$workId")({
  component: WorkEditorRoute,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});

function WorkEditorRoute() {
  const { workId } = Route.useParams();
  return <AdminWorkEditorPage workId={workId} />;
}
