import { useQuery } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { checkEpisodeDeletion } from "./document.functions";

export function EpisodeDelete({
  workId,
  episodeId,
  number,
  onDelete,
}: {
  workId: string;
  episodeId?: string;
  number: number;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["database", "episode-deletion", workId, episodeId],
    queryFn: ({ signal }) => {
      if (!episodeId) return Promise.resolve([]);
      return checkEpisodeDeletion({ data: { workId, episodeId }, signal });
    },
    enabled: open,
    staleTime: 0,
  });
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`حذف الحلقة ${number}`}
        onClick={() => setOpen(true)}
      >
        <TrashIcon data-icon="inline-start" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحلقة {number}؟</AlertDialogTitle>
            <AlertDialogDescription>
              ستُزال من المسودة. يظهر الحذف في مراجعة التغييرات، ولا يُطبَّق حتى تأكيد الحفظ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {query.isPending && (
            <p className="text-sm text-muted-foreground">جارٍ التحقق من السجلات المرتبطة…</p>
          )}
          {query.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر التحقق</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
              <Button variant="outline" onClick={() => void query.refetch()}>
                إعادة المحاولة
              </Button>
            </Alert>
          )}
          {!!query.data?.length && (
            <Alert variant="destructive">
              <AlertTitle>الحلقة مرتبطة ببيانات محفوظة</AlertTitle>
              <AlertDescription>
                لا يمكن حذفها قبل معالجة الروابط لحماية الملفات وسجل المشاهدة.{" "}
                {query.data.map((row) => `${row.table}: ${row.count}`).join("، ")}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={query.isPending || query.isError || !!query.data?.length}
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
            >
              حذف من المسودة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
