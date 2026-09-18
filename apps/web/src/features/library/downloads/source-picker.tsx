import type { StreamCandidate } from "@arcadia/contracts";
import { DownloadSimpleIcon, SpinnerIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { noLocalLookup, PlaybackError, resolvePlayback } from "../playback-resolver";
import { PanelNote, PanelSection } from "../player/panels/panel-shell";
import { SourceRow } from "../player/panels/source-row";
import { type DownloadTarget, startDownload } from "./api";

/**
 * "Which release?" before a download starts — the same ranked list and the same row the player's
 * source panel shows (quality, flags, dub/subtitle words, seeders, size), dressed like the
 * player so the two feel like one thing. Picking a row starts that release and only that one.
 */
export function DownloadSourcePicker({
  target,
  open,
  onOpenChange,
  onStarted,
}: {
  target: DownloadTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted?: () => void;
}) {
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sources = useQuery({
    queryKey: ["downloads", "sources", target.installmentId, target.episodeId],
    queryFn: async () => {
      const source = await resolvePlayback(
        target.installmentId,
        target.episodeId,
        null,
        noLocalLookup,
      );
      return source.streams.candidates.filter((candidate) => candidate.kind === "torrent");
    },
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });

  const pick = async (candidate: StreamCandidate) => {
    setStarting(candidate.id);
    setError(null);
    try {
      await startDownload(target, [candidate]);
      onStarted?.();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر بدء التنزيل.");
    } finally {
      setStarting(null);
    }
  };

  const failure =
    sources.error instanceof PlaybackError
      ? sources.error.message
      : sources.error instanceof Error
        ? "تعذّر تحميل المصادر."
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-on-artwork
        className="max-w-2xl gap-0 border-white/10 bg-neutral-900 p-0 text-white sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-white/10 px-5 py-4 text-start">
          <DialogTitle className="flex items-center gap-2 text-white">
            <DownloadSimpleIcon size={20} />
            اختر مصدر التنزيل
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {target.titleName} — {target.label}. الأعلام وكلمات «صوت مزدوج/مدبلج» مأخوذة من اسم
            الإصدار كما أعلنه الناشر؛ المسارات الفعلية تظهر في المشغّل بعد التنزيل.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {sources.isPending ? (
            <PanelNote>
              <SpinnerIcon className="mx-auto mb-1 animate-spin" size={18} />
              جارٍ البحث عن المصادر…
            </PanelNote>
          ) : failure ? (
            <PanelNote>
              <WarningCircleIcon className="mx-auto mb-1" size={18} />
              {failure}
            </PanelNote>
          ) : (
            <PanelSection title={`${sources.data?.length ?? 0} مصدر — مرتّبة حسب الجودة`}>
              {sources.data?.length === 0 && <PanelNote>لا توجد مصادر لهذا العمل حالياً.</PanelNote>}
              {sources.data?.map((candidate) => (
                <SourceRow
                  key={candidate.id}
                  candidate={candidate}
                  trailing={
                    starting === candidate.id ? (
                      <SpinnerIcon className="shrink-0 animate-spin" size={18} />
                    ) : (
                      <DownloadSimpleIcon className="shrink-0 text-white/60" size={18} />
                    )
                  }
                  onClick={() => void pick(candidate)}
                />
              ))}
            </PanelSection>
          )}
          {error && (
            <p className="px-3 pb-2 text-center text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
