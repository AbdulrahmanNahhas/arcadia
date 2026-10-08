import type { WorkDocument } from "@arcadia/cli/work";
import { useMutation } from "@tanstack/react-query";
import { BracesIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { parseWorkDraft } from "./document.functions";

const CodeEditor = lazy(() =>
  import("./code-editor").then((module) => ({ default: module.CodeEditor })),
);
export function WorkDraftJson({
  document,
  onApply,
  disabled,
}: {
  document: WorkDocument;
  onApply: (value: WorkDocument) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <BracesIcon data-icon="inline-start" />
        محرر JSON
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>مسودة العمل في JSON</DialogTitle>
            <DialogDescription>
              نفس بيانات النموذج، بما فيها الأجزاء والحلقات والصور والجوائز. اعتماد المسودة لا يحفظها
              في قاعدة البيانات؛ راجع التغييرات بعدها.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <DraftJson
              document={document}
              onApply={(value) => {
                onApply(value);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function DraftJson({
  document,
  onApply,
}: {
  document: WorkDocument;
  onApply: (value: WorkDocument) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(document, null, 2));
  const parse = useMutation({
    mutationFn: (value: string) => parseWorkDraft({ data: { json: value } }),
  });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {parse.isError && (
        <Alert variant="destructive">
          <AlertTitle>المسودة غير صالحة</AlertTitle>
          <AlertDescription>{parse.error.message}</AlertDescription>
        </Alert>
      )}
      <Suspense fallback={<Skeleton className="h-96" />}>
        <CodeEditor
          readOnly={parse.isPending}
          value={json}
          onChange={(value) => {
            setJson(value);
            parse.reset();
          }}
        />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Ctrl/⌘ + F للبحث · طي الأقسام من هامش المحرر.
        </p>
        <Button
          type="button"
          disabled={parse.isPending}
          onClick={() => parse.mutate(json, { onSuccess: onApply })}
        >
          {parse.isPending ? "جارٍ التحقق…" : "اعتماد المسودة"}
        </Button>
      </div>
    </div>
  );
}
