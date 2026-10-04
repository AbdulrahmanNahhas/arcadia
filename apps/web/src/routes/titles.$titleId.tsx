import { createFileRoute } from "@tanstack/react-router";
import { DisplayTitle } from "@/features/display/display-title";
import { WorkDetailPage } from "@/features/platform/work-detail-page";
import { useAppMode } from "@/lib/app-mode";

export const Route = createFileRoute("/titles/$titleId")({ component: TitleRoute });

function TitleRoute() {
  const { titleId } = Route.useParams();
  const { isDisplay } = useAppMode();
  if (isDisplay) return <DisplayTitle key={titleId} titleId={titleId} />;
  return <WorkDetailPage workId={titleId} />;
}
