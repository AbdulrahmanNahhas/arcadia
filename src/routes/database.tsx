import { createFileRoute } from "@tanstack/react-router";
import { DatabasePage } from "@/features/platform/database-page";

export const Route = createFileRoute("/database")({ component: DatabaseRoute });

function DatabaseRoute() {
  return <DatabasePage />;
}
