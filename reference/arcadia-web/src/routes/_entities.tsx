import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_entities")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
