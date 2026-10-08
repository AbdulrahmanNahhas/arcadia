import { infiniteQueryOptions } from "@tanstack/react-query";
import type { z } from "zod";

import { worksInputSchema } from "@/features/catalog/works/works-model";
import { getWorksPage } from "@/features/database/data/database.functions";
import { databaseKeys } from "@/features/database/data/database.queries";
import { workScoreVersion } from "@/features/scoring/score-model";

export function worksPageOptions(input: Omit<z.input<typeof worksInputSchema>, "offset">) {
  const data = worksInputSchema.omit({ offset: true }).parse(input);
  return infiniteQueryOptions({
    queryKey: [...databaseKeys.records("titles"), "catalog", "infinite", workScoreVersion, data],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      getWorksPage({ data: { ...data, offset: pageParam }, signal }),
    getNextPageParam: (page) => {
      const next = page.offset + page.items.length;
      return page.items.length > 0 && next < page.total ? next : undefined;
    },
    staleTime: 30_000,
  });
}
