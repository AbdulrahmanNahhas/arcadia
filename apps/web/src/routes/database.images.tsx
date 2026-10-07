import { createFileRoute } from "@tanstack/react-router";

import { ImagesPage } from "@/features/database/images-page";
export const Route = createFileRoute("/database/images")({ component: ImagesPage });
