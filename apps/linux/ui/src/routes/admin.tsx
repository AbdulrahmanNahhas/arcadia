import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "../features/account/admin-page";
export const Route = createFileRoute("/admin")({ component: AdminPage });
