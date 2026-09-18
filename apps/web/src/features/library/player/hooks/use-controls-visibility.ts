import { useCallback, useEffect, useRef, useState } from "react";
import { CONTROLS_TIMEOUT_MS } from "../constants";
import type { UiLockMode } from "../types";

/**
 * Auto-hide after inactivity, unless something pins the bar: `h` cycling into `"visible"`, an
 * open panel, a paused film, or the end card. `"hidden"` is absolute the other way — mouse
 * movement cannot override a mode the family member explicitly chose.
 */
export function useControlsVisibility({ pinned }: { pinned: boolean }) {
  const [uiLock, setUiLock] = useState<UiLockMode>("auto");
  const [idleVisible, setIdleVisible] = useState(true);
  const timer = useRef(0);
  /** Mirror for `cycleLock`, which must report the new mode synchronously for the feedback badge. */
  const lockRef = useRef<UiLockMode>("auto");

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIdleVisible(false), CONTROLS_TIMEOUT_MS);
  }, []);

  const wake = useCallback(() => {
    setIdleVisible(true);
    arm();
  }, [arm]);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setIdleVisible(false);
  }, []);

  useEffect(() => {
    if (uiLock !== "auto") return;
    arm();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [uiLock, arm, wake]);

  const cycleLock = useCallback((): UiLockMode => {
    const current = lockRef.current;
    const next: UiLockMode =
      current === "auto" ? "hidden" : current === "hidden" ? "visible" : "auto";
    lockRef.current = next;
    setUiLock(next);
    // Coming back to auto-hide should start from "shown", not from wherever the timer left off.
    if (next === "auto") setIdleVisible(true);
    return next;
  }, []);

  const noop = useCallback(() => {}, []);
  const auto = uiLock === "auto";
  const visible = uiLock === "hidden" ? false : uiLock === "visible" ? true : pinned || idleVisible;

  return { visible, uiLock, cycleLock, wake: auto ? wake : noop, hide: auto ? hide : noop };
}
