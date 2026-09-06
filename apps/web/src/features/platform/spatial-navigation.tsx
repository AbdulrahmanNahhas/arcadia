import {
  GetBoundingClientRectAdapter,
  init,
  pause,
  ROOT_FOCUS_KEY,
  resume,
  SpatialNavigation,
} from "@noriginmedia/norigin-spatial-navigation-core";
import {
  FocusContext,
  type UseFocusableConfig,
  type UseFocusableResult,
  useFocusable,
} from "@noriginmedia/norigin-spatial-navigation-react";
import { type ReactNode, useEffect } from "react";

let initialized = false;
let automaticFocusKey = 0;

const AUTOMATIC_TARGET_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[role='button']",
  "[role='tab']",
  "[role='option']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function ensureSpatialNavigation() {
  if (initialized || import.meta.env.SSR) return;

  init({
    layoutAdapter: GetBoundingClientRectAdapter,
    rtl: true,
    shouldFocusDOMNode: true,
    domNodeFocusOptions: { preventScroll: true },
    throttle: 40,
    throttleKeypresses: false,
  });
  initialized = true;
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.matches(
    "input:not([type='button'], [type='checkbox'], [type='radio']), textarea, select",
  );
}

function isAutomaticTarget(element: HTMLElement) {
  if (element.closest("[data-spatial-navigation='off'], [inert]")) return false;
  if (element.matches("[data-spatial-managed], [disabled], [aria-disabled='true']")) return false;
  if (element.closest("[aria-hidden='true']")) return false;
  return element.getClientRects().length > 0;
}

export function revealSpatialTarget(node: HTMLElement) {
  const bounds = node.getBoundingClientRect();
  const headerBottom = document
    .querySelector<HTMLElement>("[data-platform-header]")
    ?.getBoundingClientRect().bottom;
  const safeTop = Math.max((headerBottom ?? 0) + 24, window.innerHeight * 0.18);
  const safeBottom = window.innerHeight * 0.82;
  const outsideVerticalSafeArea = bounds.top < safeTop || bounds.bottom > safeBottom;
  const outsideHorizontalSafeArea =
    bounds.left < window.innerWidth * 0.08 || bounds.right > window.innerWidth * 0.92;

  if (!outsideVerticalSafeArea && !outsideHorizontalSafeArea) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: outsideVerticalSafeArea ? "center" : "nearest",
    inline: outsideHorizontalSafeArea ? "center" : "nearest",
  });
}

function registerAutomaticTarget(element: HTMLElement, focusKey: string, forceFocus: boolean) {
  element.dataset.spatialAuto = "true";
  SpatialNavigation.addFocusable({
    focusKey,
    node: element,
    parentFocusKey: ROOT_FOCUS_KEY,
    onEnterPress: () => element.click(),
    onEnterRelease: () => undefined,
    onArrowPress: () => true,
    onArrowRelease: () => undefined,
    onFocus: () => revealSpatialTarget(element),
    onBlur: () => undefined,
    onUpdateFocus: () => undefined,
    onUpdateHasFocusedChild: () => undefined,
    saveLastFocusedChild: false,
    trackChildren: false,
    autoRestoreFocus: true,
    forceFocus,
    focusable: true,
    isFocusBoundary: false,
  });
}

function AutomaticSpatialTargets() {
  useEffect(() => {
    const registered = new Map<HTMLElement, string>();
    let scanFrame = 0;
    let registeredPathname = "";

    const scan = () => {
      scanFrame = 0;
      const pathname = window.location.pathname;
      const routeChanged = pathname !== registeredPathname;
      const automaticNavigationEnabled =
        !pathname.startsWith("/admin") && !pathname.startsWith("/player/");
      const candidates = automaticNavigationEnabled
        ? Array.from(document.querySelectorAll<HTMLElement>(AUTOMATIC_TARGET_SELECTOR)).filter(
            isAutomaticTarget,
          )
        : [];
      const candidateSet = new Set(candidates);

      for (const [element, focusKey] of registered) {
        if (candidateSet.has(element)) continue;
        SpatialNavigation.removeFocusable({ focusKey });
        element.removeAttribute("data-spatial-auto");
        registered.delete(element);
      }

      const explicitInitial = candidates.find((element) =>
        element.hasAttribute("data-spatial-initial"),
      );
      const mainInitial = candidates.find((element) => element.closest("#main-content"));
      const initialTarget = explicitInitial ?? mainInitial ?? candidates[0];

      for (const element of candidates) {
        if (registered.has(element)) continue;
        automaticFocusKey += 1;
        const focusKey = `arcadia:auto:${automaticFocusKey}`;
        registerAutomaticTarget(element, focusKey, element === initialTarget);
        registered.set(element, focusKey);
      }

      const initialFocusKey = initialTarget ? registered.get(initialTarget) : undefined;
      if (routeChanged && initialFocusKey && (explicitInitial || mainInitial)) {
        registeredPathname = pathname;
        void SpatialNavigation.setFocus(initialFocusKey);
      }
    };

    const scheduleScan = () => {
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(scan);
    };
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-disabled", "aria-hidden", "disabled", "hidden", "inert"],
    });
    scan();

    return () => {
      observer.disconnect();
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      for (const [element, focusKey] of registered) {
        SpatialNavigation.removeFocusable({ focusKey });
        element.removeAttribute("data-spatial-auto");
      }
    };
  }, []);

  return null;
}

/**
 * Owns Arcadia's integration boundary with the spatial-navigation engine.
 *
 * Text entry keeps native arrow-key behavior. Browse controls opt in through
 * `useSpatialFocusable`, while player-specific controls can pause the engine.
 */
export function SpatialNavigationRoot({ children }: { children: ReactNode }) {
  ensureSpatialNavigation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTextEntryTarget(event.target)) {
        resume();
        return;
      }
      if (event.key === "Escape" && event.target instanceof HTMLElement) {
        event.target.blur();
        event.preventDefault();
        resume();
        return;
      }
      pause();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isTextEntryTarget(event.target)) pause();
      else resume();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!isTextEntryTarget(event.relatedTarget)) resume();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <>
      <AutomaticSpatialTargets />
      {children}
    </>
  );
}

export function useSpatialFocusable<P = object, E = HTMLElement>(
  config: UseFocusableConfig<P> = {},
): UseFocusableResult<E> {
  ensureSpatialNavigation();
  return useFocusable<P, E>(config);
}

export { FocusContext, pause as pauseSpatialNavigation, resume as resumeSpatialNavigation };
