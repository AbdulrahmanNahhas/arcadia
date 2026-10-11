import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, LoaderCircle } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { nativeCall } from "@/lib/bridge";

import type { PlayerSnapshot } from "./bridge";
import { PlayerPopover } from "./player-panels";

const KeepReplySchema = z.object({ ok: z.literal(true) });

export function DownloadControl({
  snapshot,
  open,
  onOpenChange,
}: {
  snapshot: PlayerSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const sessionId = snapshot.sessionId;
  const keep = useMutation({
    mutationKey: ["native", "keep", sessionId],
    mutationFn: async () => {
      if (!sessionId || snapshot.sourceKind !== "torrent")
        throw new Error("لا يوجد تورنت جارٍ للاحتفاظ به.");
      return KeepReplySchema.parse(await nativeCall("media.keep", { sessionId }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["native", "downloads"] }),
    retry: false,
    networkMode: "always",
  });
  return (
    <PlayerPopover
      title="تنزيل الفيديو"
      icon={<Download data-icon="inline-start" />}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {snapshot.sourceKind === "torrent"
            ? "احتفظ بملف الفيديو على هذا الجهاز. يتابع التنزيل من التورنت الجاري دون بدء نقل جديد، ويستمر بعد إغلاق المشغّل ما دام التطبيق مفتوحًا."
            : snapshot.sourceKind === "local"
              ? "هذا الفيديو موجود على جهازك بالفعل؛ لا يحتاج إلى تنزيل."
              : "اختر مصدر تورنت أولًا، ثم يمكنك الاحتفاظ بتنزيله على جهازك."}
        </p>
        {snapshot.sourceKind === "torrent" && (
          <Button disabled={keep.isPending || keep.isSuccess} onClick={() => keep.mutate()}>
            {keep.isPending ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : keep.isSuccess ? (
              <Check data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {keep.isPending
              ? "جارٍ تثبيت التنزيل…"
              : keep.isSuccess
                ? "أُضيف إلى قائمة التنزيل"
                : "الاحتفاظ بتنزيل الفيديو"}
          </Button>
        )}
        {keep.isSuccess && (
          <p role="status" className="text-sm">
            يتابع التطبيق تنزيل الفيديو على هذا الجهاز.
          </p>
        )}
        {keep.error && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر الاحتفاظ بالتنزيل</AlertTitle>
            <AlertDescription>{keep.error.message}</AlertDescription>
          </Alert>
        )}
      </div>
    </PlayerPopover>
  );
}
