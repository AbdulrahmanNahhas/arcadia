import { createFileRoute } from "@tanstack/react-router";
import { RelationshipsPage } from "@/features/admin/pages/relationships-page";
export const Route = createFileRoute("/admin/relationships")({ component: RelationshipsPage });
