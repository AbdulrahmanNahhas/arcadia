import { createFileRoute } from "@tanstack/react-router";
import { DownloadsPage } from "@/features/library/downloads/downloads-page";

export const Route = createFileRoute("/downloads")({
  component: DownloadsPage,
});
