import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/entities")({
  component: EntitiesLayout,
});

function EntitiesLayout() {
  return <Outlet />;
}
