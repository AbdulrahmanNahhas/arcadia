import { createFileRoute } from "@tanstack/react-router";
import { VocabulariesPage } from "@/features/admin/pages/vocabularies-page";
export const Route = createFileRoute("/admin/vocabularies")({ component: VocabulariesPage });
