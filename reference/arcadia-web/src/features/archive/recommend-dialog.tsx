import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getFamilyAccounts, useCurrentAccount } from "@/features/accounts/api";
import { archiveKeys, createRecommendation } from "./api";

/**
 * "رشّح لشخص" — a direct, private recommendation to one other family member. Fully controlled
 * (no `DialogTrigger` of its own) so it can be opened from wherever a title is already shown —
 * the spacious title-detail actions (`work-family-actions.tsx`) and the compact per-card action
 * menu (`work-card-actions.tsx`) both open the same dialog rather than each growing their own
 * copy of this form.
 */
export function RecommendDialog({
  titleId,
  title,
  open,
  onOpenChange,
}: {
  titleId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const current = useCurrentAccount();
  const family = useQuery({ queryKey: ["account", "family"], queryFn: getFamilyAccounts });
  const [recipientId, setRecipientId] = useState("");
  const [reason, setReason] = useState("");
  const client = useQueryClient();
  const recommend = useMutation({
    mutationFn: () => createRecommendation({ recipientAccountId: recipientId, titleId, reason }),
    onSuccess: () => {
      setReason("");
      client.invalidateQueries({ queryKey: archiveKeys.recommendations });
    },
  });
  const relatives = family.data?.filter((account) => account.id !== current.data?.account.id) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <Button
            disabled={!recipientId || !reason.trim() || recommend.isPending}
            onClick={() => recommend.mutate()}
          >
            إرسال التوصية
          </Button>
          {recommend.isSuccess ? <p className="text-sm text-emerald-500">أُرسلت التوصية.</p> : null}
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
