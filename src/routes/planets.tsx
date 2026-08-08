import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/planets")({
  component: PlanetsLayout,
});

function PlanetsLayout() {
  return <Outlet />;
}
