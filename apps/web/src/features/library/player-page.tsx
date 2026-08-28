import type { StreamCandidate } from "@arcadia/contracts";
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentAccount } from "@/features/accounts/api";
import { getPlaybackForInstallment, updatePlaybackProgress } from "@/features/social/api";
import {
  desktopPlayer,
  type PlayerEvent,
  playerErrorSchema,
  setFullscreen,
  subscribeToPlayer,
} from "./desktop-player";
import { useIsDesktopShell } from "./play-button";
import {
  messageFor,
  PlaybackError,
  type PlaybackFailure,
  resolvePlayback,
} from "./playback-resolver";
import {
  CenterFeedback,
  type FeedbackEvent,
  formatTime,
  PlayerControls,
  type UiLockMode,
} from "./player-controls";

/**
 * The player screen: React controls floating over a native mpv surface. There is no `<video>`
 * element anywhere in this file — the video plane is a GTK child window underneath the webview,
 * and this page is transparent so it shows through.
 *
 * The overlay is the sneaky cost in this design (a transparent WebKitGTK surface repaints on
 * every React commit), so the rules from the roadmap's performance section are load-bearing here:
 * the playhead lives in a `ref` and is written inside `requestAnimationFrame`, never in React
 * state, and the whole overlay goes `pointer-events: none` + `invisible` when it auto-hides.
 */

type Status = "starting" | "resolving" | "buffering" | "playing" | "error";

const CONTROLS_TIMEOUT_MS = 2_500;
/** One arrow press moves the volume a noticeable amount; 1 % steps would need 100 presses. */
const VOLUME_STEP = 10;
/**
 * How often progress is persisted while playing, on top of the pause/exit writes below — the
 * Jellyfin-style tracking roadmap's "read path" (`docs/tracking-dashboard-i18n-roadmap.md`,
 * Phase B; folds in `docs/player-torrent-roadmap.md`'s Phase 2 write side).
 */
const PROGRESS_PERSIST_INTERVAL_MS = 20_000;
/** Below this, resuming isn't worth it — just start from the beginning. */
const RESUME_MIN_POSITION_SECONDS = 15;
/** Within this many seconds of the end, treat it as finished rather than resuming mid-credits. */
const RESUME_END_BUFFER_SECONDS = 30;
/**
 * Everything the video surface must not cover. `data-video-overlay` marks the player's own
 * chrome; the two `data-slot` values are what the shared Popover and Tooltip primitives already
 * stamp on their portalled content.
 */
const OVERLAY_SELECTOR =
  '[data-video-overlay],[data-slot="popover-content"],[data-slot="tooltip-content"]';

export function PlayerPage({ installmentId, titleId }: { installmentId: string; titleId: string }) {
  const navigate = useNavigate();
  const desktop = useIsDesktopShell();
  const { data: account } = useCurrentAccount();
  const preferences = account?.account.preferences;

  const [status, setStatus] = useState<Status>("starting");
  const [failure, setFailure] = useState<PlaybackFailure | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [candidates, setCandidates] = useState<StreamCandidate[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [fullscreen, setFullscreenState] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [attempt, setAttempt] = useState<{ index: number; total: number } | null>(null);
  const [peers, setPeers] = useState<number | null>(null);
  const [softwareDecode, setSoftwareDecode] = useState(false);
  /** False until mpv reports a loaded file, so the surface never blacks out the loading state. */
  const [hasPicture, setHasPicture] = useState(false);
  /** `h` cycles this: normal auto-hide → forced hidden → pinned visible → back to normal. */
  const [uiLock, setUiLock] = useState<UiLockMode>("auto");
  /** A brief centred icon confirming play/pause, volume, or a lock-mode change. */
  const [feedback, setFeedback] = useState<FeedbackEvent | null>(null);
  const [feedbackNonce, setFeedbackNonce] = useState(0);

  const playhead = useRef<HTMLDivElement>(null);
  const buffered = useRef<HTMLDivElement>(null);
  const elapsedLabel = useRef<HTMLSpanElement>(null);
  /** The `sm:hidden` mobile layout's own clock node — see the comment on `mobileElapsedRef` in
   * `player-controls.tsx` for why this can't just be a second consumer of `elapsedLabel`. */
  const mobileElapsedLabel = useRef<HTMLSpanElement>(null);
  const scrubber = useRef<HTMLDivElement>(null);
  /**
   * The 4 Hz tick from Rust, plus when it arrived. `requestAnimationFrame` extrapolates between
   * ticks so the scrubber moves smoothly at display rate while React commits nothing at all.
   */
  const tick = useRef({ position: 0, duration: 0, cacheSeconds: 0, paused: false, at: 0 });
  const feedbackTimer = useRef(0);
  /**
   * Set by the auto-hide effect below to whatever "bring the controls back" currently means.
   * `onEvent`'s `pointerMoved` case calls through this rather than dispatching a DOM event,
   * because the native pointer watcher (`src-tauri/src/player/surface.rs`) is the only thing that
   * sees movement over the video surface itself — the webview's own `pointermove` only fires over
   * the small cut-outs the controls occupy.
   */
  const wakeControls = useRef<() => void>(() => {});
  /**
   * The read half of Phase B's resume feature (`docs/tracking-dashboard-i18n-roadmap.md`):
   * populated from `GET /api/v1/me/playback/:installmentId` while the stream is still resolving,
   * consumed once on the first `fileLoaded` event, then cleared so a later candidate-failover
   * reload (or the user's own seek) never re-applies it.
   */
  const resumePositionSeconds = useRef<number | null>(null);
  /**
   * Writes the current position/duration to `PUT /api/v1/me/playback`. Held in a ref (rather than
   * called directly) so the pause/exit call sites and the periodic-interval effect below don't
   * need `duration` in their own dependency arrays — the streaming-start effect in particular must
   * never restart because `duration` changed mid-playback.
   *
   * Every installment the player opens today is a movie/special (`episodeId: null`): TV episode
   * playback is deferred past this phase (see the episode list's disabled state in
   * `work-detail-page.tsx`), so there is no episode id to carry yet.
   */
  const persistProgress = useRef<() => void>(() => {});
  useEffect(() => {
    persistProgress.current = () => {
      const position = Math.round(tick.current.position);
      if (position <= 0) return;
      const total = tick.current.duration || duration;
      void updatePlaybackProgress({
        installmentId,
        episodeId: null,
        positionSeconds: position,
        durationSeconds: total > 0 ? Math.round(total) : null,
      }).catch(() => undefined);
    };
  }, [installmentId, duration]);

  // Only the pre-first-frame states get the big centred panel: until mpv has a picture there is
  // nothing behind it to obscure. Mid-playback buffering is reported inside the bar instead.
  const starting = status === "starting" || status === "resolving";
  // `"hidden"`/`"visible"` are absolute and override whatever the auto-hide timer last decided;
  // derived here rather than written into `controlsVisible` itself, so switching into a pinned
  // mode never needs a `setState` call inside an effect purely to reflect it.
  const showControls = uiLock === "hidden" ? false : uiLock === "visible" ? true : controlsVisible;

  /** Mirrors `feedback` for the measurement effect below, which reads it from a ref rather than
   * depending on the state directly — `showFeedback` can fire many times a second while the
   * volume slider is being dragged, and rebuilding the `MutationObserver`/poll on every one of
   * those would be exactly the per-frame cost the polling design is meant to avoid. */
  const feedbackActive = useRef(false);
  useEffect(() => {
    feedbackActive.current = feedback !== null;
  }, [feedback]);

  const fail = useCallback((next: PlaybackFailure, detail?: string) => {
    setStatus("error");
    setFailure(next);
    setFailureDetail(detail ?? null);
  }, []);

  const showFeedback = useCallback((event: FeedbackEvent) => {
    setFeedback(event);
    setFeedbackNonce((nonce) => nonce + 1);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 700);
  }, []);

  // The whole document is transparent only while the player is mounted; everywhere else the app
  // keeps its own opaque background.
  useEffect(() => {
    document.body.classList.add("arcadia-player-open");
    return () => document.body.classList.remove("arcadia-player-open");
  }, []);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  const onEvent = useCallback(
    (event: PlayerEvent) => {
      switch (event.type) {
        case "tick":
          tick.current = {
            position: event.position,
            duration: event.duration,
            cacheSeconds: event.cacheSeconds,
            paused: event.paused,
            at: performance.now(),
          };
          setStatus((current) =>
            current === "error" ? current : event.buffering ? "buffering" : "playing",
          );
          break;
        case "fileLoaded": {
          setHasPicture(true);
          setDuration(event.duration ?? 0);
          setStatus("playing");
          setAttempt(null);
          // A software-decode fallback is a visible warning, never a silent pass.
          setSoftwareDecode(!event.hardwareDecoder || event.hardwareDecoder === "no");
          const resumeTo = resumePositionSeconds.current;
          if (resumeTo !== null) {
            resumePositionSeconds.current = null;
            void desktopPlayer.seek(resumeTo).catch(() => undefined);
            showFeedback({ kind: "resume", positionSeconds: resumeTo });
          }
          break;
        }
        case "resolving":
          setStatus("resolving");
          break;
        case "pointerMoved":
          wakeControls.current();
          break;
        case "attempt":
          setAttempt({ index: event.index, total: event.total });
          break;
        case "transfer":
          setPeers(event.peersConnected);
          break;
        case "ended":
          if (event.reason === "error") fail("unknown", "توقّف التشغيل بسبب خطأ في الملف.");
          break;
        case "failed":
          fail("unknown", event.message);
          break;
        default:
          break;
      }
    },
    [fail, showFeedback],
  );

  useEffect(() => {
    if (!desktop) return;

    let cancelled = false;
    const start = async () => {
      try {
        await subscribeToPlayer((event) => {
          if (!cancelled) onEvent(event);
        });
        await desktopPlayer.init();
        if (cancelled) return;

        // Fired in parallel with stream resolution below, not awaited: a single fast DB read
        // that's essentially always done well before mpv reports the first frame, so it never
        // delays start-up. Consumed once in `onEvent`'s `fileLoaded` case.
        void getPlaybackForInstallment(installmentId)
          .then((saved) => {
            if (cancelled || !saved) return;
            const withinResumeRange =
              saved.positionSeconds > RESUME_MIN_POSITION_SECONDS &&
              (saved.durationSeconds === null ||
                saved.positionSeconds < saved.durationSeconds - RESUME_END_BUFFER_SECONDS);
            if (withinResumeRange) resumePositionSeconds.current = saved.positionSeconds;
            return;
          })
          .catch(() => undefined);

        setStatus("resolving");
        const source = await resolvePlayback(installmentId);
        if (cancelled) return;

        setCandidates(source.streams.candidates);
        const started = await desktopPlayer.startStream(source.streams.candidates);
        if (cancelled) return;
        setActiveCandidateId(started.candidateId);

        // `autoplay: false` means the family member starts it themselves.
        if (preferences && !preferences.autoplay) {
          await desktopPlayer.pause();
          setPaused(true);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof PlaybackError) {
          fail(error.failure, error.message);
          return;
        }
        // Rust commands reject with a structured `PlayerError`, so it is parsed like any other
        // payload crossing a boundary rather than duck-typed.
        const rejected = playerErrorSchema.safeParse(error);
        if (rejected.success && rejected.data.kind === "torrentStalled") {
          fail("no_streams", "جُرّبت كل المصادر المتاحة ولم يستجب أي منها.");
        } else if (rejected.success) {
          fail("unknown", rejected.data.detail);
        } else {
          fail("unknown");
        }
      }
    };
    void start();

    return () => {
      cancelled = true;
      // Persist one last time before tearing the stream down, so leaving mid-film is never lost.
      persistProgress.current();
      // Hide the surface *before* stopping: mpv keeps its last frame on screen (`keep-open=yes`),
      // and an un-hidden surface would sit over the page navigated to next.
      void desktopPlayer.setOverlay(false, []).catch(() => undefined);
      // Leaving the route stops the transfer too — no torrent keeps running in the background.
      void desktopPlayer.stop().catch(() => undefined);
    };
  }, [desktop, installmentId, onEvent, fail, preferences]);

  // Periodic progress persistence, independent of the streaming-start effect above so a duration
  // update (which that ref absorbs, see its own effect) never restarts the stream.
  useEffect(() => {
    if (!desktop) return;
    const interval = window.setInterval(() => {
      persistProgress.current();
    }, PROGRESS_PERSIST_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [desktop]);

  // Smooth scrubber. Nothing in this loop touches React state, so the overlay never re-renders
  // while the film plays.
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = requestAnimationFrame(paint);
      const snapshot = tick.current;
      const total = snapshot.duration || duration;
      const drift = snapshot.paused ? 0 : (performance.now() - snapshot.at) / 1000;
      // Clamped only when a duration is known. mpv reports none until it has parsed enough of the
      // container, and for a torrent-backed stream that can be a while — bailing out on `total`
      // used to freeze the clock at 0:00 and the playhead at zero for the whole of that window,
      // even though `time-pos` was arriving the entire time.
      const raw = snapshot.position + drift;
      const position = total > 0 ? Math.min(raw, total) : raw;

      // The clock is meaningful with or without a duration, so it is always written — to both
      // layouts' nodes, since only CSS decides which one is on screen at a given width.
      const formatted = formatTime(position);
      if (elapsedLabel.current) {
        elapsedLabel.current.textContent = formatted;
      }
      if (mobileElapsedLabel.current) {
        mobileElapsedLabel.current.textContent = formatted;
      }
      if (total <= 0) return;

      if (playhead.current) {
        playhead.current.style.width = `${(position / total) * 100}%`;
      }
      if (buffered.current) {
        const ahead = Math.min(position + snapshot.cacheSeconds, total);
        buffered.current.style.width = `${(ahead / total) * 100}%`;
      }
      // Written here rather than in JSX: reading the tick ref during render would both violate
      // React's rules and force a commit on every frame.
      scrubber.current?.setAttribute("aria-valuenow", String(Math.round(position)));
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  /**
   * Tells the native surface where the interface is.
   *
   * X11 cannot blend the video surface with the webview above it, so the surface is shaped and the
   * controls show through the holes (see `player/surface.rs`). Every piece of chrome is found by
   * selector rather than by ref, because popovers and tooltips are portalled to `document.body` —
   * a ref-based list would miss them and the video would cover every open menu.
   *
   * Rectangles are measured from the live DOM, so a cut-out always matches what is actually
   * rendered. A `MutationObserver` catches menus opening and closing; `attributes` are
   * deliberately *not* observed, because the scrubber rewrites its own inline width every frame
   * and that would re-measure at 60 Hz.
   */
  useEffect(() => {
    if (!desktop) return;

    let frame = 0;
    // Only re-crosses the IPC boundary when the geometry actually changed, so the poll below is
    // nearly free.
    let lastSent = "";

    const measure = () => {
      // Nothing on screen means nothing to cut out — except the centred play/pause/volume/lock
      // badge, which can appear at any moment while the bar is otherwise hidden (that is the
      // whole point of it), so its presence has to defeat the shortcut too.
      const regions =
        !showControls && !starting && !feedbackActive.current
          ? []
          : [...document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)]
              // `offsetParent` is null for a `display: none` subtree, which is how hidden
              // controls are rendered — so they contribute no cut-out and the picture stays whole.
              .filter((element) => element.offsetParent !== null)
              .map((element) => {
                const rect = element.getBoundingClientRect();
                // Read from the computed style rather than assumed, so restyling a control never
                // silently leaves black notches at its corners.
                //
                // Tailwind v4's `rounded-full` is `border-radius: calc(infinity * 1px)`, so any
                // circular control here — the back button, the centred feedback badge — reports a
                // *computed* radius in the billions: `getComputedStyle` returns the specified
                // value, not the value the box actually renders with once the browser clamps it to
                // half the box size at paint time. Sent as-is, a number that size overflows the
                // Rust side's `i32`, and because it rides inside the same array as every other
                // control's rectangle, that one bad value fails the whole batch — every rect in
                // this tick, not just the circular one. The visible result was exactly this: the
                // moment a rounded-full element joined the mix, the interface stopped being able to
                // cut *any* hole at all, and the video silently stayed unshaped from whatever the
                // last all-rectangular (or empty) batch had left it as. Clamping to the box's own
                // half-size here is not just cosmetically correct — it is what keeps every value in
                // range before it ever crosses the IPC boundary.
                const rawRadius = Number.parseFloat(
                  window.getComputedStyle(element).borderTopLeftRadius,
                );
                const maxRadius = Math.min(rect.width, rect.height) / 2;
                const radius = Number.isFinite(rawRadius)
                  ? Math.round(Math.min(rawRadius, maxRadius))
                  : 0;
                return {
                  x: Math.floor(rect.left),
                  y: Math.floor(rect.top),
                  width: Math.ceil(rect.width),
                  height: Math.ceil(rect.height),
                  radius,
                };
              })
              .filter((rect) => rect.width > 0 && rect.height > 0);

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
    // A menu fades and scales in, so its final size arrives several frames after it mounts, and a
    // tooltip can move without any DOM change at all. Polling closes both gaps; the signature
    // check above means a steady screen costs one `querySelectorAll` and nothing else.
    const poll = window.setInterval(measure, 120);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(poll);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [desktop, hasPicture, showControls, starting]);

  /**
   * Auto-hide after inactivity — unless `h` has pinned the bar. `"visible"` and `"hidden"` are
   * absolute: no listener is registered for them, so mouse movement cannot override a mode the
   * family member explicitly chose. `wakeControls` is only ever armed in `"auto"` mode, so a
   * `pointerMoved` event arriving while pinned is correctly a no-op.
   */
  useEffect(() => {
    if (uiLock !== "auto") {
      // No `setControlsVisible` here: `showControls` already derives the pinned modes straight
      // from `uiLock` at render time, so there is nothing for this effect to synchronise.
      wakeControls.current = () => {};
      return;
    }

    let timer = 0;
    const show = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), CONTROLS_TIMEOUT_MS);
    };
    wakeControls.current = show;
    show();
    window.addEventListener("pointermove", show);
    window.addEventListener("keydown", show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", show);
      window.removeEventListener("keydown", show);
    };
  }, [uiLock]);

  const togglePlay = useCallback(async () => {
    const next = !paused;
    setPaused(next);
    showFeedback({ kind: next ? "pause" : "play" });
    if (next) persistProgress.current();
    await (next ? desktopPlayer.pause() : desktopPlayer.play()).catch(() => undefined);
  }, [paused, showFeedback]);

  const seekBy = useCallback(
    async (delta: number) => {
      const total = tick.current.duration || duration;
      const target = Math.max(0, Math.min(tick.current.position + delta, total));
      await desktopPlayer.seek(target).catch(() => undefined);
    },
    [duration],
  );

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    showFeedback({ kind: "volume", value: volume, muted: next });
    await desktopPlayer.setProperty("mute", next ? "yes" : "no").catch(() => undefined);
  }, [muted, volume, showFeedback]);

  const changeVolume = useCallback(
    async (next: number) => {
      setVolume(next);
      showFeedback({ kind: "volume", value: next, muted: next === 0 });
      // Moving the slider away from zero is an unmute in every player the family has used.
      if (next > 0) {
        setMuted(false);
        await desktopPlayer.setProperty("mute", "no").catch(() => undefined);
      }
      await desktopPlayer.setVolume(next).catch(() => undefined);
    },
    [showFeedback],
  );

  const changeSpeed = useCallback(async (next: number) => {
    setSpeed(next);
    await desktopPlayer.setProperty("speed", String(next)).catch(() => undefined);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const next = !fullscreen;
    setFullscreenState(next);
    await setFullscreen(next).catch(() => undefined);
  }, [fullscreen]);

  const leave = useCallback(() => {
    void navigate({ to: "/titles/$titleId", params: { titleId } });
  }, [navigate, titleId]);

  useEffect(() => {
    if (status === "error") return;
    const onKey = (event: KeyboardEvent) => {
      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          void togglePlay();
          break;
        // The timeline is laid out left-to-right (see player-controls.tsx), so the arrows follow
        // it rather than the page's RTL direction: right is later, left is earlier, exactly as in
        // every other player. Mirroring these to match RTL made seeking feel backwards.
        case "ArrowRight":
          event.preventDefault();
          void seekBy(10);
          break;
        case "ArrowLeft":
          event.preventDefault();
          void seekBy(-10);
          break;
        case "ArrowUp":
          event.preventDefault();
          void changeVolume(Math.min(100, volume + VOLUME_STEP));
          break;
        case "ArrowDown":
          event.preventDefault();
          void changeVolume(Math.max(0, volume - VOLUME_STEP));
          break;
        case "f":
          void toggleFullscreen();
          break;
        case "m":
          void toggleMute();
          break;
        case "h":
          event.preventDefault();
          setUiLock((current) => {
            const next: UiLockMode =
              current === "auto" ? "hidden" : current === "hidden" ? "visible" : "auto";
            showFeedback({ kind: "lock", mode: next });
            return next;
          });
          break;
        case "Escape":
          leave();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    status,
    togglePlay,
    seekBy,
    toggleFullscreen,
    toggleMute,
    changeVolume,
    volume,
    leave,
    showFeedback,
  ]);

  const onScrub = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bar = scrubber.current;
      const total = tick.current.duration || duration;
      if (!bar || total <= 0) return;
      const rect = bar.getBoundingClientRect();
      // The bar is laid out LTR inside an RTL document, so the offset is measured from its left
      // edge regardless of direction.
      const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      void desktopPlayer.seek(ratio * total).catch(() => undefined);
    },
    [duration],
  );

  if (!desktop) {
    return <PlaybackFailureScreen failure="not_desktop" detail={null} onBack={leave} />;
  }

  if (status === "error") {
    return (
      <PlaybackFailureScreen failure={failure ?? "unknown"} detail={failureDetail} onBack={leave} />
    );
  }

  return (
    <main className="fixed inset-0 bg-black text-white" dir="rtl">
      {starting && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div data-video-overlay className="rounded-2xl bg-black/85 px-6 py-4 text-center">
            <p className="text-sm font-medium">{busyLabel(status, attempt, peers)}</p>
          </div>
        </div>
      )}

      {/*
        Full-window chrome layer. `pointer-events-none` lets clicks through to the picture; each
        control opts back in. Hidden state uses `hidden` (display: none) rather than `invisible`
        so the measurement above sees no box for it and hands the whole window back to the video.
        `overflow-visible` keeps tooltips and dropdown menus from being clipped at this layer's edge.
      */}
      <div
        className={
          showControls ? "pointer-events-none absolute inset-0 z-20 overflow-visible" : "hidden"
        }
      >
        <PlayerControls
          paused={paused}
          muted={muted}
          volume={volume}
          duration={duration}
          fullscreen={fullscreen}
          speed={speed}
          candidates={candidates}
          activeCandidateId={activeCandidateId}
          onBack={leave}
          softwareDecode={softwareDecode}
          buffering={status === "buffering"}
          bufferingLabel={busyLabel(status, attempt, peers)}
          scrubberRef={scrubber}
          playheadRef={playhead}
          bufferedRef={buffered}
          elapsedRef={elapsedLabel}
          mobileElapsedRef={mobileElapsedLabel}
          onTogglePlay={() => void togglePlay()}
          onSeekBy={(delta) => void seekBy(delta)}
          onScrub={onScrub}
          onToggleMute={() => void toggleMute()}
          onSetVolume={(next) => void changeVolume(next)}
          onSetSpeed={(next) => void changeSpeed(next)}
          onToggleFullscreen={() => void toggleFullscreen()}
        />
      </div>

      {/*
        Always mounted, outside the `showControls` gate above: the whole point of this badge is
        to confirm an action (space, m, arrow keys, h) even while the bar itself is hidden.
      */}
      <CenterFeedback event={feedback} nonce={feedbackNonce} />
    </main>
  );
}

/**
 * Distinguishes *resolving metadata* from *buffering* from *stalled — no peers*. Collapsing these
 * into one spinner is exactly the failure the roadmap forbids: the family cannot tell a slow
 * start from a dead one.
 */
function busyLabel(
  status: Status,
  attempt: { index: number; total: number } | null,
  peers: number | null,
) {
  if (attempt) return `جارٍ تجربة المصدر ${attempt.index} من ${attempt.total}…`;
  if (status === "resolving") return "جارٍ العثور على مصدر للتشغيل…";
  if (status === "buffering") {
    return peers === 0 ? "لا يوجد أقران متصلون — التحميل متوقف." : "جارٍ التخزين المؤقت…";
  }
  return "جارٍ تجهيز المشغّل…";
}

function PlaybackFailureScreen({
  failure,
  detail,
  onBack,
}: {
  failure: PlaybackFailure;
  detail: string | null;
  onBack: () => void;
}) {
  return (
    <main className="fixed inset-0 grid place-items-center bg-background p-8" dir="rtl">
      <div className="max-w-md text-center">
        <WarningCircleIcon size={48} className="mx-auto text-muted-foreground" />
        <h1 className="mt-4 font-heading text-2xl font-semibold">تعذّر التشغيل</h1>
        <p className="mt-3 leading-8 text-muted-foreground">{detail ?? messageFor(failure)}</p>
        <Button className="mt-6" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start rotate-180" /> رجوع إلى تفاصيل العمل
        </Button>
      </div>
    </main>
  );
}
