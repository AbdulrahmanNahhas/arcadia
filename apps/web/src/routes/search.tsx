import { createFileRoute } from "@tanstack/react-router";
import { DisplaySearch } from "@/features/display/display-search";

/** Display Mode's search page; the desk keeps its global search in the header instead. */
export const Route = createFileRoute("/search")({
  component: DisplaySearch,
});
