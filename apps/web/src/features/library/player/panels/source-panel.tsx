import type { StreamCandidate } from "@arcadia/contracts";
import { StackIcon } from "@phosphor-icons/react";
import { PanelNote, PanelSection, PanelShell } from "./panel-shell";
import { SourceRow } from "./source-row";

/**
 * Every stream the API ranked, best first, with the one playing marked. Picking another restarts
 * playback from the current position on that source (see `switchSource` in
 * `use-player-session.ts`) — useful when auto-ranking picked a dead or wrong-language release.
 */
export function SourcePanel({
  candidates,
  activeCandidateId,
  localPath,
  onSelect,
  onClose,
}: {
  candidates: StreamCandidate[];
  activeCandidateId: string | null;
  /** Set when a kept download is playing from disk — there are no stream candidates to switch. */
  localPath: string | null;
  onSelect: (candidateId: string) => void;
  onClose: () => void;
}) {
  if (localPath) {
    return (
      <PanelShell title="مصدر التشغيل" icon={<StackIcon size={20} />} onClose={onClose} wide>
        <PanelSection title="ملف محلي — يُشغَّل من هذا الجهاز دون شبكة">
          <PanelNote>
            <span dir="ltr" className="block break-all font-mono text-xs">
              {localPath}
            </span>
          </PanelNote>
        </PanelSection>
      </PanelShell>
    );
  }
  return (
    <PanelShell title="مصدر التشغيل" icon={<StackIcon size={20} />} onClose={onClose} wide>
      <PanelSection title={`${candidates.length} مصدر متاح — مرتّبة حسب الجودة`}>
        {candidates.length === 0 && <PanelNote>لا توجد مصادر.</PanelNote>}
        {candidates.map((candidate) => (
          <SourceRow
            key={candidate.id}
            candidate={candidate}
            selected={candidate.id === activeCandidateId}
            onClick={() => {
              onSelect(candidate.id);
              onClose();
            }}
          />
        ))}
      </PanelSection>
    </PanelShell>
  );
}
