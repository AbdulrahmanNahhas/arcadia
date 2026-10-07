import { createFileRoute } from "@tanstack/react-router";
import { PersonPage } from "@/features/platform/person-page";

export const Route = createFileRoute("/_entities/people/$personId")({ component: PersonRoute });

function PersonRoute() {
  const { personId } = Route.useParams();
  return <PersonPage personId={personId} />;
}
