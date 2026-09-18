import type { StreamCandidate } from "@arcadia/contracts";
import { StackIcon } from "@phosphor-icons/react";
import { formatBytes } from "../format";
import { languageInfo } from "../languages";
import { PanelItem, PanelNote, PanelSection, PanelShell } from "./panel-shell";

/**
 * Every stream the API ranked, best first, with the one playing marked. Picking another restarts
 * playback from the current position on that source (see `switchSource` in
 * `use-player-session.ts`) — useful when auto-ranking picked a dead or wrong-language release.
 */
export function SourcePanel({
  candidates,
  activeCandidateId,
  onSelect,
  onClose,
}: {
  candidates: StreamCandidate[];
  activeCandidateId: string | null;
  onSelect: (candidateId: string) => void;
  onClose: () => void;
}) {
  return (
    <PanelShell title="مصدر التشغيل" icon={<StackIcon size={20} />} onClose={onClose} wide>
      <PanelSection title={`${candidates.length} مصدر متاح — مرتّبة حسب الجودة`}>
        {candidates.length === 0 && <PanelNote>لا توجد مصادر.</PanelNote>}
        {candidates.map((candidate) => {
          const languages = candidate.languages.map(languageInfo);
          return (
            <PanelItem
              key={candidate.id}
              leading={
                <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-white/8 py-1.5 font-mono text-[11px] font-semibold uppercase text-white/90">
                  {candidate.quality === "unknown" ? "؟" : candidate.quality}
                </span>
              }
              label={
                <span dir="ltr" className="block truncate text-start">
                  {candidate.filename ?? candidate.label}
                </span>
              }
              description={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {languages.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      {languages.map((language) => (
                        <span key={language.code} role="img" aria-label={language.label}>
                          {language.flag}
                        </span>
                      ))}
                    </span>
                  )}
                  {candidate.seeders !== null && <span>{candidate.seeders} بذرة</span>}
                  {candidate.sizeBytes !== null && <span>{formatBytes(candidate.sizeBytes)}</span>}
                  {candidate.provider && <span>{candidate.provider}</span>}
                  {candidate.kind === "direct" && <span>رابط مباشر</span>}
                </span>
              }
              selected={candidate.id === activeCandidateId}
              onClick={() => {
                onSelect(candidate.id);
                onClose();
              }}
            />
          );
        })}
      </PanelSection>
    </PanelShell>
  );
}
