import { createFileRoute } from "@tanstack/react-router";
import { AwardOrganizationPage } from "@/features/awards/award-detail-page";

export const Route = createFileRoute("/awards/$organizationSlug")({
  component: AwardOrganizationRoute,
});

function AwardOrganizationRoute() {
  const { organizationSlug } = Route.useParams();
  return <AwardOrganizationPage organizationSlug={organizationSlug} />;
}
