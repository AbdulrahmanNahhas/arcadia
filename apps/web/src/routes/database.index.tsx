import { createFileRoute } from "@tanstack/react-router";

import { DatabaseOverview } from "@/features/database/database-overview";
export const Route = createFileRoute("/database/")({ component: DatabaseOverview });
