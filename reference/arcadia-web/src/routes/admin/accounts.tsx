import { createFileRoute } from "@tanstack/react-router";
import { AdminAccountsPage } from "@/features/admin/pages/profiles-page";
export const Route = createFileRoute("/admin/accounts")({ component: AdminAccountsPage });
