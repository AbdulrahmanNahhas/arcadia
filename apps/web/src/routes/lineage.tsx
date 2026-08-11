import { createFileRoute } from "@tanstack/react-router";
import { StudioLineagePage } from "@/features/platform/studio-lineage-page";

export const Route = createFileRoute("/lineage")({ component: StudioLineagePage });
