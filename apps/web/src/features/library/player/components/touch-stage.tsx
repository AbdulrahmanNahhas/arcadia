import { useRef } from "react";

const DOUBLE_TAP_MS = 280;

/**
 * The tappable picture, for the phone layout: a tap toggles the chrome, a double tap on either
 * half seeks ±10 s — the gesture every mobile player taught the family. On the desktop shell this
 * sits *under* the native X11 surface and never sees a pointer, which is fine: there the surface
 * itself reports movement and the bar wakes from that.
 *
 * Whether the tap should show or hide is decided at `pointerdown`, before the page's own
 * pointer listeners have woken the bar — otherwise every tap on a hidden bar would wake it and
 * immediately hide it again.
 */
export function TouchStage({
  chromeVisible,
  onShow,
  onHide,
  onSeekBackward,
  onSeekForward,
}: {
  chromeVisible: boolean;
  onShow: () => void;
  onHide: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
}) {
  const pending = useRef(0);
  const lastTapAt = useRef(0);
  const visibleAtDown = useRef(false);

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-10"
      onPointerDown={() => {
        visibleAtDown.current = chromeVisible;
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const now = performance.now();
        if (now - lastTapAt.current < DOUBLE_TAP_MS) {
          window.clearTimeout(pending.current);
          lastTapAt.current = 0;
          const half = event.currentTarget.getBoundingClientRect().width / 2;
          (event.clientX < half ? onSeekBackward : onSeekForward)();
          return;
        }
        lastTapAt.current = now;
        window.clearTimeout(pending.current);
        const toggle = visibleAtDown.current ? onHide : onShow;
        pending.current = window.setTimeout(toggle, DOUBLE_TAP_MS);
      }}
    />
  );
}
