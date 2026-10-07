import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/awards")({
  component: AwardsLayout,
});

function AwardsLayout() {
  return <Outlet />;
}
