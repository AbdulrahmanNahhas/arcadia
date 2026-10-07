import { createFileRoute } from "@tanstack/react-router";

import { RevisionsPage } from "@/features/database/revisions-page";
export const Route = createFileRoute("/database/revisions")({ component: RevisionsPage });
