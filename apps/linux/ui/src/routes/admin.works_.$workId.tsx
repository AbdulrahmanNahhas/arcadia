import { createFileRoute } from "@tanstack/react-router";

import { workEditorSearchSchema } from "../features/admin/editor-search";
import { WorkDetailPage } from "../features/editor/work/work-detail-page";
export const Route = createFileRoute("/admin/works_/$workId")({
  validateSearch: workEditorSearchSchema,
  component: Page,
});
function Page() {
  const { workId } = Route.useParams();
  return <WorkDetailPage id={workId} />;
}
