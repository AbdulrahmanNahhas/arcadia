import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MediaLibraryPage } from "@/features/admin/pages/media-library-page";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  health: z
    .enum(["healthy", "missing", "deletion-failed", "reused", "unused", "oversized"])
    .optional()
    .catch(undefined),
  role: z.enum(["poster", "banner", "logo", "profile"]).optional().catch(undefined),
});

export const Route = createFileRoute("/admin/media")({
  validateSearch: searchSchema,
  component: MediaRoute,
});

function MediaRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MediaLibraryPage
      filters={filters}
      onFiltersChange={(next) => void navigate({ search: next, replace: true })}
    />
  );
}
