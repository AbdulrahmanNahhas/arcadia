import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentAccount } from "@/features/accounts/api";
import { getPlaybackForTitle } from "@/features/social/api";
import { getTitle } from "@/lib/api";
import { useIsDesktopShell } from "../play-button";
import { CenterFeedback } from "./components/center-feedback";
import { ControlBar } from "./components/control-bar";
import { MobileTransport } from "./components/mobile-transport";
import { busyLabel, EndedOverlay, FailureScreen, LoadingBadge } from "./components/status-overlays";
import { TopBar } from "./components/top-bar";
import { TouchStage } from "./components/touch-stage";
import { findEpisode, nextUnwatchedEpisode, type PlayerEpisode, playerSeasons } from "./episodes";
import { formatEpisodeCode } from "./format";
import { useControlsVisibility } from "./hooks/use-controls-visibility";
import { useFeedback } from "./hooks/use-feedback";
import { useOverlayRegions } from "./hooks/use-overlay-regions";
import { usePlayerActions } from "./hooks/use-player-actions";
import { type SessionCallbacks, usePlayerSession } from "./hooks/use-player-session";
import { usePlayerShortcuts } from "./hooks/use-player-shortcuts";
import { useProgressPersistence } from "./hooks/use-progress-persistence";
import { PlayerPanels } from "./panels/player-panels";
import type { PanelKind } from "./types";

/**
 * The player screen: React chrome floating over a native mpv surface. There is no `<video>`
 * element — the picture is an X11 child window shaped around whatever is marked
 * `data-video-overlay` (see `hooks/use-overlay-regions.ts`), and this page is opaque black
 * beneath it. The rules that keep it cheap are load-bearing: the playhead lives in a ref painted
 * by `requestAnimationFrame`, never in state, and hidden chrome is `display: none`, not
 * transparent, so the surface gets the whole window back.
 *
 * This file only composes: lifecycle is `use-player-session`, commands `use-player-actions`,
 * keys `use-player-shortcuts`, menus `panels/`.
 */
export function PlayerPage({
  installmentId,
  titleId,
  episodeId,
  origin,
}: {
  installmentId: string;
  titleId: string;
  episodeId: string | null;
  origin: string | null;
}) {
  const navigate = useNavigate();
  const desktop = useIsDesktopShell();
  const { data: account } = useCurrentAccount();
  const preferences = account?.account.preferences;
  const autoplay = preferences?.autoplay ?? true;

  const chrome = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  // No account answer at all (playing a kept download with no server reachable) is not a
  // "locked profile" — the family-safety gates only mean something when a profile is known.
  const canSwitchSubtitles = preferences ? preferences.subtitleMode !== "off" : true;
  const canSwitchAudio = preferences ? preferences.canSwitchTracks : true;
  const showTracks = canSwitchSubtitles || canSwitchAudio;
  /** The `c` shortcut and the bar button share one gate: a locked profile never sees the panel. */
  const openPanel = useCallback(
    (next: PanelKind) => {
      if (next === "tracks" && !showTracks) return;
      setPanel(next);
    },
    [showTracks],
  );

  const feedback = useFeedback();
  const controls = useControlsVisibility({ pinned: panel !== null });
  // Filled by the effect below once every hook it points at exists; the session only reads it
  // from event handlers, well after mount.
  const callbacks = useRef<SessionCallbacks>({
    showFeedback: () => {},
    onPointerMoved: () => {},
    persistProgress: () => {},
  });

  const session = usePlayerSession({
    enabled: desktop,
    installmentId,
    episodeId,
    autoplay,
    callbacks,
  });
  const progress = useProgressPersistence({
    enabled: desktop,
    installmentId,
    episodeId,
    tick: session.tick,
    duration: session.duration,
    subtitleOffsetMs: session.subtitleOffsetMs,
  });
  useEffect(() => {
    callbacks.current = {
      showFeedback: feedback.show,
      onPointerMoved: controls.wake,
      persistProgress: progress.persist,
    };
  }, [feedback.show, controls.wake, progress.persist]);

  const actions = usePlayerActions({
    session,
    showFeedback: feedback.show,
    persistProgress: progress.persist,
    resetProgress: progress.reset,
  });

  const title = useQuery({
    queryKey: ["player", "title", titleId],
    queryFn: () => getTitle(titleId),
    enabled: desktop && Boolean(titleId),
    staleTime: 60_000,
  });
  const titlePlayback = useQuery({
    queryKey: ["account", "playback", "title", titleId],
    queryFn: () => getPlaybackForTitle(titleId),
    enabled: desktop && Boolean(titleId) && Boolean(episodeId),
  });
  const seasons = useMemo(
    () => playerSeasons(title.data, titlePlayback.data),
    [title.data, titlePlayback.data],
  );
  const currentEpisode = findEpisode(seasons, installmentId, episodeId);
  const nextEpisode = nextUnwatchedEpisode(seasons, installmentId, episodeId);
  const installment = title.data?.installments.find((entry) => entry.id === installmentId);
  const heading = title.data?.titleAr ?? title.data?.canonicalTitle ?? null;
  const downloadTarget = useMemo(
    () =>
      title.data
        ? {
            titleId,
            titleName: title.data.canonicalTitle || title.data.titleAr || titleId,
            installmentId,
            episodeId,
            label: currentEpisode
              ? formatEpisodeCode(currentEpisode.seasonNumber, currentEpisode.episodeNumber)
              : (installment?.title ?? "الفيلم"),
          }
        : null,
    [title.data, titleId, installmentId, episodeId, currentEpisode, installment],
  );
  const subheading = currentEpisode
    ? `${formatEpisodeCode(currentEpisode.seasonNumber, currentEpisode.episodeNumber)}${
        currentEpisode.episodeTitle ? ` — ${currentEpisode.episodeTitle}` : ""
      }`
    : (installment?.title ?? null);

  const leave = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (origin) {
      window.location.assign(origin);
      return;
    }
    void navigate({ to: "/titles/$titleId", params: { titleId } });
  }, [navigate, origin, titleId]);

  const playEpisode = useCallback(
    (episode: PlayerEpisode) => {
      session.setPlaybackEnded(false);
      void navigate({
        to: "/player/$installmentId",
        params: { installmentId: episode.installmentId },
        search: { titleId, episodeId: episode.episodeId, origin },
        replace: true,
      });
    },
    [navigate, origin, session, titleId],
  );
  const playNext = useCallback(() => {
    if (nextEpisode) playEpisode(nextEpisode);
  }, [nextEpisode, playEpisode]);

  usePlayerShortcuts({
    enabled: desktop && session.status !== "error" && !session.playbackEnded,
    panelOpen: panel !== null,
    chrome,
    actions,
    hasNextEpisode: nextEpisode !== null,
    onLeave: leave,
    onOpenPanel: openPanel,
    onPlayNext: playNext,
    cycleLock: controls.cycleLock,
    showFeedback: feedback.show,
    wakeControls: controls.wake,
  });

  // The whole document is black only while the player is mounted.
  useEffect(() => {
    document.body.classList.add("arcadia-player-open");
    return () => document.body.classList.remove("arcadia-player-open");
  }, []);

  // Only the pre-first-frame states get the centred badge; mid-film buffering lives in the top bar.
  const starting = session.status === "starting" || session.status === "resolving";
  const showChrome = controls.visible || session.paused;
  useOverlayRegions({
    enabled: desktop,
    hasPicture: session.hasPicture,
    anythingVisible: showChrome || starting || session.playbackEnded || panel !== null,
    feedbackActive: feedback.active,
  });

  if (!desktop) return <FailureScreen failure="not_desktop" detail={null} onBack={leave} />;
  if (session.status === "error") {
    return (
      <FailureScreen
        failure={session.failure?.kind ?? "unknown"}
        detail={session.failure?.detail ?? null}
        onBack={leave}
      />
    );
  }

  const label = busyLabel(
    session.status,
    session.attempt,
    session.peers,
    session.localPath !== null,
  );
  const activeVideoHash =
    session.candidates.find((candidate) => candidate.id === session.activeCandidateId)?.videoHash ??
    null;

  // Everything inside sits over the video plane; black/white here is intentional.
  return (
    <main ref={chrome} data-on-artwork className="fixed inset-0 bg-black text-white" dir="rtl">
      <TouchStage
        chromeVisible={showChrome}
        onShow={controls.wake}
        onHide={controls.hide}
        onSeekBackward={() => void actions.seekBackward()}
        onSeekForward={() => void actions.seekForward()}
      />

      {starting && <LoadingBadge label={label} />}

      {session.playbackEnded && (
        <EndedOverlay
          nextEpisode={nextEpisode}
          autoplayNext={autoplay}
          onPlayNext={playNext}
          onLeave={leave}
        />
      )}

      {/* Hidden chrome is `hidden` (display: none), not `invisible`, so the surface sees no box. */}
      <div className={showChrome && !session.playbackEnded ? "contents" : "hidden"}>
        <TopBar
          heading={heading}
          subheading={subheading}
          buffering={session.status === "buffering"}
          bufferingLabel={label}
          softwareDecode={session.softwareDecode}
          onBack={leave}
        />
        {!starting && (
          <MobileTransport
            paused={session.paused}
            onTogglePlay={() => void actions.togglePlay()}
            onSeekBackward={() => void actions.seekBackward()}
            onSeekForward={() => void actions.seekForward()}
          />
        )}
        <ControlBar
          paused={session.paused}
          duration={session.duration}
          actions={actions}
          tick={session.tick}
          showTracks={showTracks}
          showEpisodes={seasons.length > 0}
          hasNextEpisode={nextEpisode !== null}
          sourceCount={session.candidates.length}
          onOpenPanel={openPanel}
          onPlayNext={playNext}
        />
      </div>

      {panel && (
        <PlayerPanels
          panel={panel}
          onOpenPanel={openPanel}
          onClose={closePanel}
          actions={actions}
          session={session}
          seasons={seasons}
          installmentId={installmentId}
          episodeId={episodeId}
          videoHash={activeVideoHash}
          canSwitchAudio={canSwitchAudio}
          canSwitchSubtitles={canSwitchSubtitles}
          onPlayEpisode={playEpisode}
          downloadTarget={downloadTarget}
        />
      )}

      {/* Outside the chrome gate: its whole point is confirming a shortcut while the bar is hidden. */}
      <CenterFeedback event={feedback.event} nonce={feedback.nonce} />
    </main>
  );
}
