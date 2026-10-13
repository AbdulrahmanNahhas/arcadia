import { createFileRoute } from "@tanstack/react-router";

import { workEditorSearchSchema } from "../features/admin/editor-search";
import { WorkEditorPage } from "../features/editor/work/work-editor-page";
export const Route = createFileRoute("/admin/works_/new")({
  validateSearch: workEditorSearchSchema,
  component: WorkEditorPage,
});
