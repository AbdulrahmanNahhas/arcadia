import { createFileRoute } from "@tanstack/react-router";

import { JsonEditorPage } from "@/features/editor/json-editor-page";
export const Route = createFileRoute("/database/json")({ component: JsonEditorPage });
