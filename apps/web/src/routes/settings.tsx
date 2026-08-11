import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/profiles/settings-page";
export const Route = createFileRoute("/settings")({ component: SettingsPage });
