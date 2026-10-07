import { createFileRoute } from "@tanstack/react-router";

import { SchemaGraphPage } from "@/features/database/schema-graph-page";

export const Route = createFileRoute("/database/graph")({ component: SchemaGraphPage });
