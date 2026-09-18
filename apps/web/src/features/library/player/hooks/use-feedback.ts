import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedbackEvent } from "../types";

const FEEDBACK_VISIBLE_MS = 700;

/**
 * The brief centred badge confirming play/pause, seek, volume, or a lock-mode change. `nonce`
 * increments per event so two same-kind events in a row restart the fade instead of being
 * swallowed by React reusing the still-mounted element. `active` is a ref mirror for the
 * overlay-measurement loop, which must not re-subscribe every time the badge flashes.
 */
export function useFeedback() {
  const [event, setEvent] = useState<FeedbackEvent | null>(null);
  const [nonce, setNonce] = useState(0);
  const active = useRef(false);
  const timer = useRef(0);

  useEffect(() => {
    active.current = event !== null;
  }, [event]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = useCallback((next: FeedbackEvent) => {
    setEvent(next);
    setNonce((current) => current + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setEvent(null), FEEDBACK_VISIBLE_MS);
  }, []);

  return { event, nonce, active, show };
}
