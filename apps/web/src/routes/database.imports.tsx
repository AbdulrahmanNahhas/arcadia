import { createFileRoute } from "@tanstack/react-router";

import { ImportsPage } from "@/features/database/imports-page";
export const Route = createFileRoute("/database/imports")({ component: ImportsPage });
