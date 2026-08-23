import { createFileRoute } from "@tanstack/react-router";
import { StudioLineagePage } from "@/features/platform/studio-lineage-page";

export const Route = createFileRoute("/_entities/studios/relationships")({
  component: StudioLineagePage,
});
