import { createFileRoute } from "@tanstack/react-router";

import { SearchPage } from "../features/search/search-page";
import { useViewerRoute } from "../features/shell/navigation";
function Page() {
  const route = useViewerRoute();
  return <SearchPage params={route.params} />;
}
export const Route = createFileRoute("/search")({ component: Page });
