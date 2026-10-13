import { createFileRoute } from "@tanstack/react-router";

import { worksSearchSchema } from "../features/admin/works-model";
import { AdminWorksPage } from "../features/admin/works-page";
export const Route = createFileRoute("/admin/works")({
  validateSearch: worksSearchSchema,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminWorksPage
      search={search}
      onChange={(patch) =>
        void navigate({
          search: (previous) => ({ ...previous, ...patch, page: patch.page ?? "1" }),
          resetScroll: true,
        })
      }
    />
  );
}
