import { createFileRoute } from "@tanstack/react-router";
import { MediaLibraryPage } from "@/features/admin/pages/media-library-page";
export const Route = createFileRoute("/admin/media")({ component: MediaLibraryPage });
