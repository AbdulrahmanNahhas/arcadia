import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DisplayBrowse } from "@/features/display/display-browse";
import { DatabasePage } from "@/features/platform/database-page";
import { useAppMode } from "@/lib/app-mode";

const browseSearchSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
});

export const Route = createFileRoute("/browse")({
  validateSearch: browseSearchSchema,
  component: BrowseRoute,
});

function BrowseRoute() {
  const { q } = Route.useSearch();
  const { isDisplay } = useAppMode();
  if (isDisplay) return <DisplayBrowse key={q ?? ""} initialQuery={q ?? ""} />;
  return <DatabasePage key={q ?? ""} initialQuery={q ?? ""} />;
}
