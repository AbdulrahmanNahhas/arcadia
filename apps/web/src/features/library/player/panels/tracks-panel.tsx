import { SubtitlesIcon, WaveformIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { SubtitleSource } from "../../subtitle-resolver";
import { CURATED_AUDIO_LANGUAGES } from "../languages";
import { groupPlayerTracks, trackVariantLabel } from "../track-groups";
import { LanguageGroupList } from "./language-group-list";
import { PanelNote, PanelSection, PanelShell, PanelTabs } from "./panel-shell";
import { SubtitlesTab } from "./subtitles-tab";
import { usePlayerTracks } from "./use-player-tracks";

type Tab = "audio" | "subtitles";

/**
 * Audio and subtitles in one place, the way every streaming app presents them — a family member
 * reaching for "the language" shouldn't have to know whether their answer is a dub or a caption.
 * Either tab can be locked out per profile; with only one allowed the tab strip disappears.
 */
export function TracksPanel({
  canSwitchAudio,
  canSwitchSubtitles,
  subtitleSource,
  videoHash,
  subtitleOffsetMs,
  onSetSubtitleOffsetMs,
  onClose,
}: {
  canSwitchAudio: boolean;
  canSwitchSubtitles: boolean;
  subtitleSource: SubtitleSource;
  videoHash: string | null;
  subtitleOffsetMs: number;
  onSetSubtitleOffsetMs: (ms: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(canSwitchSubtitles ? "subtitles" : "audio");
  const both = canSwitchAudio && canSwitchSubtitles;
  return (
    <PanelShell
      title="الصوت والترجمة"
      icon={<SubtitlesIcon size={20} />}
      onClose={onClose}
      tabs={
        both ? (
          <PanelTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: "subtitles", label: "الترجمة", icon: <SubtitlesIcon size={16} /> },
              { key: "audio", label: "الصوت", icon: <WaveformIcon size={16} /> },
            ]}
          />
        ) : undefined
      }
    >
      {tab === "audio" && canSwitchAudio ? (
        <AudioTab />
      ) : (
        <SubtitlesTab
          source={subtitleSource}
          videoHash={videoHash}
          offsetMs={subtitleOffsetMs}
          onSetOffsetMs={onSetSubtitleOffsetMs}
        />
      )}
    </PanelShell>
  );
}

function AudioTab() {
  const { tracks, select } = usePlayerTracks("audio");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { visible, hiddenCount } = groupPlayerTracks(tracks ?? [], {
    curated: CURATED_AUDIO_LANGUAGES,
    showAll,
  });

  return (
    <PanelSection title="المسارات الصوتية في الملف">
      {tracks === null && <PanelNote>جارٍ قراءة المسارات…</PanelNote>}
      {tracks?.length === 1 && <PanelNote>مسار صوتي واحد فقط في هذا الملف.</PanelNote>}
      {tracks && tracks.length !== 1 && (
        <LanguageGroupList
          groups={visible}
          hiddenCount={hiddenCount}
          showAll={showAll}
          onToggleShowAll={() => setShowAll((current) => !current)}
          expanded={expanded}
          onToggleExpanded={(code) => setExpanded((current) => (current === code ? null : code))}
          itemKey={(track) => track.id}
          itemSelected={(track) => track.selected}
          itemLabel={trackVariantLabel}
          itemDescription={(track) => track.title ?? undefined}
          onSelect={(track) => void select(track.id)}
          emptyNote={<PanelNote>لا توجد مسارات صوتية في هذا الملف.</PanelNote>}
        />
      )}
    </PanelSection>
  );
}
