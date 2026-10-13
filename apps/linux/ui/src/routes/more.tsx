import { createFileRoute } from "@tanstack/react-router";

import { MorePage } from "../features/shell/more-page";

export const Route = createFileRoute("/more")({ component: MorePage });
