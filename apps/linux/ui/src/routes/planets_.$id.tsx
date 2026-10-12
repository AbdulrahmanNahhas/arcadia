import { createFileRoute } from "@tanstack/react-router";

import { PlanetsPage } from "../features/planets/planets-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  const { id } = Route.useParams();
  return <PlanetsPage key={id} id={id} params={route.params} />;
}
export const Route = createFileRoute("/planets_/$id")({ component: Page });
