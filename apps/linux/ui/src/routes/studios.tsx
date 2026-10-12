import { createFileRoute } from "@tanstack/react-router";

import { useViewerRoute } from "../features/shell/navigation";
import { StudiosPage } from "../features/studios/studios-page";
function Page() {
  const route = useViewerRoute();
  return <StudiosPage params={route.params} />;
}
export const Route = createFileRoute("/studios")({ component: Page });
