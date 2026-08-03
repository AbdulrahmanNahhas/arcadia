import { NotePencilIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { kindLabels } from "@/features/library/filtering";
import type { WorkKind } from "@/features/library/model";
import { genreSchema, workKinds } from "@/features/library/model";
import { editWorksBulk } from "@/server/library.functions";

function parseList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function BulkEditDialog({
  open,
  onOpenChange,
  workIds,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workIds: string[];
  onUpdated: () => Promise<void>;
}) {
  const [kind, setKind] = useState("");

  const [favorite, setFavorite] = useState("");
  const [addGenres, setAddGenres] = useState("");
  const [removeGenres, setRemoveGenres] = useState("");
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const mutation = useMutation({
    mutationFn: editWorksBulk,
    onSuccess: async () => {
      onOpenChange(false);
      await onUpdated();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      data: {
        workIds,
        ...(kind && kind !== "unchanged" ? { kind: kind as WorkKind } : {}),
        ...(favorite && favorite !== "unchanged" ? { favorite: favorite === "true" } : {}),
        addGenres: parseList(addGenres).flatMap((genre) => {
          const result = genreSchema.safeParse(genre);
          return result.success ? [result.data] : [];
        }),
        removeGenres: parseList(removeGenres).flatMap((genre) => {
          const result = genreSchema.safeParse(genre);
          return result.success ? [result.data] : [];
        }),
        addTags: parseList(addTags),
        removeTags: parseList(removeTags),
      },
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            تعديل {workIds.length} {workIds.length === 1 ? "عمل محدد" : "أعمال محددة"}
          </DialogTitle>

          <DialogDescription>
            لن تتغير إلا الحقول التي تضبطها هنا، وستبقى جميع البيانات الأخرى كما هي.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="تعيين النوع" htmlFor="bulk-kind">
              <Select value={kind} onValueChange={(value) => setKind(value ?? "unchanged")}>
                <SelectTrigger id="bulk-kind" className="w-full">
                  <SelectValue placeholder="دون تغيير" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="unchanged">دون تغيير</SelectItem>

                  {workKinds.map((item) => (
                    <SelectItem key={item} value={item}>
                      {kindLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="تعيين المفضلة" htmlFor="bulk-favorite">
              <Select value={favorite} onValueChange={(value) => setFavorite(value ?? "unchanged")}>
                <SelectTrigger id="bulk-favorite" className="w-full">
                  <SelectValue placeholder="دون تغيير" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="unchanged">دون تغيير</SelectItem>
                  <SelectItem value="true">في المفضلة</SelectItem>
                  <SelectItem value="false">ليست في المفضلة</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="إضافة تصنيفات" htmlFor="bulk-add-genres">
              <Input
                id="bulk-add-genres"
                value={addGenres}
                onChange={(event) => setAddGenres(event.target.value)}
                placeholder="Drama, Fantasy"
              />
            </FormField>

            <FormField label="إزالة تصنيفات" htmlFor="bulk-remove-genres">
              <Input
                id="bulk-remove-genres"
                value={removeGenres}
                onChange={(event) => setRemoveGenres(event.target.value)}
                placeholder="Ecchi"
              />
            </FormField>

            <FormField label="إضافة وسوم" htmlFor="bulk-add-tags">
              <Input
                id="bulk-add-tags"
                value={addTags}
                onChange={(event) => setAddTags(event.target.value)}
                placeholder="coming-of-age, school"
              />
            </FormField>

            <FormField label="إزالة وسوم" htmlFor="bulk-remove-tags">
              <Input
                id="bulk-remove-tags"
                value={removeTags}
                onChange={(event) => setRemoveTags(event.target.value)}
                placeholder="fan-service"
              />
            </FormField>
          </div>

          {mutation.error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {mutation.error.message}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              إلغاء
            </Button>

            <Button type="submit" disabled={mutation.isPending}>
              <NotePencilIcon className="size-4" />

              {mutation.isPending ? "جارٍ التحديث…" : "تطبيق التغييرات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
};

function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
