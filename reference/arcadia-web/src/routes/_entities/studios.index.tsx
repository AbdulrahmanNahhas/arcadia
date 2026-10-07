import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/features/catalog/directory-page";

export const Route = createFileRoute("/_entities/studios/")({
  component: () => <DirectoryPage kind="studios" />,
});
