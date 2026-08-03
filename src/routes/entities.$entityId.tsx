import { createFileRoute } from "@tanstack/react-router";
import { EntityDetailPage } from "@/features/entities/entity-detail-page";

export const Route = createFileRoute("/entities/$entityId")({
  component: EntityRoute,
});

function EntityRoute() {
  const { entityId } = Route.useParams();
  return <EntityDetailPage entityId={entityId} />;
}
