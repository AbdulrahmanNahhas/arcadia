import { createFileRoute } from "@tanstack/react-router";

import { WatchPage } from "../features/watch/watch-page";
export const Route = createFileRoute("/watch")({ component: WatchPage });
