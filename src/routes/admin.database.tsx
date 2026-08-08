import { createFileRoute } from "@tanstack/react-router";
import { AdminDatabasePage } from "@/features/admin/pages/database-page";
export const Route = createFileRoute("/admin/database")({ component: AdminDatabasePage });
