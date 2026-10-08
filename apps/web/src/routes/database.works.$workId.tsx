import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { WorkDetailPage } from "@/features/editor/work/work-detail-page";
export const Route = createFileRoute("/database/works/$workId")({
  beforeLoad: ({ params }) => {
    z.string().uuid().parse(params.workId);
  },
  component: WorkRoute,
});
function WorkRoute() {
  const { workId } = Route.useParams();
  return <WorkDetailPage id={workId} />;
}
