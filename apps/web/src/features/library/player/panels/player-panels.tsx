import type { PlayerEpisode, PlayerSeason } from "../episodes";
import type { PlayerActions } from "../hooks/use-player-actions";
import type { PlayerSession } from "../hooks/use-player-session";
import type { PanelKind } from "../types";
import { EpisodesPanel } from "./episodes-panel";
import { MorePanel } from "./more-panel";
import { SourcePanel } from "./source-panel";
import { SpeedPanel } from "./speed-panel";
import { TracksPanel } from "./tracks-panel";

/** Routes the one open panel to its component; keeps `player-page.tsx` free of per-panel props. */
export function PlayerPanels({
  panel,
  onOpenPanel,
  onClose,
  actions,
  session,
  seasons,
  installmentId,
  episodeId,
  videoHash,
  canSwitchAudio,
  canSwitchSubtitles,
  onPlayEpisode,
}: {
  panel: PanelKind;
  onOpenPanel: (panel: PanelKind) => void;
  onClose: () => void;
  actions: PlayerActions;
  session: PlayerSession;
  seasons: PlayerSeason[];
  installmentId: string;
  episodeId: string | null;
  videoHash: string | null;
  canSwitchAudio: boolean;
  canSwitchSubtitles: boolean;
  onPlayEpisode: (episode: PlayerEpisode) => void;
}) {
  switch (panel) {
    case "tracks":
      return (
        <TracksPanel
          canSwitchAudio={canSwitchAudio}
          canSwitchSubtitles={canSwitchSubtitles}
          installmentId={installmentId}
          episodeId={episodeId}
          videoHash={videoHash}
          subtitleOffsetMs={session.subtitleOffsetMs}
          onSetSubtitleOffsetMs={session.setSubtitleOffsetMs}
          onClose={onClose}
        />
      );
    case "speed":
      return (
        <SpeedPanel
          speed={actions.speed}
          onSetSpeed={(speed) => void actions.changeSpeed(speed)}
          onClose={onClose}
        />
      );
    case "source":
      return (
        <SourcePanel
          candidates={session.candidates}
          activeCandidateId={session.activeCandidateId}
          onSelect={(candidateId) => void session.switchSource(candidateId)}
          onClose={onClose}
        />
      );
    case "episodes":
      return (
        <EpisodesPanel
          seasons={seasons}
          currentInstallmentId={installmentId}
          currentEpisodeId={episodeId}
          onSelect={onPlayEpisode}
          onClose={onClose}
        />
      );
    case "more":
      return (
        <MorePanel
          actions={actions}
          sourceCount={session.candidates.length}
          onOpenPanel={onOpenPanel}
          onClose={onClose}
        />
      );
    default:
      return null;
  }
}
