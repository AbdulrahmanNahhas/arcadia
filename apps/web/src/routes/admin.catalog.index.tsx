import { createFileRoute } from "@tanstack/react-router";
import { AdminCatalogPage } from "@/features/admin/pages/catalog-page";

export const Route = createFileRoute("/admin/catalog/")({ component: AdminCatalogPage });
