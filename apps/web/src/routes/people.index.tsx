import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/features/catalog/directory-page";

export const Route = createFileRoute("/people/")({
  component: () => <DirectoryPage kind="people" />,
});
