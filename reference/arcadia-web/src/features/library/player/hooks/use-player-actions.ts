import { useCallback, useState } from "react";
import { desktopPlayer, setFullscreen } from "../../desktop-player";
import { SEEK_STEP_SECONDS, VOLUME_STEP } from "../constants";
import type { FeedbackEvent } from "../types";
import type { PlayerSession } from "./use-player-session";

/**
 * Transport commands and the state they own (mute, volume, speed, fullscreen). Every command is
 * optimistic — the state flips first, the IPC call follows — because a 4 Hz tick is too slow to
 * make a button feel responsive if it waited for confirmation.
 */
export function usePlayerActions({
  session,
  showFeedback,
  persistProgress,
  resetProgress,
}: {
  session: PlayerSession;
  showFeedback: (event: FeedbackEvent) => void;
  persistProgress: () => void;
  resetProgress: () => Promise<void>;
}) {
  const { paused, setPaused, tick, jumpTick, duration } = session;
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreenState] = useState(false);

  const togglePlay = useCallback(async () => {
    const next = !paused;
    setPaused(next);
    showFeedback({ kind: next ? "pause" : "play" });
    if (next) persistProgress();
    await (next ? desktopPlayer.pause() : desktopPlayer.play()).catch(() => undefined);
  }, [paused, setPaused, showFeedback, persistProgress]);

  const seekTo = useCallback(
    async (seconds: number) => {
      const total = tick.current.duration || duration;
      const target = Math.max(0, total > 0 ? Math.min(seconds, total) : seconds);
      jumpTick(target);
      await desktopPlayer.seek(target).catch(() => undefined);
    },
    [tick, jumpTick, duration],
  );

  const seekBy = useCallback(
    async (delta: number) => {
      showFeedback({ kind: "seek", deltaSeconds: delta });
      await seekTo(tick.current.position + delta);
    },
    [seekTo, showFeedback, tick],
  );

  /** YouTube-style `0`–`9`: jump to that tenth of the film. */
  const seekToFraction = useCallback(
    async (fraction: number) => {
      const total = tick.current.duration || duration;
      if (total <= 0) return;
      await seekTo(total * fraction);
    },
    [seekTo, tick, duration],
  );

  const restart = useCallback(async () => {
    await seekTo(0);
    await resetProgress();
  }, [seekTo, resetProgress]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    showFeedback({ kind: "volume", value: volume, muted: next });
    await desktopPlayer.setProperty("mute", next ? "yes" : "no").catch(() => undefined);
  }, [muted, volume, showFeedback]);

  const changeVolume = useCallback(
    async (next: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(next)));
      setVolume(clamped);
      showFeedback({ kind: "volume", value: clamped, muted: clamped === 0 });
      // Moving the slider away from zero is an unmute in every player the family has used.
      if (clamped > 0 && muted) {
        setMuted(false);
        await desktopPlayer.setProperty("mute", "no").catch(() => undefined);
      }
      await desktopPlayer.setVolume(clamped).catch(() => undefined);
    },
    [muted, showFeedback],
  );

  const volumeBy = useCallback(
    (delta: number) => changeVolume(volume + delta * VOLUME_STEP),
    [changeVolume, volume],
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

  return {
    muted,
    volume,
    speed,
    fullscreen,
    togglePlay,
    seekTo,
    seekBy,
    seekBackward: () => seekBy(-SEEK_STEP_SECONDS),
    seekForward: () => seekBy(SEEK_STEP_SECONDS),
    seekToFraction,
    restart,
    toggleMute,
    changeVolume,
    volumeBy,
    changeSpeed,
    toggleFullscreen,
  };
}

export type PlayerActions = ReturnType<typeof usePlayerActions>;
