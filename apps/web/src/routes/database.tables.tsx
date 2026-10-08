import { createFileRoute } from "@tanstack/react-router";

import { TablesPage } from "@/features/database/records/tables-page";
export const Route = createFileRoute("/database/tables")({ component: TablesPage });
