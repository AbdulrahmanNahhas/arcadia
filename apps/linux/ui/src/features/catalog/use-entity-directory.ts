import { useQuery } from "@tanstack/react-query";

import { gateway } from "../../lib/bridge";

export function useEntityDirectory(
  key: "contributors" | "studios" | "planets",
  privacy: "public" | "all" = "public",
) {
  const result = useQuery({
    queryKey: ["catalog", "facets", "works", privacy],
    queryFn: ({ signal }) => gateway.facets({ view: "works", privacy }, signal),
  });
  return {
    ...result,
    entities: result.data?.groups.find((group) => group.key === key)?.options ?? [],
  };
}
