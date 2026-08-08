import { createFileRoute } from "@tanstack/react-router";
import { AdminTrackingEntryPage } from "@/features/admin/pages/tracker-page";
export const Route = createFileRoute("/admin/tracker_/new")({ component: AdminTrackingEntryPage });
