import { createFileRoute } from "@tanstack/react-router";
import { AdminNewWorkPage } from "@/features/admin/pages/new-work-page";

export const Route = createFileRoute("/admin/catalog_/new")({ component: AdminNewWorkPage });
