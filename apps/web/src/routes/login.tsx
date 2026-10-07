import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/features/dashboard/login-page";
export const Route = createFileRoute("/login")({ component: LoginPage });
