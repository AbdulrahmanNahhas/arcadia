import { createFileRoute } from "@tanstack/react-router";
import { WatchHubPage } from "@/features/library/watch/watch-hub-page";

export const Route = createFileRoute("/watch")({
  component: WatchHubPage,
});
