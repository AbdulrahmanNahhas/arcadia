import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { nativeCall } from "@/lib/bridge";

const CacheReply = z.object({
  removed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export function CacheControl() {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const cleanup = useMutation({
    mutationFn: async () =>
      CacheReply.parse(await nativeCall("media.deleteCache", {}, undefined, 60000)),
    onSuccess: () => {
      setConfirm(false);
      return client.invalidateQueries({ queryKey: ["native", "downloads"] });
    },
    retry: false,
    networkMode: "always",
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        حذف ملفات التورنت المؤقتة غير المستخدمة فقط. تبقى الفيديوهات المحفوظة؛ يُتجاوز التشغيل النشط
        والتنزيل غير المكتمل والمجلدات القديمة.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={cleanup.isPending}
          onClick={() => (confirm ? cleanup.mutate() : setConfirm(true))}
        >
          <Trash2 data-icon="inline-start" />
          {cleanup.isPending
            ? "جارٍ التنظيف…"
            : confirm
              ? "تأكيد حذف الذاكرة المؤقتة"
              : "حذف الذاكرة المؤقتة للتنزيلات"}
        </Button>
        {confirm && (
          <Button variant="ghost" disabled={cleanup.isPending} onClick={() => setConfirm(false)}>
            إلغاء
          </Button>
        )}
      </div>
      {cleanup.data && (
        <Alert>
          <AlertTitle>اكتمل التنظيف</AlertTitle>
          <AlertDescription>
            حُذفت {cleanup.data.removed} ملفات تورنت مؤقتة؛ تم تجاوز {cleanup.data.skipped} للحفاظ
            على التشغيل والتنزيلات.
          </AlertDescription>
        </Alert>
      )}
      {cleanup.error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر التنظيف</AlertTitle>
          <AlertDescription>{cleanup.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
