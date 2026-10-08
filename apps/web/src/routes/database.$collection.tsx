import { createFileRoute, notFound } from "@tanstack/react-router";

import { CollectionPage } from "@/features/database/records/collection-page";
import { collectionFor } from "@/features/database/records/collections";
export const Route = createFileRoute("/database/$collection")({
  beforeLoad: ({ params }) => {
    const collection = collectionFor(params.collection);
    if (!collection) throw notFound();
    return { collection };
  },
  component: Page,
});
function Page() {
  const { collection } = Route.useRouteContext();
  return <CollectionPage collection={collection} />;
}
