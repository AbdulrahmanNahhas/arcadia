import { createFileRoute } from "@tanstack/react-router";

import { EpisodesPage } from "../features/episodes/episodes-page";
import { useViewerRoute } from "../features/shell/navigation";

function Page() {
  const route = useViewerRoute();
  return <EpisodesPage params={route.params} />;
}

export const Route = createFileRoute("/episodes")({ component: Page });
