import { createFileRoute } from "@tanstack/react-router";

import { DashboardHome } from "@/features/dashboard/home/dashboard-home";
export const Route = createFileRoute("/")({ component: DashboardHome });
