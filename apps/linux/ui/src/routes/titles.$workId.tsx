import { createFileRoute } from "@tanstack/react-router";

import { useViewerRoute } from "../features/shell/navigation";
import { WorkPage } from "../features/work/work-page";
function Page() {
  const { workId } = Route.useParams();
  const route = useViewerRoute();
  return (
    <WorkPage
      key={workId}
      id={workId}
      installmentId={route.params.get("installment") ?? undefined}
    />
  );
}
export const Route = createFileRoute("/titles/$workId")({ component: Page });
