import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "../routeTree.gen";
import { RouteFallback } from "./route-fallback";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
  },
});

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultErrorComponent: RouteFallback,
  defaultNotFoundComponent: RouteFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
