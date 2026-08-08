import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/feed")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/tracker" });
  },
});
