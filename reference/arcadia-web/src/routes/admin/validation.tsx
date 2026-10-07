import { createFileRoute } from "@tanstack/react-router";
import { ValidationPage } from "@/features/admin/pages/validation-page";
export const Route = createFileRoute("/admin/validation")({ component: ValidationPage });
