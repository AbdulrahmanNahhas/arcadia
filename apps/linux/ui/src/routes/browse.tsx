import { createFileRoute } from "@tanstack/react-router";

import { BrowsePage } from "../features/catalog/browse-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  return <BrowsePage params={route.params} />;
}
export const Route = createFileRoute("/browse")({ component: Page });
