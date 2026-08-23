import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/profiles")({
  component: () => <Navigate to="/admin/accounts" />,
});
