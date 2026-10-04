import type { TitleSummary } from "@arcadia/contracts";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { browseTitles, getPlanets } from "@/lib/api";

/**
 * Display Mode's data: everything pages through `/api/v1/titles` (SQL-paginated, visibility
 * applied server-side) — never the whole-catalog reads the desk pages still make. A Home of
 * five rails is five requests of 16–20 rows each.
 */
export const displayKeys = {
  all: ["display"] as const,
  rail: (name: string, params: Record<string, string | number>) =>
    [...displayKeys.all, "rail", name, params] as const,
  browse: (params: Record<string, string | number | undefined>) =>
    [...displayKeys.all, "browse", params] as const,
  search: (q: string) => [...displayKeys.all, "search", q] as const,
  planets: () => [...displayKeys.all, "planets"] as const,
};

export type BrowseSort = "title" | "release" | "score";

export interface RailParams {
  sort?: BrowseSort;
  planet?: string;
  genre?: string;
  limit?: number;
}

/** The query string for one page: only the facets that are actually set are sent. */
function browseQuery(params: {
  sort: BrowseSort;
  limit: number;
  offset: number;
  planet?: string;
  genre?: string;
  q?: string;
}) {
  const query = new Map<string, string | number>([
    ["mode", "titles"],
    ["sort", params.sort],
    ["limit", params.limit],
    ["offset", params.offset],
  ]);
  if (params.planet) query.set("planet", params.planet);
  if (params.genre) query.set("genre", params.genre);
  if (params.q) query.set("q", params.q);
  return Object.fromEntries(query);
}

function onlyTitles(items: Awaited<ReturnType<typeof browseTitles>>["items"]): TitleSummary[] {
  return items.filter((item): item is TitleSummary => "canonicalTitle" in item);
}

export const railQueryOptions = (name: string, params: RailParams) =>
  queryOptions({
    queryKey: displayKeys.rail(name, {
      sort: params.sort ?? "title",
      planet: params.planet ?? "",
      genre: params.genre ?? "",
      limit: params.limit ?? 20,
    }),
    queryFn: async () =>
      onlyTitles(
        (
          await browseTitles(
            browseQuery({
              sort: params.sort ?? "title",
              limit: params.limit ?? 20,
              offset: 0,
              planet: params.planet,
              genre: params.genre,
            }),
          )
        ).items,
      ),
    staleTime: 60_000,
  });

export const BROWSE_PAGE_SIZE = 48;

export const browseInfiniteQueryOptions = (params: {
  sort: BrowseSort;
  planet?: string;
  genre?: string;
  q?: string;
}) =>
  infiniteQueryOptions({
    queryKey: displayKeys.browse(params),
    queryFn: async ({ pageParam }) => {
      const page = await browseTitles(
        browseQuery({
          sort: params.sort,
          limit: BROWSE_PAGE_SIZE,
          offset: pageParam,
          planet: params.planet,
          genre: params.genre,
          q: params.q,
        }),
      );
      return { items: onlyTitles(page.items), total: page.total, offset: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + BROWSE_PAGE_SIZE < last.total ? last.offset + BROWSE_PAGE_SIZE : undefined,
    staleTime: 60_000,
  });

export const searchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: displayKeys.search(q),
    queryFn: async () =>
      onlyTitles(
        (await browseTitles(browseQuery({ sort: "title", limit: 40, offset: 0, q }))).items,
      ),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
  });

export const planetsQueryOptions = () =>
  queryOptions({ queryKey: displayKeys.planets(), queryFn: getPlanets, staleTime: 5 * 60_000 });

export function displayTitleOf(title: Pick<TitleSummary, "titleAr" | "canonicalTitle">) {
  return title.titleAr?.trim() || title.canonicalTitle;
}
