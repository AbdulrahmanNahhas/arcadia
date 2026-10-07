import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

import { rowSchema, type DatabaseRow, type DatabaseTable } from "./database-model";
import { mutateDatabaseRecord } from "./database.functions";
import { databaseKeys } from "./database.queries";

const CodeEditor = lazy(() =>
  import("@/features/editor/code-editor").then((module) => ({ default: module.CodeEditor })),
);
export function RecordEditor({
  table,
  row,
  onClose,
}: {
  table: DatabaseTable;
  row: DatabaseRow | null;
  onClose: () => void;
}) {
  const editable = table.columns.filter((column) => !column.generated && (!row || !column.primary));
  const initial =
    row && !table.writable
      ? row
      : row
        ? Object.fromEntries(editable.map((column) => [column.name, row[column.name] ?? null]))
        : Object.fromEntries(
            editable
              .filter((column) => !column.default_value && !column.nullable)
              .map((column) => [column.name, column.data_type === "bool" ? false : ""]),
          );
  const [draft, setDraft] = useState(() => JSON.stringify(initial, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const client = useQueryClient();
  const update = useCallback((value: string) => {
    setDraft(value);
    setError(null);
  }, []);
  const mutation = useMutation({
    mutationFn: async (operation: "create" | "update" | "delete") => {
      const values = operation === "delete" ? {} : rowSchema.parse(JSON.parse(draft));
      const key = row
        ? Object.fromEntries(
            table.columns
              .filter((column) => column.primary)
              .map((column) => [column.name, row[column.name] ?? null]),
          )
        : {};
      return mutateDatabaseRecord({
        data: { table: table.name, operation, values, key, original: row ?? undefined },
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: databaseKeys.all });
      onClose();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {row ? "تحرير السجل" : "إضافة سجل"} · {table.name}
          </DialogTitle>
          <DialogDescription>
            راجع القيم قبل الحفظ. المعرّفات الحالية ثابتة، وكل تغيير يُسجّل في سجل المراجعات.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>قيم السجل بصيغة JSON</FieldLabel>
            <FieldDescription>
              احذف الحقل لاستخدام قيمته الافتراضية عند الإضافة. استخدم null للفراغ، والأرقام والقيم
              المنطقية بأنواعها الصحيحة.
            </FieldDescription>
            <Suspense fallback={<Skeleton className="h-80" />}>
              <CodeEditor value={draft} onChange={update} />
            </Suspense>
          </Field>
        </FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر الحفظ</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {deleting && (
          <Alert variant="destructive">
            <AlertTitle>تأكيد حذف هذا السجل</AlertTitle>
            <AlertDescription>
              الحذف مرفوض عند وجود سجلات مرتبطة. تُحفظ نسخة لاستعادة السجلات المستقلة من سجل التغييرات.
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            إلغاء
          </Button>
          {row && table.writable && (
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => {
                if (deleting) mutation.mutate("delete");
                else setDeleting(true);
              }}
            >
              {deleting ? "تأكيد الحذف" : "حذف السجل"}
            </Button>
          )}
          <Button
            disabled={mutation.isPending || deleting || !table.writable}
            onClick={() => mutation.mutate(row ? "update" : "create")}
          >
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
