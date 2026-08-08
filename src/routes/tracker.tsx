import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tracker")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/tracker" });
  },
});
