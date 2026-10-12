import { useRouterState } from "@tanstack/react-router";

import { router } from "../../app/router";

export function entityLink(key: "planets" | "contributors" | "studios", value: string) {
  return `#/${key === "contributors" ? "people" : key}/${encodeURIComponent(value)}`;
}
export type ViewerRoute = { path: string; params: URLSearchParams; key: string };
export function useViewerRoute(): ViewerRoute {
  const location = useRouterState({ select: (state) => state.location });
  return {
    path: location.pathname,
    params: new URLSearchParams(location.searchStr),
    key: `${location.pathname}${location.searchStr}`,
  };
}
export function workLink(id: string, installmentId?: string) {
  return `#/titles/${id}${installmentId ? `?installment=${encodeURIComponent(installmentId)}` : ""}`;
}
export function navigate(path: string) {
  void router.navigate({ href: path, resetScroll: false });
}
function focusSearch() {
  window.dispatchEvent(new Event("nahhasio:focus-search"));
}
export function openSearch(focusAfterNavigation = false) {
  if (router.state.location.pathname === "/search") {
    focusSearch();
    return;
  }
  void router.navigate({ href: "/search", resetScroll: false }).then(() => {
    if (focusAfterNavigation) requestAnimationFrame(focusSearch);
    return undefined;
  });
}
export function replaceParams(path: string, params: URLSearchParams) {
  void router.navigate({
    href: `${path}${params.size ? `?${params}` : ""}`,
    replace: true,
    resetScroll: false,
  });
}
