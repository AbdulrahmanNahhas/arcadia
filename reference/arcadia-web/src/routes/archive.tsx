import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ArchiveHubPage } from "@/features/archive/archive-hub-page";
import { DisplaySpace } from "@/features/display/display-space";
import { useAppMode } from "@/lib/app-mode";

const archiveSearchSchema = z.object({
  tab: z
    .enum(["overview", "library", "history", "calendar", "family", "notifications"])
    .optional()
    .catch(undefined),
  filter: z.enum(["all", "saved", "favorites", "rated"]).optional().catch(undefined),
  sort: z
    .enum(["updated", "played", "title", "release", "rating", "progress"])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/archive")({
  validateSearch: archiveSearchSchema,
  component: ArchiveRoute,
});

function ArchiveRoute() {
  return useAppMode().isDisplay ? <DisplaySpace /> : <ArchiveHubPage />;
}
