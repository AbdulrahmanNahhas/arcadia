import { createFileRoute } from "@tanstack/react-router";
import { StudioPage } from "@/features/platform/studio-page";

export const Route = createFileRoute("/studios/$studioId")({ component: StudioRoute });

function StudioRoute() {
  const { studioId } = Route.useParams();
  return <StudioPage studioId={studioId} />;
}
