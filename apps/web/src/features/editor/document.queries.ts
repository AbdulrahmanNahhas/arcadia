import { queryOptions } from "@tanstack/react-query";

import { loadWorks } from "./document.functions";

export const workSnapshotsOptions = (ids: string[]) =>
  queryOptions({
    queryKey: ["database", "work-documents", ids],
    queryFn: ({ signal }) => loadWorks({ data: { ids }, signal }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
