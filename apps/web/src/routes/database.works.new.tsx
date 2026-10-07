import { createFileRoute } from "@tanstack/react-router";

import { WorkEditorPage } from "@/features/editor/work-editor-page";
export const Route = createFileRoute("/database/works/new")({ component: WorkEditorPage });
