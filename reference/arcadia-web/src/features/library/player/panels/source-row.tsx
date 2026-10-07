import type { StreamCandidate } from "@arcadia/contracts";
import type { ReactNode } from "react";
import { sourceHints } from "../../source-hints";
import { formatBytes } from "../format";
import { languageInfo } from "../languages";
import { PanelItem } from "./panel-shell";

/**
 * One ranked source, the same row whether it is being picked to *play* (source panel) or to
 * *download* (download picker): quality, the release name, language flags, the dub/subtitle
 * words the release advertises, seeders, size, indexer.
 */
export function SourceRow({
  candidate,
  selected = false,
  trailing,
  onClick,
}: {
  candidate: StreamCandidate;
  selected?: boolean;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  const languages = candidate.languages.map(languageInfo);
  const hints = sourceHints(candidate);
  return (
    <PanelItem
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
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {languages.length > 0 && (
            <span className="inline-flex items-center gap-1" title="لغات الصوت المُعلنة">
              {languages.map((language) => (
                <span key={language.code} role="img" aria-label={language.label}>
                  {language.flag}
                </span>
              ))}
            </span>
          )}
          {hints.map((hint) => (
            <span
              key={hint.key}
              className={
                hint.kind === "audio"
                  ? "rounded-md bg-primary/25 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground"
                  : "rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-white/80"
              }
            >
              {hint.label}
            </span>
          ))}
          {candidate.seeders !== null && <span>{candidate.seeders} بذرة</span>}
          {candidate.sizeBytes !== null && <span>{formatBytes(candidate.sizeBytes)}</span>}
          {candidate.provider && <span>{candidate.provider}</span>}
          {candidate.kind === "direct" && <span>رابط مباشر</span>}
        </span>
      }
      selected={selected}
      trailing={trailing}
      onClick={onClick}
    />
  );
}
