import { createFileRoute } from "@tanstack/react-router";
import { WorkDetailPage } from "@/features/platform/work-detail-page";

export const Route = createFileRoute("/titles_/$titleId/installments/$installmentId")({
  component: InstallmentRoute,
});

function InstallmentRoute() {
  const { titleId, installmentId } = Route.useParams();
  return <WorkDetailPage workId={titleId} initialInstallmentId={installmentId} />;
}
