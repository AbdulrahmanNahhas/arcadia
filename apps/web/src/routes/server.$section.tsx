import { createFileRoute, notFound } from "@tanstack/react-router";

import { serverSectionFor } from "@/features/dashboard/navigation";
import { ServerSectionPage } from "@/features/dashboard/server-section-page";
export const Route = createFileRoute("/server/$section")({
  beforeLoad: ({ params }) => {
    const section = serverSectionFor(params.section);
    if (!section) throw notFound();
    return { section };
  },
  component: Page,
});
function Page() {
  const { section } = Route.useRouteContext();
  return <ServerSectionPage section={section} />;
}
