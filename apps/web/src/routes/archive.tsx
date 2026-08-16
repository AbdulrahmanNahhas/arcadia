import { createFileRoute } from "@tanstack/react-router";
import { ArchiveHubPage } from "@/features/archive/archive-hub-page";

export const Route = createFileRoute("/archive")({ component: ArchiveHubPage });
