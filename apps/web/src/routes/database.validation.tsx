import { createFileRoute } from "@tanstack/react-router";

import { MaintenancePage } from "@/features/database/validation/maintenance-page";
export const Route = createFileRoute("/database/validation")({ component: MaintenancePage });
