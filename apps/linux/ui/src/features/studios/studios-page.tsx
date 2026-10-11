import { EntityDirectoryPage } from "../catalog/entity-directory-page";

export function StudiosPage({ id, params }: { id?: string; params: URLSearchParams }) {
  return <EntityDirectoryPage type="studios" id={id} params={params} />;
}
