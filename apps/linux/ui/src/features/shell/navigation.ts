import { useSyncExternalStore } from "react";
export type ViewerRoute = { path: string; params: URLSearchParams; key: string };
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
function snapshot() {
  return window.location.hash || "#/home";
}
export function useViewerRoute(): ViewerRoute {
  const key = useSyncExternalStore(subscribe, snapshot);
  const [path, query] = key.replace(/^#/, "").split("?");
  return { path, params: new URLSearchParams(query), key };
}
export function workLink(id: string, installmentId?: string) {
  return `#/titles/${id}${installmentId ? `?installment=${encodeURIComponent(installmentId)}` : ""}`;
}
export function navigate(path: string) {
  window.location.hash = path;
}
export function replaceParams(path: string, params: URLSearchParams) {
  window.history.replaceState(null, "", `#${path}${params.size ? `?${params}` : ""}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
