import { EntityDirectoryPage } from "../catalog/entity-directory-page";
import { EntityWorksPage } from "../catalog/entity-works-page";

export function PeoplePage({ id, params }: { id?: string; params: URLSearchParams }) {
  return id ? (
    <EntityWorksPage type="contributors" id={id} params={params} />
  ) : (
    <EntityDirectoryPage type="contributors" params={params} />
  );
}
