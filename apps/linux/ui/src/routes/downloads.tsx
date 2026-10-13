import { createFileRoute } from "@tanstack/react-router";

import { DownloadsPage } from "../features/player/downloads-page";

export const Route = createFileRoute("/downloads")({ component: DownloadsPage });
