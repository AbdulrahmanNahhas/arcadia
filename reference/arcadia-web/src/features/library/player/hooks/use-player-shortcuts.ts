import { type RefObject, useEffect } from "react";
import type { FeedbackEvent, PanelKind, UiLockMode } from "../types";
import type { PlayerActions } from "./use-player-actions";

/**
 * Keyboard and D-pad model, in two modes decided by where DOM focus is:
 *
 * - **Video mode** (nothing in the chrome is focused): arrows act on playback — Left/Right seek,
 *   Up/Down volume — and Enter/OK wakes the bar and lands focus on the play button.
 * - **Chrome mode** (a control is focused): arrows move focus. Left/Right walk the control's own
 *   row (`data-control-row`), Up/Down jump to the nearest control in the adjacent row, Enter
 *   activates, Back/Escape drops focus and returns to video mode. The timeline is the one
 *   exception: Left/Right seek while it holds focus, as on every TV player.
 *
 * Open panels handle their own keys (`panel-shell.tsx`) and stop propagation, so nothing here
 * runs while one is open apart from the lock cycle.
 */
export function usePlayerShortcuts({
  enabled,
  panelOpen,
  chrome,
  actions,
  hasNextEpisode,
  onLeave,
  onOpenPanel,
  onPlayNext,
  cycleLock,
  showFeedback,
  wakeControls,
}: {
  enabled: boolean;
  panelOpen: boolean;
  chrome: RefObject<HTMLElement | null>;
  actions: PlayerActions;
  hasNextEpisode: boolean;
  onLeave: () => void;
  onOpenPanel: (panel: PanelKind) => void;
  onPlayNext: () => void;
  cycleLock: () => UiLockMode;
  showFeedback: (event: FeedbackEvent) => void;
  wakeControls: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      // Not gated on `defaultPrevented`: the spatial-navigation engine (`SpatialNavigationRoot`)
      // prevents every arrow and Enter at the window level even where it has nothing registered.
      if (panelOpen) return;
      const key = normaliseKey(event);
      const root = chrome.current;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const inChrome = Boolean(root && active && root.contains(active) && active !== root);

      // Space is left to the focused button in chrome mode — it is its native activation key.
      if (key === " " && !inChrome) {
        event.preventDefault();
        void actions.togglePlay();
        return;
      }

      // Global — identical in both modes.
      switch (key) {
        case "k":
        case "MediaPlayPause":
          event.preventDefault();
          void actions.togglePlay();
          return;
        case "f":
          void actions.toggleFullscreen();
          return;
        case "m":
          void actions.toggleMute();
          return;
        case "h":
          event.preventDefault();
          showFeedback({ kind: "lock", mode: cycleLock() });
          return;
        case "c":
          onOpenPanel("tracks");
          return;
        case "e":
          onOpenPanel("episodes");
          return;
        case "n":
        case "MediaTrackNext":
          if (hasNextEpisode) onPlayNext();
          return;
        case "MediaRewind":
          void actions.seekBackward();
          return;
        case "MediaFastForward":
          void actions.seekForward();
          return;
        default:
          break;
      }
      if (/^[0-9]$/.test(key) && !inChrome) {
        void actions.seekToFraction(Number(key) / 10);
        return;
      }

      if (inChrome && active && root) {
        handleChromeKey(event, key, root, active, actions);
        return;
      }

      switch (key) {
        case "ArrowRight":
          event.preventDefault();
          void actions.seekForward();
          break;
        case "ArrowLeft":
          event.preventDefault();
          void actions.seekBackward();
          break;
        case "ArrowUp":
          event.preventDefault();
          void actions.volumeBy(1);
          break;
        case "ArrowDown":
          event.preventDefault();
          void actions.volumeBy(-1);
          break;
        case "Enter":
          event.preventDefault();
          wakeControls();
          // The bar may be `display: none` this instant; give React one commit to show it.
          window.setTimeout(() => focusControl(chrome.current, "play"), 40);
          break;
        case "Escape":
        case "Back":
          event.preventDefault();
          onLeave();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    enabled,
    panelOpen,
    chrome,
    actions,
    hasNextEpisode,
    onLeave,
    onOpenPanel,
    onPlayNext,
    cycleLock,
    showFeedback,
    wakeControls,
  ]);
}

/** Remote-control and browser variants folded onto one name per intent. */
function normaliseKey(event: KeyboardEvent): string {
  switch (event.key) {
    case "Backspace":
    case "BrowserBack":
    case "GoBack":
    case "XF86Back":
      return "Back";
    default:
      return event.key;
  }
}

function handleChromeKey(
  event: KeyboardEvent,
  key: string,
  root: HTMLElement,
  active: HTMLElement,
  actions: PlayerActions,
) {
  const onTimeline = active.dataset.playerControl === "timeline";
  switch (key) {
    case "ArrowRight":
    case "ArrowLeft": {
      event.preventDefault();
      if (onTimeline) {
        void (key === "ArrowRight" ? actions.seekForward() : actions.seekBackward());
        return;
      }
      moveWithinRow(root, active, key === "ArrowRight" ? 1 : -1);
      return;
    }
    case "ArrowUp":
    case "ArrowDown":
      event.preventDefault();
      moveAcrossRows(root, active, key === "ArrowDown" ? 1 : -1);
      return;
    case "Enter":
      // Explicit: the spatial-navigation engine has already cancelled the native activation.
      event.preventDefault();
      if (onTimeline) void actions.togglePlay();
      else active.click();
      return;
    case "Escape":
    case "Back":
      event.preventDefault();
      active.blur();
      return;
    default:
      return;
  }
}

/** The phone and desktop layouts each render a play button; only the one on screen can take focus. */
function focusControl(root: HTMLElement | null, name: string) {
  if (!root) return;
  visibleControls(root)
    .find((element) => element.dataset.playerControl === name)
    ?.focus();
}

function visibleControls(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>("[data-player-control]")].filter(
    (element) =>
      element.offsetParent !== null && !element.matches("[disabled], [aria-disabled='true']"),
  );
}

function centreOf(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function moveWithinRow(root: HTMLElement, active: HTMLElement, direction: 1 | -1) {
  const row = active.closest<HTMLElement>("[data-control-row]") ?? root;
  const siblings = visibleControls(row).toSorted((a, b) => centreOf(a).x - centreOf(b).x);
  const index = siblings.indexOf(active);
  const next = siblings[index + direction];
  if (next) next.focus();
}

function moveAcrossRows(root: HTMLElement, active: HTMLElement, direction: 1 | -1) {
  const rows = [...root.querySelectorAll<HTMLElement>("[data-control-row]")]
    .filter((row) => visibleControls(row).length > 0)
    .toSorted((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const currentRow = active.closest<HTMLElement>("[data-control-row]");
  const index = currentRow ? rows.indexOf(currentRow) : -1;
  const target = rows[index + direction];
  if (!target) {
    // Past the last row there is nothing but the picture: hand control back to video mode.
    if (direction === 1) active.blur();
    return;
  }
  const origin = centreOf(active).x;
  const nearest = visibleControls(target).toSorted(
    (a, b) => Math.abs(centreOf(a).x - origin) - Math.abs(centreOf(b).x - origin),
  )[0];
  nearest?.focus();
}
