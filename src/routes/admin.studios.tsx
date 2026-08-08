import { createFileRoute } from "@tanstack/react-router";
import { EntitiesManagementPage } from "@/features/admin/pages/entities-management-page";
export const Route = createFileRoute("/admin/studios")({
  component: () => <EntitiesManagementPage kind="organization" />,
});
