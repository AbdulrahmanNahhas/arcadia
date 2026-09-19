import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AdminRouteError, AdminRoutePending } from "@/features/admin/components/admin-route-states";
import { EpisodeEditorPage } from "@/features/admin/pages/episode-editor-page";

export const Route = createFileRoute("/admin/catalog/$workId_/episodes")({
  validateSearch: z.object({ installment: z.string().uuid().optional().catch(undefined) }),
  component: EpisodesRoute,
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
});

function EpisodesRoute() {
  const { workId } = Route.useParams();
  const { installment } = Route.useSearch();
  return <EpisodeEditorPage workId={workId} installmentId={installment ?? null} />;
}
