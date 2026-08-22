import { NotePencilIcon, TrashIcon, TrophyIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteAwardRecognition,
  getAwardOptions,
  getTitleAwardRecognitions,
} from "@/server/library.functions";
import { MutationErrorAlert } from "../components/mutation-error-alert";
import { type AdminAwardRecognition, AwardRecognitionForm } from "./recognition-editor";

/**
 * The title editor's Awards tab (Stage 2) — the same immediate-save `AwardRecognitionForm`
 * the standalone Awards management page uses, scoped to this one title instead of one
 * organization. Every add/edit/delete here saves instantly through
 * `/api/v1/admin/awards/recognitions`; it is no longer staged into the title's own draft and
 * written as part of the title's "Save" button — that duplicated write path (the API's old
 * `replaceTitleAwards`, a delete-then-reinsert on every title save) has been removed entirely.
 *
 * Requires the `awards.edit` capability, same as the standalone page — a session without it
 * gets a clear 403 message from the mutation (surfaced by `MutationErrorAlert`) rather than a
 * silently-broken form.
 */
export function TitleAwardsPanel({ titleId, titleLabel }: { titleId: string; titleLabel: string }) {
  const queryClient = useQueryClient();
  const recognitionsKey = ["admin", "awards", "by-title", titleId] as const;
  const optionsKey = ["admin", "awards", "options"] as const;
  const recognitions = useQuery({
    queryKey: recognitionsKey,
    queryFn: () => getTitleAwardRecognitions({ data: { titleId } }),
  });
  const options = useQuery({ queryKey: optionsKey, queryFn: getAwardOptions });
  const [editing, setEditing] = useState<AdminAwardRecognition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAwardRecognition | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: recognitionsKey });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAwardRecognition({ data: { id } }),
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
    },
  });

  if (recognitions.isPending || options.isPending) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (!options.data?.length) {
    return (
      <Empty className="rounded-3xl border">
        <EmptyHeader>
          <EmptyTitle>لا توجد جهات مانحة بعد</EmptyTitle>
          <EmptyDescription>
            أضف جهة مانحة وفئة واحدة على الأقل من صفحة إدارة الجوائز قبل تسجيل تكريم هنا.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "تعديل التكريم" : "إضافة فوز أو ترشيح"}</CardTitle>
          <CardDescription>
            يُحفظ كل تغيير فور تأكيده — لا حاجة لحفظ العمل لتثبيت الجوائز.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6">
          <AwardRecognitionForm
            key={editing?.id ?? "new"}
            organizations={options.data}
            fixedTitle={{ id: titleId, label: titleLabel }}
            recognition={editing}
            onSaved={refresh}
            onDone={() => setEditing(null)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>جوائز هذا العمل</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(recognitions.data ?? []).map((recognition) => (
            <div
              key={recognition.id}
              className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <TrophyIcon weight={recognition.result === "winner" ? "fill" : "duotone"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {recognition.organizationName}
                  {recognition.installmentTitle ? ` — ${recognition.installmentTitle}` : null}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{recognition.category}</Badge>
                  {recognition.year ? <Badge variant="outline">{recognition.year}</Badge> : null}
                  <Badge variant={recognition.result === "winner" ? "default" : "secondary"}>
                    {recognition.result === "winner" ? "فائز" : "مرشّح"}
                  </Badge>
                  {recognition.isFeatured ? <Badge>مُبرز</Badge> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(recognition)}>
                  <NotePencilIcon data-icon="inline-start" /> تعديل
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(recognition)}>
                  <TrashIcon data-icon="inline-start" /> حذف
                </Button>
              </div>
            </div>
          ))}
          {!recognitions.data?.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد جوائز مسجّلة</EmptyTitle>
                <EmptyDescription>استخدم النموذج أعلاه لإضافة أول فوز أو ترشيح.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>حذف التكريم؟</DialogTitle>
            <DialogDescription>
              سيُحذف هذا التكريم فقط من العمل. لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <MutationErrorAlert error={deleteMutation.error} />
          <DialogFooter className="flex-row justify-between">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              <TrashIcon data-icon="inline-start" />{" "}
              {deleteMutation.isPending ? "جارٍ الحذف…" : "تأكيد الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
