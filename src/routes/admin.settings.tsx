import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/admin/pages/system-pages";
export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });
