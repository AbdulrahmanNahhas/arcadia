import { createFileRoute } from "@tanstack/react-router";
import { OfflineTitlePage } from "@/features/library/offline-title-page";

export const Route = createFileRoute("/offline_/$titleId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { titleId } = Route.useParams();
  return <OfflineTitlePage titleId={titleId} />;
}
