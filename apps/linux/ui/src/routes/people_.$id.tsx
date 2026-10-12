import { createFileRoute } from "@tanstack/react-router";

import { PeoplePage } from "../features/people/people-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  const { id } = Route.useParams();
  return <PeoplePage key={id} id={id} params={route.params} />;
}
export const Route = createFileRoute("/people_/$id")({ component: Page });
