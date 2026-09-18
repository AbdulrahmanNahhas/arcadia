import { ArrowLeftIcon, CpuIcon } from "@phosphor-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ControlButton } from "./control-button";

/**
 * Back button, what's playing, and the two status pills that matter mid-film. Each pill is its own
 * `data-video-overlay` so the picture shows between them; a full-width top strip would black out
 * the top of the frame.
 */
export function TopBar({
  heading,
  subheading,
  buffering,
  bufferingLabel,
  softwareDecode,
  onBack,
}: {
  heading: string | null;
  subheading: string | null;
  buffering: boolean;
  bufferingLabel: string;
  softwareDecode: boolean;
  onBack: () => void;
}) {
  return (
    <div
      data-control-row="top"
      className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-3 sm:inset-x-5 sm:top-5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div data-video-overlay className="pointer-events-auto shrink-0 rounded-full">
          <ControlButton
            label="رجوع"
            hint="Esc"
            name="back"
            onClick={onBack}
            className="size-11 bg-neutral-900 ring-1 ring-white/10"
          >
            <ArrowLeftIcon size={22} className="rtl:rotate-180" />
          </ControlButton>
        </div>
        {heading && (
          <div
            data-video-overlay
            className="pointer-events-auto min-w-0 rounded-full bg-neutral-900 px-4 py-2 ring-1 ring-white/10"
          >
            <p className="truncate font-heading text-sm font-semibold leading-5 text-white">
              {heading}
            </p>
            {subheading && (
              <p className="truncate text-[11px] leading-4 text-white/60">{subheading}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {buffering && (
          <span
            data-video-overlay
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/60" />
              <span className="relative size-2 rounded-full bg-white" />
            </span>
            <span className="hidden sm:inline">{bufferingLabel}</span>
          </span>
        )}
        {softwareDecode && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  data-video-overlay
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-xs text-amber-200/90 ring-1 ring-amber-300/20"
                />
              }
            >
              <CpuIcon size={14} />
              <span className="hidden sm:inline">فكّ بالمعالج</span>
            </TooltipTrigger>
            <TooltipContent>
              لم يُفعَّل فك الترميز بكرت الشاشة — التشغيل يعتمد على المعالج
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
