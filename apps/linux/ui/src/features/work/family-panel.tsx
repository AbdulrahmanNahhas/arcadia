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
          <span key={label} className="risk-pill" data-level={value}>
            {riskLabels.get(value) || value}
          </span>,
        ]),
      ]}
    />
  );
}
export function FamilyPanel({ work }: { work: WorkDetail }) {
  return (
    <div className="work-two-columns">
      <div>
        <Section title="دليل العائلة">
          <RiskRows classification={work} />
        </Section>
        <Section title="تصنيف كل جزء">
          {work.installments.map((unit) => (
            <details key={unit.id}>
              <summary>{unit.title}</summary>
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
          <p className="long-copy">{work.contentWarnings || "لم تُسجّل تنبيهات محتوى لهذا العمل."}</p>
        </Section>
        <Section title="ملاحظات التحليل">
          <p className="long-copy">{work.analysisNotes || "لم تُضف ملاحظات تحليل بعد."}</p>
        </Section>
        <Section title="ملاحظات المحرر">
          <p className="long-copy">{work.curatorNotes || "لا توجد ملاحظات إضافية."}</p>
        </Section>
      </div>
    </div>
  );
}
