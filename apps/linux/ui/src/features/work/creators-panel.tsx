import type { WorkDetail } from "@nahhasio/api-contract";

import { Artwork } from "../../components/artwork";
import { entityLink } from "../shell/navigation";
import { Section, FieldList } from "./field-list";
import { pickArtwork } from "./format";
export function CreatorsPanel({ work }: { work: WorkDetail }) {
  return (
    <>
      <Section title="الأشخاص والاستوديوهات">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-6 [@media(max-width:750px)]:grid-cols-1">
          {work.contributions.map((credit, index) => (
            <article
              className="flex gap-5 rounded-[20px] border border-border bg-card p-5.5"
              key={`${credit.id}-${credit.roleId}-${index.toString()}`}
            >
              <Artwork
                id={pickArtwork(credit.artwork, "portrait")?.id ?? credit.artwork[0]?.id}
                alt=""
                className="h-32.5 w-22.5 shrink-0 rounded-[13px] object-cover"
              />
              <div className="min-w-0">
                <a
                  href={entityLink(
                    credit.kind === "organization" ? "studios" : "contributors",
                    credit.id,
                  )}
                >
                  <h3 className="text-[17px] font-semibold" dir="auto">
                    {credit.name}
                  </h3>
                </a>
                <p>
                  {credit.roleLabelAr || credit.roleLabelEn} {credit.isPrimary ? "· دور رئيسي" : ""}
                </p>
                <p className="text-sm leading-[2.1] whitespace-pre-line wrap-anywhere">
                  {credit.description}
                </p>
                <FieldList
                  rows={[
                    ["الاسم الأصلي للدور", credit.roleLabelEn],
                    ["وصف الدور", credit.roleDescriptionAr || credit.roleDescriptionEn],
                    ["الترتيب", credit.position],
                    ["نوع السجل", credit.kind === "person" ? "شخص" : "جهة"],
                  ]}
                />
                {credit.aliases.length > 0 && (
                  <details className="my-3 rounded-[14px] border border-border p-3.75">
                    <summary className="cursor-pointer text-[13px] leading-[1.8] [[open]>&]:mb-4.5">
                      أسماء أخرى
                    </summary>
                    {credit.aliases.map((alias) => (
                      <p key={`${alias.language}-${alias.alias}`} dir="auto">
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
          <p className="text-[13px] leading-[1.9] text-muted-foreground">
            لم تُربط أسماء صنّاع لهذا العمل بعد.
          </p>
        )}
      </Section>
    </>
  );
}
