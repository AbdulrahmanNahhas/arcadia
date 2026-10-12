import { createFileRoute } from "@tanstack/react-router";

import { PeoplePage } from "../features/people/people-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  return <PeoplePage params={route.params} />;
}
export const Route = createFileRoute("/people")({ component: Page });
