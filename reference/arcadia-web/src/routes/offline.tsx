import { createFileRoute } from "@tanstack/react-router";
import { OfflineLibraryPage } from "@/features/library/offline-library-page";

export const Route = createFileRoute("/offline")({
  component: OfflineLibraryPage,
});
