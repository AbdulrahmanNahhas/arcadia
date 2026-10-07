import { CheckCircleIcon, ListNumbersIcon, PlayIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PlayerEpisode, PlayerSeason } from "../episodes";
import { PanelItem, PanelNote, PanelSection, PanelShell, PanelTabs } from "./panel-shell";

/**
 * Jump anywhere in the series without leaving the player. Seasons are the tab strip (Left/Right
 * on a remote), episodes the list; the one playing is marked, watched ones get a check.
 */
export function EpisodesPanel({
  seasons,
  currentInstallmentId,
  currentEpisodeId,
  onSelect,
  onClose,
}: {
  seasons: PlayerSeason[];
  currentInstallmentId: string;
  currentEpisodeId: string | null;
  onSelect: (episode: PlayerEpisode) => void;
  onClose: () => void;
}) {
  const [seasonId, setSeasonId] = useState(
    seasons.some((season) => season.installmentId === currentInstallmentId)
      ? currentInstallmentId
      : (seasons[0]?.installmentId ?? ""),
  );
  const season = seasons.find((entry) => entry.installmentId === seasonId) ?? null;

  return (
    <PanelShell
      title="الحلقات"
      icon={<ListNumbersIcon size={20} />}
      onClose={onClose}
      wide
      tabs={
        seasons.length > 1 ? (
          <div className="overflow-x-auto">
            <PanelTabs
              value={seasonId}
              onChange={setSeasonId}
              options={seasons.map((entry) => ({
                key: entry.installmentId,
                label: `الموسم ${entry.seasonNumber}`,
              }))}
            />
          </div>
        ) : undefined
      }
    >
      <PanelSection title={season?.title}>
        {!season && <PanelNote>لا توجد حلقات.</PanelNote>}
        {season?.episodes.map((episode) => {
          const current = episode.episodeId === currentEpisodeId;
          return (
            <PanelItem
              key={episode.episodeId}
              leading={
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg font-mono text-sm tabular-nums",
                    current ? "bg-white text-black" : "bg-white/8 text-white/80",
                  )}
                >
                  {current ? <PlayIcon weight="fill" size={16} /> : episode.episodeNumber}
                </span>
              }
              label={episode.episodeTitle ?? `الحلقة ${episode.episodeNumber}`}
              description={
                [
                  episode.runtimeMinutes ? `${episode.runtimeMinutes} د` : null,
                  episode.playable ? null : "غير متاحة للتشغيل بعد",
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              selected={current}
              disabled={!episode.playable}
              onClick={() => {
                if (!current) onSelect(episode);
                onClose();
              }}
              trailing={
                episode.played ? (
                  <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-white/60" />
                ) : (
                  <span />
                )
              }
            />
          );
        })}
      </PanelSection>
    </PanelShell>
  );
}
