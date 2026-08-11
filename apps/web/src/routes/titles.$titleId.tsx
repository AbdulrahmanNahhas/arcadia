import { createFileRoute } from "@tanstack/react-router";
import { WorkDetailPage } from "@/features/platform/work-detail-page";

export const Route = createFileRoute("/titles/$titleId")({ component: TitleRoute });

function TitleRoute() {
  const { titleId } = Route.useParams();
  return <WorkDetailPage workId={titleId} />;
}
