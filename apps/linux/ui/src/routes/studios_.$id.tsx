import { createFileRoute } from "@tanstack/react-router";

import { useViewerRoute } from "../features/shell/navigation";
import { StudiosPage } from "../features/studios/studios-page";
function Page() {
  const route = useViewerRoute();
  const { id } = Route.useParams();
  return <StudiosPage key={id} id={id} params={route.params} />;
}
export const Route = createFileRoute("/studios_/$id")({ component: Page });
