import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrackingForm } from "@/features/library/components/tracking-form";
import type { Work } from "@/features/library/model";
import { getWorkStructure } from "@/server/library.functions";

export function AddTrackingDialog({
  open,
  onOpenChange,
  works,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  works: Work[];
}) {
  const [workId, setWorkId] = useState(works[0]?.id ?? "");
  const work = works.find((item) => item.id === workId);
  const structure = useQuery({
    queryKey: ["work-structure", workId],
    queryFn: () => getWorkStructure({ data: { workId } }),
    enabled: open && Boolean(workId),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>إضافة تقدم</DialogTitle>
          <DialogDescription>اختر العمل ومقدار التقدم والحالة وتاريخ حدوثه.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="tracking-work">العمل</FieldLabel>
          <Select value={workId} onValueChange={(value) => value && setWorkId(value)}>
            <SelectTrigger id="tracking-work" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {works.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.arabicTitle || item.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {work ? (
          <TrackingForm
            key={work.id}
            work={work}
            structure={structure.data}
            compact
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
