import { createFileRoute } from "@tanstack/react-router";
import { ArchiveOperationsPage } from "@/features/admin/pages/archive-operations-page";

export const Route = createFileRoute("/admin/archive")({ component: ArchiveOperationsPage });
