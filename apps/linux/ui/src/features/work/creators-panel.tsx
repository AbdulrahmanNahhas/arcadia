import type { WorkDetail } from "@nahhasio/api-contract";

import { Artwork } from "../../components/artwork";
import { Section, FieldList } from "./field-list";
import { pickArtwork } from "./format";
export function CreatorsPanel({ work }: { work: WorkDetail }) {
  return (
    <>
      <Section title="الأشخاص والاستوديوهات">
        <div className="creator-grid">
          {work.contributions.map((credit, index) => (
            <article key={`${credit.id}-${credit.roleId}-${index}`}>
              <Artwork
                id={pickArtwork(credit.artwork, "portrait")?.id ?? credit.artwork[0]?.id}
                alt=""
                className="creator-art"
              />
              <div>
                <a href={`#/${credit.kind === "organization" ? "studios" : "people"}/${credit.id}`}>
                  <h3 dir="auto">{credit.name}</h3>
                </a>
                <p>
                  {credit.roleLabelAr || credit.roleLabelEn} {credit.isPrimary ? "· دور رئيسي" : ""}
                </p>
                <p className="long-copy">{credit.description}</p>
                <FieldList
                  rows={[
                    ["الاسم الأصلي للدور", credit.roleLabelEn],
                    ["وصف الدور", credit.roleDescriptionAr || credit.roleDescriptionEn],
                    ["الترتيب", credit.position],
                    ["نوع السجل", credit.kind === "person" ? "شخص" : "جهة"],
                  ]}
                />
                {credit.aliases.length > 0 && (
                  <details>
                    <summary>أسماء أخرى</summary>
                    {credit.aliases.map((alias, n) => (
                      <p key={n} dir="auto">
                        {alias.alias} · {alias.language}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
        {work.contributions.length === 0 && (
          <p className="empty-copy">لم تُربط أسماء صنّاع لهذا العمل بعد.</p>
        )}
      </Section>
    </>
  );
}
