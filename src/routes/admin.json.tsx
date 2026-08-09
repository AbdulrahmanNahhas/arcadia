import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/json")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/catalog" });
  },
});
