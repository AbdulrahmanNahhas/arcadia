import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ReferenceField } from "@/features/editor/reference-field";
import { TextField } from "@/features/editor/work-fields";

import { changeCatalogContribution } from "./catalog.functions";
import type { DatabaseRow } from "./database-model";
import { databaseKeys } from "./database.queries";

export function CatalogContributionEditor({
  row,
  title,
  onClose,
}: {
  row: DatabaseRow;
  title: string;
  onClose: () => void;
}) {
  const [roleId, setRoleId] = useState(String(row.role_id));
  const [position, setPosition] = useState(String(row.position));
  const [primary, setPrimary] = useState(row.is_primary === true);
  const id = useId();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => {
      const parsed = z
        .object({
          title_id: z.string().uuid(),
          entity_id: z.string().uuid(),
          role_id: z.string().uuid(),
          position: z.number().int().nonnegative(),
          is_primary: z.boolean(),
        })
        .parse(row);
      return changeCatalogContribution({
        data: {
          original: parsed,
          roleId,
          position: z.number().int().nonnegative().parse(Number(position)),
          isPrimary: primary,
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["database", "catalog"] }),
        client.invalidateQueries({ queryKey: databaseKeys.records("contributions") }),
      ]);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            غيّر الدور وترتيب المساهمة دون إزالة العمل أو تغيير الكيان.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <ReferenceField
            table="roles"
            label="الدور"
            value={roleId}
            useIdValue
            onChange={setRoleId}
          />
          <TextField
            label="ترتيب المساهمة"
            type="number"
            min={0}
            value={position}
            onChange={setPosition}
          />
          <Field orientation="horizontal">
            <Checkbox
              id={id}
              checked={primary}
              onCheckedChange={(value) => setPrimary(value === true)}
            />
            <FieldLabel htmlFor={id}>مساهمة رئيسية</FieldLabel>
          </Field>
        </FieldGroup>
        {save.isError && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر حفظ المساهمة</AlertTitle>
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button
            disabled={
              save.isPending ||
              !roleId ||
              !position.trim() ||
              !Number.isInteger(Number(position)) ||
              Number(position) < 0
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ المساهمة"}
          </Button>
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
