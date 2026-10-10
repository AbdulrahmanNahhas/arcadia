import type { Classification, ClassificationOverrides, WorkDetail } from "@nahhasio/api-contract";
import type { ReactNode } from "react";

import { Badge } from "../../components/ui/badge";
import { Disclosure, FieldList, Section } from "./field-list";
import { audienceLabels, classificationLabels, riskLabels } from "./format";

export function RiskRows({
  classification,
  overrides,
}: {
  classification: Classification;
  overrides?: ClassificationOverrides;
}) {
  const rows: Array<[string, ReactNode]> = [];
  for (const [key, label] of classificationLabels) {
    const value = classification[key];
    if (!value) continue;
    const isRisk = key !== "audience" && key !== "age";
    rows.push([
      label,
      <span key={key} className="inline-flex flex-wrap items-center justify-end gap-2">
        {isRisk ? (
          <Badge
            variant={
              value === "high" ? "destructive" : value === "medium" ? "secondary" : "outline"
            }
          >
            {riskLabels.get(value) ?? value}
          </Badge>
        ) : (
          <bdi>{key === "audience" ? (audienceLabels.get(value) ?? value) : value}</bdi>
        )}
        {overrides && (
          <span className="text-xs text-muted-foreground">
            {overrides[key] === null ? "موروث من العمل" : "خاص بالجزء"}
          </span>
        )}
      </span>,
    ]);
  }
  return <FieldList rows={rows} />;
}

export function ContentNotices({ work, compact = false }: { work: WorkDetail; compact?: boolean }) {
  const notes = [
    { title: "تنبيه المحتوى", text: work.contentWarnings },
    { title: "ملاحظات التحليل", text: work.analysisNotes },
    { title: "ملاحظات المحرر", text: work.curatorNotes },
  ].filter((note) => note.text?.trim());
  if (!notes.length) return null;
  if (compact)
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {notes.map((note) => (
          <Disclosure key={note.title} title={note.title}>
            <p
              className="text-base leading-loose whitespace-pre-line wrap-anywhere md:text-lg"
              dir="auto"
            >
              {note.text}
            </p>
          </Disclosure>
        ))}
      </div>
    );
  return (
    <div className="grid min-w-0 gap-x-6 lg:grid-cols-2">
      {notes.map((note) => (
        <Section key={note.title} title={note.title}>
          <article className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <p
              className="text-base leading-loose whitespace-pre-line wrap-anywhere md:text-lg"
              dir="auto"
            >
              {note.text}
            </p>
          </article>
        </Section>
      ))}
    </div>
  );
}

export function FamilyPanel({ work }: { work: WorkDetail }) {
  return (
    <div className="min-w-0">
      <Section title="دليل العائلة">
        <div className="max-w-xl">
          <RiskRows classification={work} />
        </div>
      </Section>
      <ContentNotices work={work} />
    </div>
  );
}
