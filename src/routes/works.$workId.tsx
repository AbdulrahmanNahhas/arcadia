import { createFileRoute } from "@tanstack/react-router";
import { WorkDetailPage } from "@/features/platform/work-detail-page";

export const Route = createFileRoute("/works/$workId")({ component: WorkRoute });

function WorkRoute() {
  const { workId } = Route.useParams();
  return <WorkDetailPage workId={workId} />;
}
