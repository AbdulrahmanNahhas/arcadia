import { CalendarPlusIcon, FolderPlusIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFamilyAccounts, useCurrentAccount } from "@/features/accounts/api";
import {
  addCollectionItem,
  archiveKeys,
  createFamilyEvent,
  createRecommendation,
  getCollections,
} from "./api";

export function WorkFamilyActions({ titleId, title }: { titleId: string; title: string }) {
  const current = useCurrentAccount();
  const family = useQuery({ queryKey: ["account", "family"], queryFn: getFamilyAccounts });
  const collections = useQuery({ queryKey: archiveKeys.collections, queryFn: getCollections });
  const [recipientId, setRecipientId] = useState("");
  const [reason, setReason] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [eventName, setEventName] = useState(`ليلة ${title}`);
  const [scheduledFor, setScheduledFor] = useState("");
  const client = useQueryClient();
  const recommend = useMutation({
    mutationFn: () => createRecommendation({ recipientAccountId: recipientId, titleId, reason }),
    onSuccess: () => {
      setReason("");
      client.invalidateQueries({ queryKey: archiveKeys.recommendations });
    },
  });
  const add = useMutation({
    mutationFn: () => addCollectionItem(collectionId, titleId),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.collections }),
  });
  const event = useMutation({
    mutationFn: () =>
      createFamilyEvent({
        name: eventName,
        notes: `اقتراح مشاهدة ${title}`,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        candidateTitleIds: [titleId],
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: archiveKeys.events }),
  });
  const relatives = family.data?.filter((account) => account.id !== current.data?.account.id) ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger
          render={
            <Button variant="secondary" size="sm" className="rounded-full" aria-label="رشّحه لشخص" />
          }
        >
          <PaperPlaneTiltIcon /> <span className="sr-only sm:not-sr-only">رشّحه لشخص</span>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رشّح «{title}»</DialogTitle>
            <DialogDescription>توصية مباشرة داخل العائلة، وليست منشوراً عاماً.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>إلى</FieldLabel>
              <Select value={recipientId} onValueChange={(value) => setRecipientId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الحساب" />
                </SelectTrigger>
                <SelectContent>
                  {relatives.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>لماذا؟</FieldLabel>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button
              disabled={!recipientId || !reason.trim() || recommend.isPending}
              onClick={() => recommend.mutate()}
            >
              إرسال التوصية
            </Button>
            {recommend.isSuccess ? (
              <p className="text-sm text-emerald-500">أُرسلت التوصية.</p>
            ) : null}
          </FieldGroup>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              aria-label="أضف لمجموعة"
            />
          }
        >
          <FolderPlusIcon /> <span className="sr-only sm:not-sr-only">أضف لمجموعة</span>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>أضف العمل إلى مجموعة</DialogTitle>
            <DialogDescription>
              يمكنك إدارة المجموعات وإنشاء المزيد من صفحة «مساحتي».
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>المجموعة</FieldLabel>
              <Select value={collectionId} onValueChange={(value) => setCollectionId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر مجموعة" />
                </SelectTrigger>
                <SelectContent>
                  {collections.data?.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button disabled={!collectionId || add.isPending} onClick={() => add.mutate()}>
              إضافة
            </Button>
            {add.isSuccess ? <p className="text-sm text-emerald-500">أُضيف إلى المجموعة.</p> : null}
          </FieldGroup>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              aria-label="اقترح ليلة"
            />
          }
        >
          <CalendarPlusIcon /> <span className="sr-only sm:not-sr-only">اقترح ليلة</span>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>موعد مشاهدة عائلي</DialogTitle>
            <DialogDescription>ابدأ بمرشح واحد، ثم تصوّت العائلة عليه من مساحتها.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>اسم الموعد</FieldLabel>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>موعد اختياري</FieldLabel>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </Field>
            <Button
              disabled={eventName.trim().length < 2 || event.isPending}
              onClick={() => event.mutate()}
            >
              إنشاء الموعد
            </Button>
            {event.isSuccess ? <p className="text-sm text-emerald-500">أُنشئ الموعد.</p> : null}
          </FieldGroup>
        </DialogContent>
      </Dialog>
    </div>
  );
}
