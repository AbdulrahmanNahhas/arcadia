import type { SubtitleCandidate } from "@arcadia/contracts";
import { DownloadSimpleIcon, MinusIcon, PlusIcon, ProhibitIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { desktopPlayer } from "../../desktop-player";
import { downloadInstallmentSubtitle, getInstallmentSubtitles } from "../../subtitle-resolver";
import { SUBTITLE_OFFSET_STEP_MS } from "../constants";
import { CURATED_SUBTITLE_LANGUAGES } from "../languages";
import { groupPlayerTracks, groupSubtitleCandidates, trackVariantLabel } from "../track-groups";
import { LanguageGroupList } from "./language-group-list";
import { PanelItem, PanelNote, PanelSection } from "./panel-shell";
import { usePlayerTracks } from "./use-player-tracks";

/**
 * Embedded tracks from mpv's `track-list`, OpenSubtitles results to download, and the live
 * `sub-delay` offset — one tab, since whoever opens "الترجمة" wants whichever of the three
 * actually gets them a caption. "Show all languages" re-queries the API without its default
 * Arabic/English/Spanish filter (`languages=all`).
 */
export function SubtitlesTab({
  installmentId,
  episodeId,
  videoHash,
  offsetMs,
  onSetOffsetMs,
}: {
  installmentId: string;
  episodeId: string | null;
  videoHash: string | null;
  offsetMs: number;
  onSetOffsetMs: (ms: number) => void;
}) {
  const { tracks, select, refresh } = usePlayerTracks("sub");
  const [showAllEmbedded, setShowAllEmbedded] = useState(false);
  const [expandedEmbedded, setExpandedEmbedded] = useState<string | null>(null);
  const embedded = groupPlayerTracks(tracks ?? [], {
    curated: CURATED_SUBTITLE_LANGUAGES,
    showAll: showAllEmbedded,
  });
  const noneSelected = tracks?.every((track) => !track.selected) ?? false;

  const [showAllDownloads, setShowAllDownloads] = useState(false);
  const [expandedDownload, setExpandedDownload] = useState<string | null>(null);
  const [applyingFileId, setApplyingFileId] = useState<number | null>(null);
  const search = useQuery({
    queryKey: ["player", "subtitles", installmentId, episodeId, videoHash, showAllDownloads],
    queryFn: () =>
      getInstallmentSubtitles(installmentId, {
        episodeId,
        videoHash,
        languages: showAllDownloads ? "all" : CURATED_SUBTITLE_LANGUAGES.join(","),
      }).then((result) => result.candidates),
    staleTime: 5 * 60_000,
    retry: false,
  });
  // A failed search reads as "nothing available" rather than an error state: the family can't
  // do anything about OpenSubtitles being down from inside the player.
  const candidates: SubtitleCandidate[] | null = search.isError ? [] : (search.data ?? null);

  const downloads = groupSubtitleCandidates(candidates ?? [], {
    curated: CURATED_SUBTITLE_LANGUAGES,
    // The API already filtered server-side, so everything that came back is shown.
    showAll: true,
  });

  const applyCandidate = async (candidate: SubtitleCandidate) => {
    setApplyingFileId(candidate.fileId);
    try {
      const file = await downloadInstallmentSubtitle(installmentId, candidate.fileId);
      await desktopPlayer.loadSubtitle(file.bytes, candidate.fileName ?? file.filename);
      await refresh();
    } catch {
      // Best-effort: the list stays as it was, nothing to load.
    } finally {
      setApplyingFileId(null);
    }
  };

  return (
    <>
      <PanelSection title="في الملف">
        <PanelItem
          leading={
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/8 text-white/80">
              <ProhibitIcon size={20} />
            </span>
          }
          label="بلا ترجمة"
          selected={noneSelected}
          onClick={() => void select("no")}
        />
        {tracks === null && <PanelNote>جارٍ قراءة المسارات…</PanelNote>}
        {tracks && (
          <LanguageGroupList
            groups={embedded.visible}
            hiddenCount={embedded.hiddenCount}
            showAll={showAllEmbedded}
            onToggleShowAll={() => setShowAllEmbedded((current) => !current)}
            expanded={expandedEmbedded}
            onToggleExpanded={(code) =>
              setExpandedEmbedded((current) => (current === code ? null : code))
            }
            itemKey={(track) => track.id}
            itemSelected={(track) => track.selected}
            itemLabel={trackVariantLabel}
            itemDescription={(track) => track.title ?? undefined}
            onSelect={(track) => void select(track.id)}
            emptyNote={<PanelNote>لا توجد مسارات ترجمة مضمّنة في هذا الملف.</PanelNote>}
          />
        )}
      </PanelSection>

      <PanelSection title="تنزيل ترجمة">
        {candidates === null && <PanelNote>جارٍ البحث…</PanelNote>}
        {candidates && (
          <LanguageGroupList
            groups={downloads.visible}
            hiddenCount={0}
            showAll={showAllDownloads}
            onToggleShowAll={() => setShowAllDownloads((current) => !current)}
            expanded={expandedDownload}
            onToggleExpanded={(code) =>
              setExpandedDownload((current) => (current === code ? null : code))
            }
            itemKey={(candidate) => String(candidate.fileId)}
            itemSelected={() => false}
            itemLabel={(candidate) => candidate.release ?? candidate.fileName ?? "ترجمة"}
            itemDescription={(candidate) =>
              [
                candidate.matchedBy === "hash" ? "مطابقة دقيقة" : "مطابقة بالمعرّف",
                candidate.downloadCount !== null ? `${candidate.downloadCount} تنزيل` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            }
            onSelect={(candidate) => void applyCandidate(candidate)}
            busyKey={applyingFileId === null ? null : String(applyingFileId)}
            emptyNote={<PanelNote>لا توجد ترجمات متاحة للتنزيل.</PanelNote>}
          />
        )}
        {candidates && !showAllDownloads && (
          <PanelItem
            leading={
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/8 text-white/80">
                <DownloadSimpleIcon size={20} />
              </span>
            }
            label="البحث في كل اللغات"
            description="يعرض ما يتجاوز العربية والإنجليزية والإسبانية"
            onClick={() => setShowAllDownloads(true)}
            trailing={<span />}
          />
        )}
      </PanelSection>

      <PanelSection title="توقيت الترجمة">
        <div data-panel-row className="flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="text-sm">إزاحة الترجمة</span>
          <div className="flex items-center gap-1">
            <OffsetButton
              label="تأخير الترجمة"
              onClick={() => onSetOffsetMs(offsetMs - SUBTITLE_OFFSET_STEP_MS)}
            >
              <MinusIcon size={14} />
            </OffsetButton>
            <span dir="ltr" className="w-16 text-center font-mono text-sm tabular-nums">
              {offsetMs > 0 ? "+" : ""}
              {(offsetMs / 1000).toFixed(1)}s
            </span>
            <OffsetButton
              label="تقديم الترجمة"
              onClick={() => onSetOffsetMs(offsetMs + SUBTITLE_OFFSET_STEP_MS)}
            >
              <PlusIcon size={14} />
            </OffsetButton>
            {offsetMs !== 0 && (
              <OffsetButton label="إعادة الضبط" onClick={() => onSetOffsetMs(0)}>
                <span className="text-[11px]">0</span>
              </OffsetButton>
            )}
          </div>
        </div>
      </PanelSection>
    </>
  );
}

function OffsetButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-panel-item
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full bg-white/8 text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
    >
      {children}
    </button>
  );
}
