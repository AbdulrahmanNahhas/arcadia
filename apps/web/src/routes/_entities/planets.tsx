import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_entities/planets")({
  component: PlanetsLayout,
});

function PlanetsLayout() {
  return <Outlet />;
}
