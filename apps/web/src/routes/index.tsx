import { createFileRoute } from "@tanstack/react-router";
import { DisplayHome } from "@/features/display/display-home";
import { PlatformHome } from "@/features/platform/platform-home";
import { useAppMode } from "@/lib/app-mode";

export const Route = createFileRoute("/")({ component: HomeRoute });

function HomeRoute() {
  return useAppMode().isDisplay ? <DisplayHome /> : <PlatformHome />;
}
