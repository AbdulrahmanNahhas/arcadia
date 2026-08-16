import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginPage } from "@/features/accounts/login-page";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ next: z.string().optional() }),
  component: LoginPage,
});
