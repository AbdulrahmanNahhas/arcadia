import { createFileRoute } from "@tanstack/react-router";
import { MaintenancePage } from "@/features/admin/pages/maintenance-page";

export const Route = createFileRoute("/admin/archive")({ component: MaintenancePage });
