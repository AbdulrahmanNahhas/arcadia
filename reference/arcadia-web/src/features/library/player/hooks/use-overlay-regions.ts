import { type RefObject, useEffect } from "react";
import { desktopPlayer, type UiRect } from "../../desktop-player";
import { OVERLAY_SELECTOR } from "../constants";

/**
 * Tells the native surface where the interface is.
 *
 * X11 cannot blend the video surface with the webview above it, so the surface is shaped and the
 * controls show through the holes (see `src-tauri/src/player/surface.rs`). Chrome is found by
 * selector rather than by ref because tooltips are portalled to `document.body`. Rectangles are
 * measured from the live DOM so a cut-out always matches what is actually rendered; a
 * `MutationObserver` catches panels opening and closing (attributes deliberately not observed —
 * the scrubber rewrites its inline width every frame), and a slow poll covers enter animations
 * that settle a few frames after the DOM change.
 */
export function useOverlayRegions({
  enabled,
  hasPicture,
  /** When false and nothing else is on screen, the whole window goes back to the picture. */
  anythingVisible,
  feedbackActive,
}: {
  enabled: boolean;
  hasPicture: boolean;
  anythingVisible: boolean;
  feedbackActive: RefObject<boolean>;
}) {
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let lastSent = "";

    const measure = () => {
      const regions = !anythingVisible && !feedbackActive.current ? [] : measureOverlayRegions();
      const signature = `${hasPicture}:${JSON.stringify(regions)}`;
      if (signature === lastSent) return;
      lastSent = signature;
      void desktopPlayer.setOverlay(hasPicture, regions).catch(() => undefined);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = window.setInterval(measure, 120);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(poll);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [enabled, hasPicture, anythingVisible, feedbackActive]);
}

function measureOverlayRegions(): UiRect[] {
  return (
    [...document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)]
      // `offsetParent` is null for a `display: none` subtree — hidden chrome contributes no hole.
      .filter((element) => element.offsetParent !== null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        // Tailwind's `rounded-full` computes to `calc(infinity * 1px)`, which overflows the Rust
        // side's number handling if sent raw; clamp to what the browser actually paints with.
        const rawRadius = Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius);
        const maxRadius = Math.min(rect.width, rect.height) / 2;
        const radius = Number.isFinite(rawRadius) ? Math.round(Math.min(rawRadius, maxRadius)) : 0;
        return {
          x: Math.floor(rect.left),
          y: Math.floor(rect.top),
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
          radius,
        };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
  );
}
