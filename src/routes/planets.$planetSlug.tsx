import { createFileRoute } from "@tanstack/react-router";
import { PlanetDetailPage } from "@/features/platform/planet-detail-page";

export const Route = createFileRoute("/planets/$planetSlug")({ component: PlanetRoute });

function PlanetRoute() {
  const { planetSlug } = Route.useParams();
  return <PlanetDetailPage slug={planetSlug} />;
}
