import { createFileRoute } from "@tanstack/react-router";
import { DatabasePage } from "@/features/platform/database-page";

export const Route = createFileRoute("/browse")({ component: DatabasePage });
