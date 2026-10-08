import { createFileRoute } from "@tanstack/react-router";

import { SchemaGraphPage } from "@/features/database/schema/schema-graph-page";

export const Route = createFileRoute("/database/graph")({ component: SchemaGraphPage });
