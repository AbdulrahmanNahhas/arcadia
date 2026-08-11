import { createFileRoute } from "@tanstack/react-router";
import { AdminProfilesPage } from "@/features/admin/pages/profiles-page";

export const Route = createFileRoute("/admin/profiles")({ component: AdminProfilesPage });
