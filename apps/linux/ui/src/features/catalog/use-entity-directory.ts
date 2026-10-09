import { useQuery } from "@tanstack/react-query";

import { gateway } from "../../lib/bridge";

export function useEntityDirectory(key: "contributors" | "studios") {
  const result = useQuery({
    queryKey: ["catalog", "facets", "works", "public"],
    queryFn: ({ signal }) => gateway.facets({ view: "works", privacy: "public" }, signal),
  });
  return {
    ...result,
    entities: result.data?.groups.find((group) => group.key === key)?.options ?? [],
  };
}
