import { createFileRoute } from "@tanstack/react-router";
import { ImportExportPage } from "@/features/admin/pages/system-pages";
export const Route = createFileRoute("/admin/import-export")({ component: ImportExportPage });
