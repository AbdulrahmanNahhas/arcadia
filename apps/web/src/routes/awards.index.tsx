import { createFileRoute } from "@tanstack/react-router";
import { AwardsPage } from "@/features/awards/awards-page";

export const Route = createFileRoute("/awards/")({
  component: AwardsPage,
});
