import { createFileRoute } from "@tanstack/react-router";
import { PlanetsPage } from "@/features/platform/planets-page";

export const Route = createFileRoute("/_entities/planets/")({ component: PlanetsPage });
