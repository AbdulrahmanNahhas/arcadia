import { CloudArrowDownIcon, WifiHighIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type PlayerEvent,
  subscribeToPlayer,
  type TransferProgress,
} from "@/features/library/desktop-player";
import { useIsDesktopShell } from "@/features/library/play-button";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 ميغابايت";
  const units = ["بايت", "كيلوبايت", "ميغابايت", "غيغابايت"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * Desktop-only "active downloads" card. Subscribes to the same `subscribeToPlayer` channel the
 * player route uses — no new Tauri command needed, since `AppState` already exposes exactly one
 * transfer-progress pump. Leaving the player route stops the torrent on purpose (see
 * `player-page.tsx`), so this honestly shows an idle state whenever nothing is actively streaming
 * rather than fabricating cross-route "background download" data the current architecture doesn't
 * have — it lights up automatically the moment a stream starts elsewhere in the app.
 */
export function ActiveTransferWidget() {
  const desktop = useIsDesktopShell();
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    const onEvent = (event: PlayerEvent) => {
      if (cancelled) return;
      if (event.type === "transfer") setTransfer(event);
      else if (event.type === "idle" || event.type === "ended") setTransfer(null);
    };
    subscribeToPlayer(onEvent).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [desktop]);
  if (!desktop) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudArrowDownIcon className="text-primary" /> التنزيلات النشطة
        </CardTitle>
        <CardDescription>سرعة النقل والنظراء أثناء تشغيل عمل من التطبيق.</CardDescription>
      </CardHeader>
      <CardContent>
        {transfer ? (
          <div className="space-y-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${transfer.totalBytes ? Math.min(100, (transfer.downloadedBytes / transfer.totalBytes) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2 font-mono text-xs text-muted-foreground">
              <span>
                {formatBytes(transfer.downloadedBytes)}
                {transfer.totalBytes ? ` / ${formatBytes(transfer.totalBytes)}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <WifiHighIcon /> {formatBytes(transfer.downloadRateBps)}/ث ·{" "}
                {transfer.peersConnected} نظير
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            لا يوجد تنزيل نشط الآن — تظهر السرعة والنظراء هنا فور بدء تشغيل عمل من مساحتك.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
