import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/features/profiles/profiles-page";
export const Route = createFileRoute("/accounts")({ component: AccountsPage });
