import { EntityDirectoryPage } from "../catalog/entity-directory-page";

export function PeoplePage({ id, params }: { id?: string; params: URLSearchParams }) {
  return <EntityDirectoryPage type="contributors" id={id} params={params} />;
}
