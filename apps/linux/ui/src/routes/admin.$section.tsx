import { createFileRoute } from "@tanstack/react-router";

import { AdminSectionPage } from "../features/account/admin-page";
export const Route = createFileRoute("/admin/$section")({ component: Section });
function Section() {
  const { section } = Route.useParams();
  return <AdminSectionPage section={section} />;
}
