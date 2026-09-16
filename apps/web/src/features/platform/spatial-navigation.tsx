import {
  type Direction,
  type FocusableComponent,
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
type RememberedFocus = { focusKey: string; centerX: number; centerY: number };
const rememberedFocusByLocation = new Map<string, RememberedFocus>();

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
  if (element.matches("[role='tabpanel']")) return false;
  if (element.matches("[data-spatial-managed], [disabled], [aria-disabled='true']")) return false;
  if (element.closest("[aria-hidden='true']")) return false;
  return element.getClientRects().length > 0;
}

/** Moves spatial focus to `focusKey` if it's currently registered; a silent no-op otherwise. */
export function focusSpatialKey(focusKey: string) {
  if (SpatialNavigation.doesFocusableExist(focusKey)) {
    void SpatialNavigation.setFocus(focusKey);
  }
}

export function revealSpatialTarget(node: HTMLElement) {
  const bounds = node.getBoundingClientRect();
  const headerBottom = document
    .querySelector<HTMLElement>("[data-platform-header]")
    ?.getBoundingClientRect().bottom;
  const safeTop = Math.max((headerBottom ?? 0) + 24, window.innerHeight * 0.18);
  const safeBottom = window.innerHeight * 0.82;
  const outsideVerticalSafeArea = bounds.top < safeTop || bounds.bottom > safeBottom;

  // A narrow rail (a sidebar preview strip, not a full-width shelf) can clip its own first/last
  // card well inside the window's 8%/92% margins — those margins alone would never fire for a
  // card sitting mid-page in a two-column layout, even though the rail's own `overflow-x-auto`
  // has scrolled it out of sight. Checking the nearest `[data-spatial-rail]` track's own bounds
  // first catches that clipping; only a target outside any rail falls back to the window-relative
  // check (a full-bleed shelf, or a plain focusable that isn't inside a scroller at all).
  const rail = node.closest<HTMLElement>("[data-spatial-rail]");
  const railBounds = rail?.getBoundingClientRect();
  const outsideHorizontalSafeArea = railBounds
    ? bounds.left < railBounds.left || bounds.right > railBounds.right
    : bounds.left < window.innerWidth * 0.08 || bounds.right > window.innerWidth * 0.92;

  if (!outsideVerticalSafeArea && !outsideHorizontalSafeArea) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: outsideVerticalSafeArea ? "center" : "nearest",
    inline: outsideHorizontalSafeArea ? "center" : "nearest",
  });
}

/**
 * Pressing "down" out of a `[role='tab']` strip should reach that tab's own content before
 * anything rendered further down the page (a "similar titles" rail below the tabs, a sidebar,
 * whatever comes next in reading order) — the default distance-based navigation instead compares
 * every registered focusable's raw geometry, and a tab's own content sometimes loses that
 * comparison to something further away but more directly aligned underneath the strip (see the
 * "can't reach the cards below" note in `docs/v0.3-roadmap.md`). Finding the first focusable
 * inside the one currently-visible `[role='tabpanel']` and targeting it directly sidesteps that
 * geometry entirely; if the panel has nothing focusable in it, returning `null` falls back to the
 * library's own default behavior exactly as before.
 */
export function resolveTabPanelEscape(
  direction: Direction,
  _focusKey: string,
  siblings: FocusableComponent[],
): FocusableComponent | null {
  if (direction !== "down") return null;
  const panel = Array.from(document.querySelectorAll<HTMLElement>("[role='tabpanel']")).find(
    (candidate) => candidate.getClientRects().length > 0,
  );
  if (!panel) return null;
  const inPanel = siblings.flatMap((sibling) =>
    sibling.node && panel.contains(sibling.node)
      ? [{ sibling, top: sibling.node.getBoundingClientRect().top }]
      : [],
  );
  if (!inPanel.length) return null;
  return inPanel.reduce((topmost, entry) => (entry.top < topmost.top ? entry : topmost)).sibling;
}

/**
 * Pressing "down" from an episode card in the bottom row of the (`data-spatial-episode-grid`)
 * preview grid should reach the centered "show all episodes" control right below it
 * (`data-spatial-episode-actions`) — a `sm:grid-cols-2 xl:grid-cols-3` grid means most cards in
 * that row don't sit under the centered button at all, and the default distance search skips right
 * past it to whatever's next down the page (a recommendations rail, `docs/v0.3-roadmap.md`'s same
 * "not obviously below" problem `resolveTabPanelEscape` solves for the tab strip). Only actually
 * redirects when nothing else registered inside the grid sits below the pressed card, i.e. this
 * really is the bottom row; every other "down" press inside the grid still moves row to row
 * normally.
 */
export function resolveEpisodeGridDownEscape(
  direction: Direction,
  focusKey: string,
  siblings: FocusableComponent[],
): FocusableComponent | null {
  if (direction !== "down") return null;
  const me = siblings.find((sibling) => sibling.focusKey === focusKey);
  if (!me?.node) return null;
  const grid = me.node.closest<HTMLElement>("[data-spatial-episode-grid]");
  if (!grid) return null;
  const actions = document.querySelector<HTMLElement>("[data-spatial-episode-actions]");
  if (!actions) return null;
  const myBottom = me.node.getBoundingClientRect().bottom;
  const hasCardBelow = siblings.some((sibling) => {
    if (!sibling.node || sibling.node === me.node || !grid.contains(sibling.node)) return false;
    return sibling.node.getBoundingClientRect().top > myBottom - 8;
  });
  if (hasCardBelow) return null;
  return siblings.find((sibling) => sibling.node && actions.contains(sibling.node)) ?? null;
}

function registerAutomaticTarget(element: HTMLElement, focusKey: string, forceFocus: boolean) {
  element.dataset.spatialAuto = "true";
  element.dataset.spatialFocusKey = focusKey;
  const isTab = element.matches("[role='tab']");
  SpatialNavigation.addFocusable({
    focusKey,
    node: element,
    parentFocusKey: ROOT_FOCUS_KEY,
    onEnterPress: () => element.click(),
    onEnterRelease: () => undefined,
    onArrowPress: () => true,
    onArrowRelease: () => undefined,
    // `data-focused` is what the `[data-spatial-auto="true"][data-focused="true"]` rule in
    // styles.css keys off — without setting it here, every plain `<a>`/`<button>` card that only
    // ever gets *automatic* registration (no explicit `useSpatialFocusable`) shows no focus ring
    // at all while its own `className` still suppresses the native outline (`outline-none`),
    // which read as "the card doesn't move with the d-pad" even though it did.
    onFocus: () => {
      element.dataset.focused = "true";
      revealSpatialTarget(element);
    },
    onBlur: () => {
      delete element.dataset.focused;
    },
    onUpdateFocus: () => undefined,
    onUpdateHasFocusedChild: () => undefined,
    saveLastFocusedChild: false,
    trackChildren: false,
    autoRestoreFocus: true,
    forceFocus,
    focusable: true,
    isFocusBoundary: false,
    nextFocusResolver: isTab ? resolveTabPanelEscape : undefined,
  });
}

function AutomaticSpatialTargets() {
  useEffect(() => {
    const registered = new Map<HTMLElement, string>();
    let scanFrame = 0;
    let registeredLocation = "";

    const restoreFocus = (location: string, fallbackFocusKey?: string, attempt = 0) => {
      const remembered = rememberedFocusByLocation.get(location);
      if (remembered && SpatialNavigation.doesFocusableExist(remembered.focusKey)) {
        void SpatialNavigation.setFocus(remembered.focusKey);
        return;
      }
      if (remembered && attempt < 8) {
        window.requestAnimationFrame(() => restoreFocus(location, fallbackFocusKey, attempt + 1));
        return;
      }
      const nearestFocusKey = remembered
        ? Array.from(document.querySelectorAll<HTMLElement>("[data-spatial-focus-key]")).reduce<{
            focusKey: string;
            distance: number;
          } | null>((nearest, element) => {
            const focusKey = element.dataset.spatialFocusKey;
            if (!focusKey || !SpatialNavigation.doesFocusableExist(focusKey)) return nearest;
            const bounds = element.getBoundingClientRect();
            if (bounds.width === 0 || bounds.height === 0) return nearest;
            const distance = Math.hypot(
              bounds.left + bounds.width / 2 - remembered.centerX,
              bounds.top + bounds.height / 2 - remembered.centerY,
            );
            return !nearest || distance < nearest.distance ? { focusKey, distance } : nearest;
          }, null)?.focusKey
        : null;
      const nextFocusKey = nearestFocusKey ?? fallbackFocusKey;
      if (nextFocusKey) void SpatialNavigation.setFocus(nextFocusKey);
    };

    const scan = () => {
      scanFrame = 0;
      const pathname = window.location.pathname;
      const location = `${pathname}${window.location.search}`;
      const routeChanged = location !== registeredLocation;
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
        element.removeAttribute("data-spatial-focus-key");
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
        registeredLocation = location;
        restoreFocus(location, initialFocusKey);
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
        element.removeAttribute("data-spatial-focus-key");
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
      const navigationKey =
        event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ";
      if (navigationKey) document.documentElement.dataset.inputModality = "keyboard";
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
      if (
        isTextEntryTarget(event.target) ||
        (event.target instanceof HTMLElement &&
          event.target.closest("[data-spatial-navigation='off']"))
      ) {
        pause();
      } else resume();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (
        !isTextEntryTarget(event.relatedTarget) &&
        !(
          event.relatedTarget instanceof HTMLElement &&
          event.relatedTarget.closest("[data-spatial-navigation='off']")
        )
      ) {
        resume();
      }
    };
    const onFocusInRemember = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const targetFocusKey = event.target.dataset.spatialFocusKey;
      if (
        targetFocusKey &&
        targetFocusKey !== SpatialNavigation.getCurrentFocusKey() &&
        SpatialNavigation.doesFocusableExist(targetFocusKey)
      ) {
        void SpatialNavigation.setFocus(targetFocusKey);
      }
      const focusKey = targetFocusKey ?? SpatialNavigation.getCurrentFocusKey();
      if (!focusKey || focusKey === ROOT_FOCUS_KEY) return;
      const bounds = event.target.getBoundingClientRect();
      const location = `${window.location.pathname}${window.location.search}`;
      rememberedFocusByLocation.set(location, {
        focusKey,
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2,
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      document.documentElement.dataset.inputModality = "pointer";
      pause();
      for (const focused of document.querySelectorAll<HTMLElement>("[data-focused='true']")) {
        focused.removeAttribute("data-focused");
      }
      if (!(event.target instanceof HTMLElement)) return;
      const target = event.target.closest<HTMLElement>("[data-spatial-focus-key]");
      const focusKey = target?.dataset.spatialFocusKey;
      if (focusKey && SpatialNavigation.doesFocusableExist(focusKey)) {
        void SpatialNavigation.setFocus(focusKey);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isTextEntryTarget(event.target))
        return;
      const pathname = window.location.pathname;
      if (pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/player/")) {
        return;
      }
      const openLayer = document.querySelector(
        '[data-slot="dialog-content"],[data-slot="sheet-content"],[data-slot="drawer-content"],[data-slot="dropdown-menu-content"],[data-slot="navigation-menu-content"],[data-slot="popover-content"]',
      );
      if (openLayer) return;
      event.preventDefault();
      window.history.back();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keydown", onEscape);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusin", onFocusInRemember);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusin", onFocusInRemember);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
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
