import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkEditorPage } from "@/features/admin/pages/work-editor-page";

export const Route = createFileRoute("/admin/catalog/$workId")({ component: WorkEditorRoute });

function WorkEditorRoute() {
  const { workId } = Route.useParams();
  return <AdminWorkEditorPage workId={workId} />;
}
