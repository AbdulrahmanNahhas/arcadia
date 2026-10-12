import { createFileRoute } from "@tanstack/react-router";

import { ReleasesPage } from "../features/releases/releases-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  return <ReleasesPage params={route.params} />;
}
export const Route = createFileRoute("/releases")({ component: Page });
