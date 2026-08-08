import { createFileRoute } from "@tanstack/react-router";
import { AdminTrackerPage } from "@/features/admin/pages/tracker-page";
export const Route = createFileRoute("/admin/tracker")({ component: AdminTrackerPage });
