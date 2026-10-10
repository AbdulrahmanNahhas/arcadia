import { CheckCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Failure } from "../../components/status";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import type { WorkTracking } from "./use-work-tracking";

export function WatchedControl({
  tracking,
  installmentId,
  episodeId,
  label,
  compact = false,
}: {
  tracking: WorkTracking;
  installmentId?: string;
  episodeId?: string;
  label: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const data = tracking.state.data;
  const units =
    data?.units.filter(
      (unit) =>
        (!installmentId || unit.installmentId === installmentId) &&
        (!episodeId || unit.episodeId === episodeId),
    ) ?? [];
  const summary = installmentId
    ? data?.installments.find((item) => item.installmentId === installmentId)?.summary
    : data?.summary;
  const isPlayed = episodeId
    ? Boolean(units[0]?.isPlayed)
    : Boolean(summary?.isFullyWatched || (units.length && units.every((unit) => unit.isPlayed)));
  const disabled = !data || !units.length || tracking.pending;
  const text = isPlayed ? `إلغاء مشاهدة ${label}` : `تحديد ${label} كمُشاهَد`;
  const Icon = isPlayed ? CheckCircle : Eye;
  const mutate = () =>
    tracking.watched.mutate(
      { installmentId, episodeId, isPlayed: !isPlayed },
      { onSuccess: () => setOpen(false) },
    );
  const control = (
    <Button
      variant={isPlayed ? "secondary" : "outline"}
      size={compact ? "icon" : "default"}
      disabled={disabled}
      aria-label={text}
      aria-pressed={isPlayed}
      title={text}
      onClick={episodeId ? mutate : undefined}
    >
      <Icon data-icon="inline-start" />
      {!compact && (isPlayed ? "تمّت المشاهدة" : "تحديد كمُشاهَد")}
    </Button>
  );
  if (episodeId) return control;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={control} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text}</DialogTitle>
          <DialogDescription>
            يشمل هذا التغيير جميع الحلقات والإصدارات المسجّلة في {label}، بما فيها القادمة. العلامة
            يدوية ولا تغيّر تقدم التشغيل أو حالة الإصدار.
          </DialogDescription>
        </DialogHeader>
        {tracking.watched.error && <Failure error={tracking.watched.error} />}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إلغاء</DialogClose>
          <Button disabled={tracking.pending} onClick={mutate}>
            {isPlayed ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            {tracking.pending ? "جارٍ الحفظ…" : "تأكيد التغيير"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
