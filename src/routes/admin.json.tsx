import { createFileRoute } from "@tanstack/react-router";
import { JsonWorkspacePage } from "@/features/admin/pages/json-workspace-page";
export const Route = createFileRoute("/admin/json")({ component: JsonWorkspacePage });
