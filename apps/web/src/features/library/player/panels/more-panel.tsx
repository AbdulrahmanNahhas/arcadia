import {
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CornersInIcon,
  CornersOutIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  GaugeIcon,
  StackIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { type DownloadTarget, startDownload, useDownloadFor } from "../../downloads/api";
import type { PlayerActions } from "../hooks/use-player-actions";
import type { PanelKind } from "../types";
import { PanelItem, PanelSection, PanelShell } from "./panel-shell";

/** The phone layout's overflow: everything the narrow bar had no room for. */
export function MorePanel({
  actions,
  sourceCount,
  localPath,
  downloadTarget,
  onOpenPanel,
  onClose,
}: {
  actions: PlayerActions;
  sourceCount: number;
  localPath: string | null;
  /** What "تنزيل" would keep; `null` while the title is still loading. */
  downloadTarget: DownloadTarget | null;
  onOpenPanel: (panel: PanelKind) => void;
  onClose: () => void;
}) {
  return (
    <PanelShell title="المزيد" icon={<DotsThreeIcon weight="bold" size={20} />} onClose={onClose}>
      <PanelSection>
        <PanelItem
          leading={
            <Glyph>{actions.speed === 1 ? <GaugeIcon size={20} /> : `${actions.speed}×`}</Glyph>
          }
          label="سرعة التشغيل"
          description={actions.speed === 1 ? "عادية" : `${actions.speed}×`}
          onClick={() => onOpenPanel("speed")}
          trailing={<span />}
        />
        <PanelItem
          leading={
            <Glyph>
              <StackIcon size={20} />
            </Glyph>
          }
          label="مصدر التشغيل"
          description={localPath ? "ملف محلي" : `${sourceCount} مصدر`}
          onClick={() => onOpenPanel("source")}
          trailing={<span />}
        />
        {downloadTarget && !localPath && <DownloadItem target={downloadTarget} />}
        <PanelItem
          leading={
            <Glyph>
              <ClockCounterClockwiseIcon size={20} />
            </Glyph>
          }
          label="ابدأ من البداية"
          onClick={() => {
            void actions.restart();
            onClose();
          }}
          trailing={<span />}
        />
        <PanelItem
          leading={
            <Glyph>
              {actions.fullscreen ? <CornersInIcon size={20} /> : <CornersOutIcon size={20} />}
            </Glyph>
          }
          label={actions.fullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          onClick={() => {
            void actions.toggleFullscreen();
            onClose();
          }}
          trailing={<span />}
        />
      </PanelSection>
    </PanelShell>
  );
}

/**
 * "تنزيل" from inside the player: the torrent being watched is continued in the download folder
 * once the film stops (`finish_stream` in `src-tauri/src/downloads/mod.rs`), so nothing already
 * fetched is fetched twice. The row turns into its status once the download exists.
 */
function DownloadItem({ target }: { target: DownloadTarget }) {
  const existing = useDownloadFor(target.installmentId, target.episodeId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percent =
    existing && existing.sizeBytes > 0
      ? Math.min(100, Math.round((existing.downloadedBytes / existing.sizeBytes) * 100))
      : 0;
  const description = existing
    ? existing.state === "completed"
      ? "متاح دون اتصال"
      : existing.state === "queued"
        ? "سيتابع بعد انتهاء المشاهدة"
        : `${percent}٪`
    : (error ?? "احفظ هذا الملف على الجهاز");
  return (
    <PanelItem
      leading={
        <Glyph>
          {existing?.state === "completed" ? (
            <CheckCircleIcon size={20} weight="fill" />
          ) : (
            <DownloadSimpleIcon size={20} />
          )}
        </Glyph>
      }
      label={existing ? "التنزيل" : "تنزيل"}
      description={pending ? "جارٍ البدء…" : description}
      onClick={() => {
        if (existing || pending) return;
        setPending(true);
        setError(null);
        startDownload(target)
          .catch((cause: Error) => setError(cause.message || "تعذّر بدء التنزيل."))
          .finally(() => setPending(false));
      }}
      trailing={<span />}
    />
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/8 font-mono text-xs text-white/85">
      {children}
    </span>
  );
}
