import { createFileRoute } from "@tanstack/react-router";

import { AdminSectionPage } from "../features/account/admin-page";
export const Route = createFileRoute("/admin/")({ component: AdminSectionPage });
