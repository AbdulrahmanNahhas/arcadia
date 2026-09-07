import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ArchiveHubPage } from "@/features/archive/archive-hub-page";

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
  component: ArchiveHubPage,
});
