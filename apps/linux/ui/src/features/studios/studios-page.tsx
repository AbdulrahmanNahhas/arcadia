import { EntityDirectoryPage } from "../catalog/entity-directory-page";
import { EntityWorksPage } from "../catalog/entity-works-page";

export function StudiosPage({ id, params }: { id?: string; params: URLSearchParams }) {
  return id ? (
    <EntityWorksPage type="studios" id={id} params={params} />
  ) : (
    <EntityDirectoryPage type="studios" params={params} />
  );
}
