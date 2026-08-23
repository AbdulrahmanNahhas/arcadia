import { createFileRoute } from "@tanstack/react-router";
import { PlanetsManagementPage } from "@/features/admin/pages/planets-management-page";

export const Route = createFileRoute("/admin/planets")({ component: PlanetsManagementPage });
