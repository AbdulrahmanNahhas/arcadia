import { CheckIcon, ClipboardTextIcon, RobotIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DOC_VALUE_TYPE_KEY, type fieldDoc, GLOBAL_SAFETY_NOTES } from "./guide";
import { referenceLists } from "./reference";

type FieldDoc = ReturnType<typeof fieldDoc>;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The editor's right-hand panel: the selected fields as one compact line each (expand for the
 * rules), every allowed-values list with a copy button, and "نسخ حزمة للمساعد" — the guide,
 * the lists and the current JSON in one paste for an assistant that cannot see the archive.
 */
export function ReferencePanel({
  fieldDocs,
  buildAssistantBundle,
}: {
  fieldDocs: FieldDoc[];
  buildAssistantBundle: () => string;
}) {
  const [tab, setTab] = useState<"fields" | "values">("values");
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  };

  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden p-0">
      <div className="flex shrink-0 items-center gap-1 border-b bg-muted/20 p-1.5">
        <Tab active={tab === "values"} onClick={() => setTab("values")}>
          القيم المسموحة
        </Tab>
        <Tab active={tab === "fields"} onClick={() => setTab("fields")}>
          الحقول ({fieldDocs.length})
        </Tab>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {tab === "fields" ? (
          fieldDocs.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">لا حقول محدّدة بعد.</p>
          ) : (
            fieldDocs.map((doc) => {
              const open = expanded === doc.key;
              return (
                <div key={doc.key} className="rounded-md border border-border/60">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : doc.key)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-start text-xs hover:bg-accent"
                  >
                    <code dir="ltr" className="font-mono text-[10px] text-muted-foreground">
                      {doc.key}
                    </code>
                    <span className="truncate">{doc.label}</span>
                    {doc.safetyNotes && (
                      <ShieldWarningIcon className="ms-auto size-3.5 shrink-0 text-classification-caution" />
                    )}
                  </button>
                  {open && (
                    <div className="border-t border-border/60 px-2 py-1.5 text-xs text-muted-foreground">
                      <p>{doc.purpose}</p>
                      <p className="mt-1 font-mono text-[10px]" dir="ltr">
                        {doc[DOC_VALUE_TYPE_KEY]} · {doc.required ? "required" : "optional"} ·{" "}
                        {doc.nullable ? "nullable" : "not nullable"}
                      </p>
                      {doc.example && (
                        <p className="mt-1 font-mono text-[10px]" dir="ltr">
                          {doc.example}
                        </p>
                      )}
                      {doc.safetyNotes && (
                        <p className="mt-1 text-classification-caution">⚠ {doc.safetyNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          referenceLists.map((list) => (
            <div key={list.key} className="rounded-md border border-border/60 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{list.label}</span>
                <code dir="ltr" className="font-mono text-[10px] text-muted-foreground">
                  {list.field}
                </code>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ms-auto"
                  aria-label={`نسخ ${list.label}`}
                  onClick={async () => {
                    if (await copy(JSON.stringify(list.values))) flash(list.key);
                  }}
                >
                  {copied === list.key ? (
                    <CheckIcon className="text-primary" />
                  ) : (
                    <ClipboardTextIcon />
                  )}
                </Button>
              </div>
              <p
                dir="ltr"
                className="mt-1 line-clamp-2 font-mono text-[10px] leading-4 text-muted-foreground"
              >
                {list.values.join(" · ")}
              </p>
              {list.note && <p className="mt-0.5 text-[10px] text-muted-foreground">{list.note}</p>}
            </div>
          ))
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t bg-muted/20 p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (await copy(buildAssistantBundle())) flash("bundle");
          }}
        >
          {copied === "bundle" ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <RobotIcon data-icon="inline-start" />
          )}
          نسخ حزمة للمساعد
        </Button>
        <p className="text-[10px] leading-4 text-muted-foreground">
          الدليل والقيم المسموحة وJSON الحالي في نص واحد، للصقه في محادثة مع مساعد لا يرى الأرشيف.{" "}
          {GLOBAL_SAFETY_NOTES.length} قاعدة سلامة مضمّنة.
        </p>
      </div>
    </Card>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
