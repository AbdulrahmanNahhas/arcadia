import { createFileRoute } from "@tanstack/react-router";
import { DisplaySettings } from "@/features/display/display-settings";
import { SettingsPage } from "@/features/profiles/settings-page";
import { useAppMode } from "@/lib/app-mode";

export const Route = createFileRoute("/settings")({ component: SettingsRoute });

function SettingsRoute() {
  return useAppMode().isDisplay ? <DisplaySettings /> : <SettingsPage />;
}
