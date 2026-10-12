import { createFileRoute } from "@tanstack/react-router";

import { PlanetsPage } from "../features/planets/planets-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  return <PlanetsPage params={route.params} />;
}
export const Route = createFileRoute("/planets")({ component: Page });
