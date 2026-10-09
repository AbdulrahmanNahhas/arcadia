import type { Classification, WorkDetail } from "@nahhasio/api-contract";
import type { ReactNode } from "react";

import { FieldList, Section } from "./field-list";
import { audienceLabels, riskLabels } from "./format";
export function RiskRows({ classification }: { classification: Classification }) {
  return (
    <FieldList
      rows={[
        ["الجمهور", audienceLabels.get(classification.audience) || classification.audience],
        ["الفئة العمرية", classification.age],
        ...[
          ["المحتوى الجنسي", classification.sexualityRisk],
          ["العنف والسلوك", classification.behavioralRisk],
          ["الموضوعات العقدية", classification.theologyRisk],
        ].map(([label, value]): [string, ReactNode] => [
          label,
          <span
            key={label}
            className="inline-block rounded-full bg-secondary px-3 py-0.75 text-[11px] data-[level=high]:text-destructive data-[level=medium]:text-(--warning)"
            data-level={value}
          >
            {riskLabels.get(value) || value}
          </span>,
        ]),
      ]}
    />
  );
}
export function FamilyPanel({ work }: { work: WorkDetail }) {
  return (
    <div className="grid grid-cols-2 gap-7.5 [@media(max-width:750px)]:grid-cols-1">
      <div>
        <Section title="دليل العائلة">
          <RiskRows classification={work} />
        </Section>
        <Section title="تصنيف كل جزء">
          {work.installments.map((unit) => (
            <details className="my-3 rounded-[14px] border border-border p-3.75" key={unit.id}>
              <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
                {unit.title}
              </summary>
              <RiskRows classification={unit.classification} />
              <FieldList
                rows={Object.entries(unit.classificationOverrides).map(([key, value]) => [
                  key,
                  value ?? "موروث من العمل",
                ])}
              />
            </details>
          ))}
        </Section>
      </div>
      <div>
        <Section title="تنبيه المحتوى">
          <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
            {work.contentWarnings || "لم تُسجّل تنبيهات محتوى لهذا العمل."}
          </p>
        </Section>
        <Section title="ملاحظات التحليل">
          <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
            {work.analysisNotes || "لم تُضف ملاحظات تحليل بعد."}
          </p>
        </Section>
        <Section title="ملاحظات المحرر">
          <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
            {work.curatorNotes || "لا توجد ملاحظات إضافية."}
          </p>
        </Section>
      </div>
    </div>
  );
}
