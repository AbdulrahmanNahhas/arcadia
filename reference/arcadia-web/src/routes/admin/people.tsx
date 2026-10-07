import { createFileRoute } from "@tanstack/react-router";
import { EntitiesManagementPage } from "@/features/admin/pages/entities-management-page";
export const Route = createFileRoute("/admin/people")({
  component: () => <EntitiesManagementPage kind="person" />,
});
