import type { StreamCandidate } from "@arcadia/contracts";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { getPlaybackForInstallment } from "@/features/social/api";
import {
  desktopPlayer,
  type PlayerEvent,
  playerErrorSchema,
  subscribeToPlayer,
} from "../../desktop-player";
import { getOfflineStreams } from "../../offline-store";
import { PlaybackError, type PlaybackFailure, resolvePlayback } from "../../playback-resolver";
import { RESUME_END_BUFFER_SECONDS, RESUME_MIN_POSITION_SECONDS } from "../constants";
import { type FeedbackEvent, INITIAL_TICK, type PlayerStatus, type TickSnapshot } from "../types";

/**
 * What the session calls back into. Held in a ref by the page (updated every render) so the
 * streaming-start effect never restarts because a callback identity changed.
 */
export interface SessionCallbacks {
  showFeedback: (event: FeedbackEvent) => void;
  /** Called from the native pointer watcher; see `pointerMoved` in `desktop-player.ts`. */
  onPointerMoved: () => void;
  /** Flushes the playhead to the API — before pause, before stop, before switching sources. */
  persistProgress: () => void;
}

type PlayerErrorParse = ReturnType<typeof playerErrorSchema.safeParse>;

/**
 * The lifecycle half of the player: subscribes to the Rust event pipe, resolves and starts the
 * stream, tracks status/candidates/duration, and tears everything down on leave. Transport
 * commands (play, seek, volume) live in `use-player-actions.ts`; this hook only owns what the
 * engine reports back.
 */
export function usePlayerSession({
  enabled,
  installmentId,
  episodeId,
  autoplay,
  callbacks,
}: {
  enabled: boolean;
  installmentId: string;
  episodeId: string | null;
  autoplay: boolean;
  callbacks: RefObject<SessionCallbacks>;
}) {
  const [status, setStatus] = useState<PlayerStatus>("starting");
  const [failure, setFailure] = useState<{ kind: PlaybackFailure; detail: string | null } | null>(
    null,
  );
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasPicture, setHasPicture] = useState(false);
  const [softwareDecode, setSoftwareDecode] = useState(false);
  const [playbackEnded, setPlaybackEnded] = useState(false);
  const [attempt, setAttempt] = useState<{ index: number; total: number } | null>(null);
  const [peers, setPeers] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<StreamCandidate[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  /** Set when the picture comes from a kept download on this device rather than a stream. */
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [subtitleOffsetMs, setSubtitleOffsetMsState] = useState(0);

  const tick = useRef<TickSnapshot>(INITIAL_TICK);
  /** Consumed once on the next `fileLoaded`, then cleared — never re-applied after a failover. */
  const resumePositionSeconds = useRef<number | null>(null);
  const resumeSubtitleOffsetMs = useRef<number | null>(null);
  /** A manual source switch replaces the file; mpv reports the old one as "ended", which is not. */
  const switchingSource = useRef(false);
  // Read once at start-up, through a ref: the account preference can arrive after the stream is
  // already up, and that must not restart it.
  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  const fail = useCallback((kind: PlaybackFailure, detail?: string) => {
    setStatus("error");
    setFailure({ kind, detail: detail ?? null });
  }, []);

  /** Rust commands reject with a structured `PlayerError`, parsed like any other boundary payload. */
  const failFromPlayerError = useCallback(
    (parsed: PlayerErrorParse) => {
      if (parsed.success && parsed.data.kind === "torrentStalled") {
        fail("no_streams", "جُرّبت كل المصادر المتاحة ولم يستجب أي منها.");
      } else if (parsed.success) {
        fail("unknown", parsed.data.detail);
      } else {
        fail("unknown");
      }
    },
    [fail],
  );

  /** Applied live via `sub-delay`, and threaded into the next progress write. */
  const setSubtitleOffsetMs = useCallback((ms: number) => {
    setSubtitleOffsetMsState(ms);
    void desktopPlayer.setProperty("sub-delay", String(ms / 1000)).catch(() => undefined);
  }, []);

  /** Moves the local snapshot at once so the scrubber doesn't snap back until the next tick. */
  const jumpTick = useCallback((position: number) => {
    tick.current = { ...tick.current, position, at: performance.now() };
  }, []);

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
          switchingSource.current = false;
          setHasPicture(true);
          setDuration(event.duration ?? 0);
          setStatus("playing");
          setAttempt(null);
          setPlaybackEnded(false);
          // A software-decode fallback is a visible warning, never a silent pass.
          setSoftwareDecode(!event.hardwareDecoder || event.hardwareDecoder === "no");
          const resumeTo = resumePositionSeconds.current;
          if (resumeTo !== null) {
            resumePositionSeconds.current = null;
            void desktopPlayer.seek(resumeTo).catch(() => undefined);
            callbacks.current.showFeedback({ kind: "resume", positionSeconds: resumeTo });
          }
          const resumeOffset = resumeSubtitleOffsetMs.current;
          if (resumeOffset !== null) {
            resumeSubtitleOffsetMs.current = null;
            setSubtitleOffsetMs(resumeOffset);
          }
          break;
        }
        case "resolving":
          setStatus("resolving");
          break;
        case "pointerMoved":
          callbacks.current.onPointerMoved();
          break;
        case "attempt":
          setAttempt({ index: event.index, total: event.total });
          break;
        case "transfer":
          setPeers(event.peersConnected);
          break;
        case "ended":
          if (switchingSource.current) break;
          if (event.reason === "error") {
            fail("unknown", "توقّف التشغيل بسبب خطأ في الملف.");
          } else {
            callbacks.current.persistProgress();
            setPaused(true);
            setPlaybackEnded(true);
          }
          break;
        case "failed":
          fail("unknown", event.message);
          break;
        default:
          break;
      }
    },
    [fail, setSubtitleOffsetMs, callbacks],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Read at teardown time, not captured: the page swaps the callbacks as its hooks re-render.
    const flushProgress = () => callbacks.current.persistProgress();

    // Not awaited by `start`: a fast DB read that is essentially always done before the first
    // frame. Consumed once in `onEvent`'s `fileLoaded` case.
    const loadResume = async () => {
      const saved = await getPlaybackForInstallment(installmentId, episodeId).catch(() => null);
      if (cancelled || !saved) return;
      const withinResumeRange =
        saved.positionSeconds > RESUME_MIN_POSITION_SECONDS &&
        (saved.durationSeconds === null ||
          saved.positionSeconds < saved.durationSeconds - RESUME_END_BUFFER_SECONDS);
      if (withinResumeRange) resumePositionSeconds.current = saved.positionSeconds;
      if (saved.subtitleOffsetMs !== null) resumeSubtitleOffsetMs.current = saved.subtitleOffsetMs;
    };

    const start = async () => {
      try {
        await subscribeToPlayer((event) => {
          if (!cancelled) onEvent(event);
        });
        await desktopPlayer.init();
        if (cancelled) return;
        void loadResume();

        setStatus("resolving");
        const cachedStreams = await getOfflineStreams(installmentId, episodeId).catch(() => null);
        const source = await resolvePlayback(installmentId, episodeId, cachedStreams);
        if (cancelled) return;

        setCandidates(source.streams.candidates);
        if (source.kind === "local" && source.localPath) {
          setLocalPath(source.localPath);
          await desktopPlayer.loadPath(source.localPath);
          if (cancelled) return;
        } else {
          const started = await desktopPlayer.startStream(source.streams.candidates);
          if (cancelled) return;
          setActiveCandidateId(started.candidateId);
        }

        // `autoplay: false` means the family member starts it themselves.
        if (!autoplayRef.current) {
          await desktopPlayer.pause();
          setPaused(true);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof PlaybackError) fail(error.failure, error.message);
        else failFromPlayerError(playerErrorSchema.safeParse(error));
      }
    };
    void start();

    return () => {
      cancelled = true;
      // Persist one last time before tearing the stream down, so leaving mid-film is never lost.
      flushProgress();
      // Hide the surface *before* stopping: mpv keeps its last frame on screen (`keep-open=yes`),
      // and an un-hidden surface would sit over the page navigated to next.
      void desktopPlayer.setOverlay(false, []).catch(() => undefined);
      void desktopPlayer.stop().catch(() => undefined);
    };
  }, [enabled, installmentId, episodeId, onEvent, fail, failFromPlayerError, callbacks]);

  /**
   * Manual source switch: the chosen candidate goes first and the rest stay behind it as
   * failover, so a dead pick degrades exactly like the automatic ranking does. The current
   * position is carried across as a resume, the same path a fresh open uses.
   */
  const switchSource = useCallback(
    async (candidateId: string) => {
      const chosen = candidates.find((candidate) => candidate.id === candidateId);
      if (!chosen || candidateId === activeCandidateId) return;
      callbacks.current.persistProgress();
      if (tick.current.position > RESUME_MIN_POSITION_SECONDS) {
        resumePositionSeconds.current = tick.current.position;
      }
      switchingSource.current = true;
      setStatus("resolving");
      setAttempt(null);
      const ordered = [chosen, ...candidates.filter((candidate) => candidate.id !== candidateId)];
      try {
        const started = await desktopPlayer.startStream(ordered);
        setActiveCandidateId(started.candidateId);
        // `pause` persists across `loadfile`; a deliberate pick should start playing regardless.
        await desktopPlayer.play().catch(() => undefined);
        setPaused(false);
      } catch (error) {
        switchingSource.current = false;
        failFromPlayerError(playerErrorSchema.safeParse(error));
      }
    },
    [candidates, activeCandidateId, failFromPlayerError, callbacks],
  );

  return {
    status,
    failure,
    paused,
    setPaused,
    duration,
    hasPicture,
    softwareDecode,
    playbackEnded,
    setPlaybackEnded,
    attempt,
    peers,
    candidates,
    activeCandidateId,
    localPath,
    subtitleOffsetMs,
    setSubtitleOffsetMs,
    tick,
    jumpTick,
    switchSource,
  };
}

export type PlayerSession = ReturnType<typeof usePlayerSession>;
