import { createFileRoute } from "@tanstack/react-router";
import { StatisticsPage } from "@/features/admin/pages/statistics-page";
export const Route = createFileRoute("/admin/statistics")({ component: StatisticsPage });
