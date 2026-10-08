import { createFileRoute } from "@tanstack/react-router";

import { RevisionsPage } from "@/features/database/revisions/revisions-page";
export const Route = createFileRoute("/database/revisions")({ component: RevisionsPage });
