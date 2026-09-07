import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DatabasePage } from "@/features/platform/database-page";

const browseSearchSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
});

export const Route = createFileRoute("/browse")({
  validateSearch: browseSearchSchema,
  component: BrowseRoute,
});

function BrowseRoute() {
  const { q } = Route.useSearch();
  return <DatabasePage key={q ?? ""} initialQuery={q ?? ""} />;
}
