import { createFileRoute } from "@tanstack/react-router";
import { PlatformHome } from "@/features/platform/platform-home";

export const Route = createFileRoute("/")({ component: PlatformHome });
