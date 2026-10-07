import { createFileRoute } from "@tanstack/react-router";

import { MaintenancePage } from "@/features/database/maintenance-page";
export const Route = createFileRoute("/database/validation")({ component: MaintenancePage });
