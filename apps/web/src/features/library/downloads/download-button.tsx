import { CheckCircleIcon, DownloadSimpleIcon, SpinnerIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsDesktopShell } from "../play-button";
import { type DownloadTarget, startDownload, useDownloadFor } from "./api";

/**
 * "تنزيل" for one film or episode. Desktop-only — in a browser it renders nothing at all rather
 * than a disabled control, since a download has no meaning without a disk to put it on. Once the
 * row exists the button becomes its status: a percentage while transferring, "متاح دون اتصال"
 * when done, both linking to the Downloads page.
 */
export function DownloadButton({
  target,
  size = "default",
  variant = "outline",
  className,
  compact = false,
}: {
  target: DownloadTarget;
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
  /** Icon-only, for card overlays. */
  compact?: boolean;
}) {
  const desktop = useIsDesktopShell();
  const existing = useDownloadFor(target.installmentId, target.episodeId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!desktop) return null;

  if (existing) {
    const done = existing.state === "completed";
    const percent =
      existing.sizeBytes > 0
        ? Math.min(100, Math.round((existing.downloadedBytes / existing.sizeBytes) * 100))
        : 0;
    const label = done
      ? "متاح دون اتصال"
      : existing.state === "failed"
        ? "فشل التنزيل"
        : existing.state === "paused"
          ? `متوقّف ${percent}٪`
          : `${percent}٪`;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              to="/downloads"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md text-xs font-medium",
                compact
                  ? "size-7 justify-center bg-background/70 backdrop-blur-md"
                  : "h-9 border border-border px-3",
                done ? "text-primary" : "text-foreground/80",
                className,
              )}
              aria-label={label}
            />
          }
        >
          {done ? (
            <CheckCircleIcon weight="fill" />
          ) : existing.state === "downloading" ? (
            <SpinnerIcon className="animate-spin" />
          ) : (
            <DownloadSimpleIcon />
          )}
          {!compact && label}
        </TooltipTrigger>
        <TooltipContent>{done ? existing.path : label}</TooltipContent>
      </Tooltip>
    );
  }

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await startDownload(target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر بدء التنزيل.");
    } finally {
      setPending(false);
    }
  };

  const button = (
    <Button
      size={compact ? "icon-sm" : size}
      variant={variant}
      className={cn(compact && "size-7 rounded-full bg-background/70 backdrop-blur-md", className)}
      disabled={pending}
      onClick={() => void start()}
      aria-label={compact ? `تنزيل ${target.label}` : undefined}
      title={error ?? undefined}
    >
      {pending ? (
        <SpinnerIcon className="animate-spin" data-icon={compact ? undefined : "inline-start"} />
      ) : (
        <DownloadSimpleIcon data-icon={compact ? undefined : "inline-start"} />
      )}
      {!compact && (error ? "تعذّر التنزيل" : "تنزيل")}
    </Button>
  );
  if (!error) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{error}</TooltipContent>
    </Tooltip>
  );
}
